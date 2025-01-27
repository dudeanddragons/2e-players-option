/**
 * Critical Hit, Fumble, and Knockdown Processing Script
 * Automatically evaluates critical hits, fumbles, knockdowns, and exports metadata for external processing.
 */
Hooks.on("createChatMessage", async (chatMessage) => {
    // Ensure the message contains a roll
    const roll = chatMessage.rolls?.[0];
    if (!roll) return;

    const atkNaturalRoll = roll.dice?.[0]?.total || null; // Extract the natural roll
    if (atkNaturalRoll === null) return; // Exit if no roll is found

    // Extract settings for critical hits and fumbles
    const criticalHitOption = game.settings.get("2e-players-option", "criticalHitOption");
    const criticalMissOption = game.settings.get("2e-players-option", "criticalMissOption");

    // Exit early if both critical hit and fumble settings are disabled
    if (criticalHitOption === "none" && criticalMissOption === "none") return;

    console.log("Processing attack roll for critical hit, fumble, and knockdown...");

    // Extract roll metadata
    const atkTotalRoll = roll.total || null;
    const atkRollFormula = roll.formula || "Unknown Formula";

    // Extract actor and weapon details
    const atkActorUuid = chatMessage.flags.world?.context?.actorUuid || null;
    const atkActor = atkActorUuid ? await fromUuid(atkActorUuid) : null;
    const atkActorName = atkActor?.name || "Unknown Actor";

    const atkWeaponUuid = chatMessage.flags.world?.context?.itemUuid || null;
    const atkWeapon = atkWeaponUuid ? await fromUuid(atkWeaponUuid) : null;
    const atkWeaponName = atkWeapon?.name || "Unknown Weapon";

    // Fetch THAC0 from the actor's attributes
    const atkThac0 = atkActor?.system?.attributes?.thaco?.value;

    // Fetch weapon size, default to actor size if missing
    const atkWeaponSize = atkWeapon?.system?.attributes?.size || atkActor?.system?.attributes?.size || "medium";

    // Fetch weapon damage type
    const atkDamageType = atkWeapon?.system?.damage?.type || "Unknown";

    // Extract critical properties from the weapon
    const atkCriticalProperties = Object.values(atkWeapon?.system?.attributes?.properties || {})
        .filter((value) => typeof value === "string" && value.toLowerCase().startsWith("crit:"))
        .join(", ");

    // Extract critical modifier from properties or set to 0 if none exist
    const atkCriticalModifierMatch = atkCriticalProperties.match(/crit:\s*(-?\d+)/i);
    const atkCriticalModifier = atkCriticalModifierMatch ? parseInt(atkCriticalModifierMatch[1], 10) : 0;

    // Adjust the critical range based on the `criticalHitOption` setting
    let atkCriticalRange = 20; // Default critical range
    if (criticalHitOption === "natural18Plus5" || criticalHitOption === "natural18Reroll") {
        atkCriticalRange = 18;
    } else if (criticalHitOption === "natural20" || criticalHitOption === "natural20Plus5" || criticalHitOption === "natural20Reroll") {
        atkCriticalRange = 20;
    }

    // Apply weapon-specific critical modifier
    atkCriticalRange -= atkCriticalModifier;
    atkCriticalRange = Math.max(15, Math.min(atkCriticalRange, 20)); // Cap between 15 and 20

    // Extract target information
    const atkTargetTokenUuid = chatMessage.flags.world?.context?.targetTokenUuid || null;
    const atkTargetToken = atkTargetTokenUuid ? await fromUuid(atkTargetTokenUuid) : null;
    const atkTargetName = atkTargetToken?.name || "Unknown Target";
    const atkTargetActorUuid = atkTargetToken?.actor?.uuid || null;

    // Fetch target size
    const atkTargetSize = atkTargetToken?.actor?.system?.attributes?.size || "Unknown Size";

    // Determine knockdown roll target based on target size
    const knockdownRollTable = {
        tiny: 3,
        small: 5,
        medium: 7,
        large: 9,
        huge: 11,
        gargantuan: 12,
    };
    const atkKnockdownRollTarget = knockdownRollTable[atkTargetSize.toLowerCase()] || "Unknown";

    // Determine critical severity based on weapon size vs. target size
    const sizeHierarchy = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
    const atkWeaponSizeIndex = sizeHierarchy.indexOf(atkWeaponSize.toLowerCase());
    const atkTargetSizeIndex = sizeHierarchy.indexOf(atkTargetSize.toLowerCase());

    let atkCriticalSeverity = "Unknown";
    if (atkWeaponSizeIndex >= 0 && atkTargetSizeIndex >= 0) {
        const sizeDifference = atkWeaponSizeIndex - atkTargetSizeIndex;
        if (sizeDifference < 0) atkCriticalSeverity = "Minor";
        else if (sizeDifference === 0) atkCriticalSeverity = "Major";
        else if (sizeDifference === 1) atkCriticalSeverity = "Severe";
        else if (sizeDifference >= 2) atkCriticalSeverity = "Mortal";
    }

    // Extract target AC if available
    const strippedContent = chatMessage.content.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
    const atkTargetAcMatch = strippedContent.match(/Target\s+AC\s+(-?\d+)/i);
    const atkTargetAc = atkTargetAcMatch ? parseInt(atkTargetAcMatch[1], 10) : null;

    // Extract "Hit AC" value
    let atkHitAc = null;
    if (atkNaturalRoll === 1) {
        const fumbleMatch = strippedContent.match(/(?:Hit\s+AC|Critical\s+AC)\s+(-?\d+)/i);
        if (fumbleMatch) atkHitAc = parseInt(fumbleMatch[1], 10);
    } else {
        const atkHitAcMatch = strippedContent.match(/(?:Hit\s+AC|Critical\s+AC)\s+(-?\d+)/i);
        if (atkHitAcMatch) atkHitAc = parseInt(atkHitAcMatch[1], 10);
    }

    // Calculate "Hit By" (target AC - hit AC)
    const atkHitBy = atkHitAc !== null && atkTargetAc !== null ? atkTargetAc - atkHitAc : "Unknown";

    // Determine if the attack hit
    const atkAttackHit = atkHitBy !== "Unknown" && atkHitBy >= 0;

    // Fetch attacker size for knockdown logic
    const atkActorSize = atkActor?.system?.attributes?.size || "medium";

    // Knockdown size adjustment logic
    const sizeAdjustmentTable = {
        tiny: -2,
        small: -1,
        medium: 0,
        large: 1,
        huge: 2,
        gargantuan: 3,
    };

    // Determine default knockdown dice based on attacker size
    const defaultKnockdownDiceTable = ["1d4", "1d6", "1d8", "1d10", "1d12"];
    const atkKnockdownDice = "1d8"; // Default dice

    // Calculate knockdown adjustment
    const sizeAdjustment = sizeAdjustmentTable[atkActorSize.toLowerCase()] || 0;
    const baseDiceIndex = defaultKnockdownDiceTable.indexOf(atkKnockdownDice);
    const adjustedDiceIndex = Math.max(0, Math.min(defaultKnockdownDiceTable.length - 1, baseDiceIndex + sizeAdjustment));
    const atkKnockdownAdj = defaultKnockdownDiceTable[adjustedDiceIndex];

    // Initialize critical hit and fumble flags
    let atkCriticalThreat = atkNaturalRoll >= atkCriticalRange && atkAttackHit;
    let atkCriticalHit = false;
    let atkFumbleThreat = atkNaturalRoll === 1;
    let atkFumble = false;

    // === Critical Hit Logic ===
    if (atkCriticalThreat && (criticalHitOption === "natural20Reroll" || criticalHitOption === "natural18Reroll")) {
        console.log("Performing secondary roll to confirm critical hit...");
        atkCriticalHit = await performSecondaryAttack(atkActor, atkRollFormula, atkTargetAc, atkThac0, "critical");
    }

    if (atkFumbleThreat && criticalMissOption === "natural1Reroll") {
        console.log(`Performing secondary roll to confirm fumble for ${atkActorName}...`);
        atkFumble = await performSecondaryAttack(atkActor, atkRollFormula, atkTargetAc, atkThac0, "fumble");
    } else if (atkFumbleThreat) {
        console.log(`Fumble confirmed without secondary roll for ${atkActorName}.`);
        atkFumble = true;
    }
    
    if (atkFumble) {
        console.log(`Processing fumble table for ${atkActorName}...`);
        await processFumbleResult(atkActorUuid, atkActorName);
    }
    
    
    
    
    
    

    // Log the results
    const attackMetadata = {
        actor: { name: atkActorName, uuid: atkActorUuid, size: atkActorSize, thac0: atkThac0 },
        weapon: { name: atkWeaponName, uuid: atkWeaponUuid, size: atkWeaponSize, damageType: atkDamageType },
        target: { name: atkTargetName, uuid: atkTargetActorUuid, size: atkTargetSize, ac: atkTargetAc, hitAc: atkHitAc, hitBy: atkHitBy, attackHit: atkAttackHit },
        roll: { natural: atkNaturalRoll, total: atkTotalRoll, formula: atkRollFormula },
        severity: atkCriticalSeverity,
        critical: { threat: atkCriticalThreat, confirmed: atkCriticalHit },
        fumble: { threat: atkFumbleThreat, confirmed: atkFumble },
        knockdown: { dice: atkKnockdownDice, adjustment: atkKnockdownAdj, targetRoll: atkKnockdownRollTarget },
    };

    console.log("Attack Metadata:", attackMetadata);

    if (atkCriticalHit) {
        Hooks.call("processCriticalHit", attackMetadata);
    }

    if (atkFumble) {
        console.log(`Confirmed Fumble for ${atkActorName} (UUID: ${atkActorUuid}). Processing fumble table result...`);
        await processFumbleResult(atkActorUuid, atkActorName);
    }
});



/**
 * Perform a secondary roll to confirm critical or fumble.
 * Uses AD&D 2E logic: THAC0 - Total Roll = Hit AC.
 */
async function performSecondaryAttack(actor, formula, targetAC, atkThac0, rollType) {
    if (!game.user.isGM) return false; // Ensure only the GM can execute this

    // Check if a secondary roll has already been performed for this attack
    if (actor[`${rollType}SecondaryRollPerformed`]) {
        console.log(`${rollType.charAt(0).toUpperCase() + rollType.slice(1)} secondary roll already performed for ${actor.name}. Skipping.`);
        return false;
    }

    try {
        // Mark the roll as performed
        actor[`${rollType}SecondaryRollPerformed`] = true;

        // Perform the roll
        const secondaryRoll = new Roll(formula);
        await secondaryRoll.evaluate({ async: true });

        // Send the roll to chat for transparency
        await secondaryRoll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: rollType === "critical" ? "Critical Threat Roll" : "Fumble Confirmation Roll",
        });

        const secondaryRollResult = secondaryRoll.total; // The result of the secondary roll
        const secondaryHitAC = atkThac0 - secondaryRollResult; // Calculate hit AC

        console.log(`Secondary Attack Roll Details:
            Roll Type: ${rollType},
            Target AC: ${targetAC},
            Secondary Roll Result: ${secondaryRollResult},
            Actor THAC0: ${atkThac0},
            Hit AC (Secondary Roll): ${secondaryHitAC}
        `);

        // Determine if the roll confirms a critical or fumble
        let confirmed = false;
        if (rollType === "critical" && secondaryHitAC <= targetAC) {
            console.log("Secondary roll confirmed the critical hit!");
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<strong>Confirmed Critical Hit!</strong>`,
            });
            confirmed = true;
        } else if (rollType === "fumble" && secondaryHitAC > targetAC) {
            console.log("Secondary roll confirmed the fumble!");
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<strong>Confirmed Fumble!</strong>`,
            });
            confirmed = true;
        } else {
            console.log(`Secondary roll did not confirm the ${rollType}.`);
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<strong>${rollType === "critical" ? "Critical Hit Not Confirmed" : "Fumble Not Confirmed"}</strong>`,
            });
        }

        return confirmed;
    } catch (error) {
        console.error("Error during secondary roll:", error);
        return false;
    } finally {
        // Clear the flag after the roll logic completes
        console.log(`Clearing ${rollType}SecondaryRollPerformed flag for ${actor.name}.`);
        actor[`${rollType}SecondaryRollPerformed`] = false;
    }
}












/**
 * Process the fumble table result.
 * Rolls on the main fumble table and handles any required subtables.
 * @param {string} actorUuid - The UUID of the actor tied to the fumble.
 * @param {string} actorName - The display name of the actor.
 */
async function processFumbleResult(actorUuid, actorName) {
    const fumbleRoll = new Roll("1d20");
    await fumbleRoll.evaluate({ async: true });
    const fumbleResult = fumbleRoll.total;

    console.log(`Fumble Table Roll for ${actorName} (UUID: ${actorUuid}): ${fumbleResult}`);

    // Determine the result from the fumble table
    let fumbleMessage = "";
    switch (true) {
        case fumbleResult <= 2:
            fumbleMessage = await rollArmorTrouble(actorUuid, actorName); // Armor Trouble Subtable
            break;
        case fumbleResult <= 4:
            fumbleMessage = "Battlefield Damaged: Something nearby is broken (e.g., furniture, equipment).";
            break;
        case fumbleResult === 5:
            fumbleMessage = "Battlefield Shifts: Combatants are moved 1d6 squares randomly without provoking attacks of opportunity.";
            break;
        case fumbleResult === 6:
            fumbleMessage = "Close Quarters: Combatants Grappled!";
            break;
        case fumbleResult === 7:
            fumbleMessage = "Item Damaged: A random item is damaged. Roll a saving throw to see if it breaks.";
            break;
        case fumbleResult === 8:
            fumbleMessage = "Item Dropped: An item is dropped, spilled, or cut free.";
            break;
        case fumbleResult <= 11:
            fumbleMessage = `Knock Down: ${actorName} is knocked to the ground. Save vs. paralyzation or fall.`;
            break;
        case fumbleResult === 12:
            fumbleMessage = "Lucky Break: The target gains +4 AC and saving throws for one round.";
            break;
        case fumbleResult === 13:
            fumbleMessage = "Lucky Opening: The target gains +4 to their next attack roll.";
            break;
        case fumbleResult <= 15:
            fumbleMessage = await rollMountTrouble(actorUuid, actorName); // Mount Trouble Subtable
            break;
        case fumbleResult === 16:
            fumbleMessage = "Reinforcements: Allies of the DM's choice arrive.";
            break;
        case fumbleResult === 17:
            fumbleMessage = `Retreat: ${actorName} is driven back.`;
            break;
        case fumbleResult === 18:
            fumbleMessage = `Slip: ${actorName} falls and spends the round on their back.`;
            break;
        case fumbleResult >= 19:
            fumbleMessage = await rollWeaponTrouble(actorUuid, actorName); // Weapon Trouble Subtable
            break;
    }

    console.log(`Fumble Result for ${actorName}: ${fumbleMessage}`);

    // Output the fumble result to chat
    ChatMessage.create({
        speaker: { alias: actorName },
        content: `<strong>Fumble Result:</strong> ${fumbleMessage}`,
    });
}



/**
 * Roll on the Armor Trouble subtable.
 */
async function rollArmorTrouble(actorUuid, actorName) {
    const roll = new Roll("1d6");
    await roll.evaluate({ async: true });

    let result = "";
    switch (roll.total) {
        case 1:
        case 2:
            result = "Helm lost: The victim's head is exposed.";
            break;
        case 3:
        case 4:
        case 5:
            result = "Shield lost.";
            break;
        case 6:
            result = "Plate/Padding lost: +2 to AC (plate armor only).";
            break;
    }

    console.log(`Armor Trouble Roll for ${actorName} (UUID: ${actorUuid}): ${roll.total} - ${result}`);
    return `Armor Trouble: ${result}`;
}



/**
 * Roll on the Mount Trouble subtable.
 */
async function rollMountTrouble(actorUuid, actorName) {
    const roll = new Roll("1d6");
    await roll.evaluate({ async: true });

    let result = "";
    switch (roll.total) {
        case 1:
        case 2:
        case 3:
            result = "Mount bolts: It sprints for 1d10 rounds in a random direction, or until the rider rolls a successful riding proficiency check.";
            break;
        case 4:
        case 5:
            result = "Mount rears: The rider must roll a successful riding proficiency check or fall off the mount.";
            break;
        case 6:
            result = "Mount falls: The thrown rider must roll a successful saving throw vs. paralyzation or be stunned for 1d6 rounds.";
            break;
    }

    console.log(`Mount Trouble Roll for ${actorName} (UUID: ${actorUuid}): ${roll.total} - ${result}`);
    return `Mount Trouble: ${result}`;
}



/**
 * Roll on the Weapon Trouble subtable.
 */
async function rollWeaponTrouble(actorUuid, actorName) {
    const roll = new Roll("1d6");
    await roll.evaluate({ async: true });

    let result = "";
    switch (roll.total) {
        case 1:
        case 2:
            result = `Disarmed: ${actorName} drops their weapon unless they succeed on a saving throw vs. paralyzation.`;
            break;
        case 3:
        case 4:
        case 5:
            result = "Hard parry: The weapon may break unless it passes a successful item saving throw vs. crushing blow.";
            break;
        case 6:
            result = `Weapon stuck: If ${actorName} killed an opponent last round, the weapon is stuck in the foe's body. {actorName} must take one round to pull it free.`;
            break;
    }

    console.log(`Weapon Trouble Roll for ${actorName} (UUID: ${actorUuid}): ${roll.total} - ${result}`);
    return `Weapon Trouble: ${result}`;
}










