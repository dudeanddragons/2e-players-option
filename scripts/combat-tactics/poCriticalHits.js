/**
 * Critical Hit, Fumble, and Knockdown Processing Script
 * Automatically evaluates critical hits, fumbles, knockdowns, and logs all hit-related metadata for validation.
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
    if (criticalHitOption === "natural20Reroll" && atkNaturalRoll === 20 && atkAttackHit) {
        console.log("Performing secondary roll to confirm critical hit...");
        atkCriticalHit = await performSecondaryAttack(atkActor, atkRollFormula, atkTargetAc, atkCriticalRange, "critical");
    } else if (criticalHitOption === "natural18Reroll" && atkNaturalRoll >= 18 && atkAttackHit) {
        console.log("Performing secondary roll to confirm critical hit...");
        atkCriticalHit = await performSecondaryAttack(atkActor, atkRollFormula, atkTargetAc, atkCriticalRange, "critical");
    }

    // === Fumble Logic ===
    if (criticalMissOption === "natural1Reroll" && atkNaturalRoll === 1) {
        console.log("Performing secondary roll to confirm fumble...");
        atkFumble = await performSecondaryAttack(atkActor, atkRollFormula, atkTargetAc, 5, "fumble");
    }

    // Log the results
    console.log(`Attack Metadata:
        Actor: ${atkActorName} (UUID: ${atkActorUuid}),
        Weapon: ${atkWeaponName} (UUID: ${atkWeaponUuid}),
        Critical Properties: ${atkCriticalProperties || "None"},
        Natural Roll: ${atkNaturalRoll},
        Total Roll: ${atkTotalRoll},
        Roll Formula: ${atkRollFormula},
        Target: ${atkTargetName} (UUID: ${atkTargetTokenUuid}),
        Target Size: ${atkTargetSize},
        Target AC: ${atkTargetAc ?? "Unknown"},
        Hit AC: ${atkHitAc ?? "Unknown"},
        Hit By: ${atkHitBy},
        Attack Hit: ${atkAttackHit},
        Critical Range: ${atkCriticalRange},
        Critical Threat: ${atkCriticalThreat},
        Critical Hit: ${atkCriticalHit},
        Fumble Threat: ${atkFumbleThreat},
        Fumble: ${atkFumble},
        Knockdown Dice: ${atkKnockdownDice},
        Knockdown Adjustment: ${atkKnockdownAdj},
        Knockdown Roll Target: ${atkKnockdownRollTarget}
    `);

    console.log("Critical hit, fumble, and knockdown processing complete.");
});

/**
 * Function to roll secondary attack for critical hits or fumbles.
 */
async function performSecondaryAttack(actor, formula, targetAC, comparisonValue, rollType) {
    if (!game.user.isGM) return false; // Ensure only the GM can execute

    const secondaryRoll = new Roll(formula);
    await secondaryRoll.evaluate(); // Evaluate roll asynchronously

    await secondaryRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        flavor: rollType === "critical" ? "Critical Threat Roll" : "Fumble Confirmation Roll",
    });

    const secondaryRollResult = secondaryRoll.total;

    // Check the result for critical or fumble confirmation
    if ((rollType === "critical" && secondaryRollResult >= comparisonValue) || 
        (rollType === "fumble" && secondaryRollResult <= comparisonValue)) {
        console.log(`Secondary roll confirmed the ${rollType}!`);
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `<strong>Confirmed ${rollType === "critical" ? "Critical Hit" : "Fumble"}!</strong>`,
        });
        return true;
    } else {
        console.log(`Secondary roll did not confirm the ${rollType}.`);
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `<strong>${rollType === "critical" ? "Critical Hit Not Confirmed" : "Fumble Not Confirmed"}</strong>`,
        });
        return false;
    }
}
