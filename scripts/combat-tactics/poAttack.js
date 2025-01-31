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

    let atkCriticalSeverity = "unknown"; // Default to unknown
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
const defaultKnockdownDiceTable = ["1d4", "1d6", "1d8", "1d10", "1d12"];

// Fetch knockdown dice from weapon flags
let atkKnockdownDice = "1d4"; // Default to 1d4
if (atkWeapon) {
    const weaponKnockdownFlag = atkWeapon.getFlag("core", "knockdown");
    if (weaponKnockdownFlag) {
        atkKnockdownDice = weaponKnockdownFlag;
    } else {
        console.log(`Knockdown flag not set on weapon "${atkWeapon.name}". Using default value: ${atkKnockdownDice}`);
    }
}

// Adjust knockdown dice based on attacker size
const sizeAdjustment = sizeAdjustmentTable[atkActorSize.toLowerCase()] || 0;
const baseDiceIndex = defaultKnockdownDiceTable.indexOf(atkKnockdownDice);
const adjustedDiceIndex = Math.max(0, Math.min(defaultKnockdownDiceTable.length - 1, baseDiceIndex + sizeAdjustment));
const atkKnockdownAdj = defaultKnockdownDiceTable[adjustedDiceIndex];

if (atkAttackHit) {
    console.log(`Processing knockdown for target: ${atkTargetName} (UUID: ${atkTargetActorUuid}).`);

    // Ensure only the GM processes knockdown rolls
    if (!game.user.isGM) {
        console.log(`Skipping knockdown logic. Only the GM may process this.`);
        return;
    }

    // Roll the knockdown dice
    const knockdownRoll = new Roll(atkKnockdownAdj);
    await knockdownRoll.evaluate({ async: true });
    const knockdownRollResult = knockdownRoll.total;

    // Determine success or failure
    const knockdownSuccess = knockdownRollResult >= atkKnockdownRollTarget;
    const knockdownOutcome = knockdownSuccess ? "Success" : "Failure";

    console.log(`Knockdown roll result: ${knockdownRollResult} vs. target roll: ${atkKnockdownRollTarget} (${knockdownOutcome})`);

// Determine the header and save message
const knockdownHeader = knockdownSuccess 
    ? `<div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 5px; text-align: center; font-weight: bold; color: #155724;">
        ${atkTargetName} Knocked Down!
      </div>` 
    : `<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 5px; text-align: center; font-weight: bold; color: #721c24;">
        No Knockdown
      </div>`;

const saveMessage = knockdownSuccess 
    ? `<div style="text-align: center; font-style: italic; color: #856404; margin-top: 5px;">
        ${atkTargetName} must save vs. paralyzation or be knocked prone!
      </div>` 
    : "";

// Collapsible details styled to match
const detailedResults = `
    <details style="margin-top: 10px; padding: 5px; background-color: #fdfd96; border: 1px solid #f0e68c; border-radius: 4px;">
        <summary style="cursor: pointer; color: #856404; font-weight: bold;">Expand Details:</summary>
        <div style="margin-top: 5px; font-size: 0.9em; color: #444;">
            <p><strong>Attacker:</strong> ${atkActorName}</p>
            <p><strong>Target:</strong> ${atkTargetName}</p>
            <p><strong>Base Dice:</strong> ${atkKnockdownDice}</p>
            <p><strong>Adjusted Dice:</strong> ${atkKnockdownAdj}</p>
            <p><strong>Roll Result:</strong> ${knockdownRollResult}</p>
            <p><strong>Target Threshold:</strong> ${atkKnockdownRollTarget}</p>
        </div>
    </details>
`;

// Combine everything
const knockdownMessage = `
    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; background-color: #f8f9fa;">
        ${knockdownHeader}
        ${saveMessage}
        ${detailedResults}
    </div>
`;

// Post the chat message (as GM)
ChatMessage.create({
    speaker: { alias: atkActorName },
    content: knockdownMessage,
});



    }

    // Initialize critical hit and fumble flags
    let atkCriticalThreat = atkNaturalRoll >= atkCriticalRange && atkAttackHit;
    let atkCriticalHit = false;
    let atkFumbleThreat = atkNaturalRoll === 1;
    let atkFumble = false;

    // === Critical Event Attempt ===
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
    
    // Log the results
    const attackMetadata = {
        actor: { name: atkActorName, uuid: atkActorUuid, size: atkActorSize, thac0: atkThac0 },
        weapon: { name: atkWeaponName, uuid: atkWeaponUuid, size: atkWeaponSize, damageType: atkDamageType },
        target: { name: atkTargetName, uuid: atkTargetActorUuid, size: atkTargetSize, ac: atkTargetAc, hitAc: atkHitAc, hitBy: atkHitBy, attackHit: atkAttackHit },
        roll: { natural: atkNaturalRoll, total: atkTotalRoll, formula: atkRollFormula },
        critical: { threat: atkCriticalThreat, confirmed: atkCriticalHit, severity: atkCriticalSeverity },
        fumble: { threat: atkFumbleThreat, confirmed: atkFumble },
        knockdown: { dice: atkKnockdownDice, adjustment: atkKnockdownAdj, targetRoll: atkKnockdownRollTarget },
    };

    console.log("Attack Metadata:", attackMetadata);

    if (atkCriticalHit) {
        console.log(`Confirmed Critical Hit for ${atkActorName}. Calling processCriticalHit hook.`);
        Hooks.call("processCriticalHit", attackMetadata);
    }
    

    if (atkFumble) {
        console.log(`Confirmed Fumble for ${atkActorName} (UUID: ${atkActorUuid}). Processing fumble table result...`);
        await processFumbleResult(atkActorUuid, atkActorName);
    }
    
    
    
    


    
});

Hooks.on("processCriticalHit", (attackMetadata) => {
    if (!game.user.isGM) {
        console.log(`Critical hit dialog restricted to GMs.`);
        return;
    }

    const { weapon, target, critical, } = attackMetadata;
    const damageType = weapon?.damageType || "unknown";
    const severity = critical?.severity || "unknown";
    const targetName = target?.name || "Unknown Target";

    console.log(`Rendering critical hit dialog for target: ${targetName}, damage type: ${damageType}, severity: ${severity}.`);
    renderCritHitDialog(damageType, severity, targetName);
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

        const secondaryRollResult = secondaryRoll.total; // Total result of the roll
        const secondaryHitAC = atkThac0 - secondaryRollResult; // Calculate hit AC
        const naturalRoll = secondaryRoll.terms[0].results[0].result; // Extract the natural roll

        // Set the color of the natural roll based on its value
        const rollColor = naturalRoll === 1 ? "red" : naturalRoll === 20 ? "green" : "black";

        // Build the breakdown for bonuses only (excluding the initial dice roll)
        const bonuses = secondaryRoll.terms.slice(1) // Ignore the first term (1d20)
            .filter(term => typeof term.total === "number") // Include only numeric terms
            .map(term => `${term.operator || "+"} ${term.total}`) // Include the operator and value
            .join(" "); // Join them with spaces

        console.log(`Secondary Attack Roll Details:
            Roll Type: ${rollType},
            Target AC: ${targetAC},
            Secondary Roll Result: ${secondaryRollResult},
            Natural Roll: ${naturalRoll},
            Actor THAC0: ${atkThac0},
            Hit AC (Secondary Roll): ${secondaryHitAC}
        `);

        // Determine confirmation status using natural roll logic
        let confirmed = false;

        if (naturalRoll === 1) {
            // Natural 1 always fails to confirm a critical or always confirms a fumble
            confirmed = rollType === "fumble";
        } else if (naturalRoll === 20) {
            // Natural 20 always confirms a critical or always fails to confirm a fumble
            confirmed = rollType === "critical";
        } else {
            // Otherwise, use standard logic based on the calculated hit AC
            if (rollType === "critical" && secondaryHitAC <= targetAC) {
                confirmed = true;
            } else if (rollType === "fumble" && secondaryHitAC > targetAC) {
                confirmed = true;
            }
        }

        // Styling for confirmed or not confirmed
        const headerColor = confirmed ? "#d4edda" : "#f8d7da";
        const borderColor = confirmed ? "#c3e6cb" : "#f5c6cb";
        const textColor = confirmed ? "#155724" : "#721c24";

        // Generate result message
        const resultMessage = confirmed
            ? `<strong style="color: green;">${rollType === "critical" ? "Critical Confirmed!" : "Fumble Confirmed!"}</strong>`
            : `<strong style="color: red;">${rollType === "critical" ? "Critical Not Confirmed" : "Fumble Not Confirmed"}</strong>`;

        // Roll breakdown string with the dice icon behind the natural roll
        const rollBreakdown = `
            <span style="position: relative; display: inline-block; width: 30px; height: 30px; line-height: 30px; text-align: center; font-weight: bold; font-size: 1.2em; color: ${rollColor}; background: url('icons/svg/d20-grey.svg') no-repeat center; background-size: contain;">
                ${naturalRoll}
            </span> 
            ${bonuses ? bonuses : ""} = <strong>${secondaryRollResult}</strong>
        `;

        // Collapsible details
        const detailedResults = `
            <details style="margin-top: 10px; padding: 5px; background-color: #fdfd96; border: 1px solid #f0e68c; border-radius: 4px;">
                <summary style="cursor: pointer; color: #856404; font-weight: bold;">Expand Details:</summary>
                <div style="margin-top: 5px; font-size: 0.9em; color: #444;">
                    <p><strong>Roll Type:</strong> ${rollType}</p>
                    <p><strong>Roll Result:</strong> ${secondaryRollResult}</p>
                    <p><strong>Natural Roll:</strong> ${naturalRoll}</p>
                    <p><strong>Actor THAC0:</strong> ${atkThac0}</p>
                    <p><strong>Target AC:</strong> ${targetAC}</p>
                    <p><strong>Hit AC (Secondary Roll):</strong> ${secondaryHitAC}</p>
                </div>
            </details>
        `;

        // Combine everything into a styled message
        const secondaryRollMessage = `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; background-color: #f8f9fa;">
                <div style="background-color: ${headerColor}; border: 1px solid ${borderColor}; padding: 5px; text-align: center; font-weight: bold; color: ${textColor};">
                    ${rollType === "critical" ? "Critical Threat" : "Fumble Threat"}
                </div>
                <div style="text-align: center; margin-top: 5px; font-size: 1.1em; color: #333;">
                    ${rollBreakdown}
                </div>
                <div style="text-align: center; font-style: italic; color: #856404; margin-top: 5px;">
                    ${resultMessage}
                </div>
                ${detailedResults}
            </div>
        `;

        // Post the styled chat message
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: secondaryRollMessage,
        });

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
 * Renders the critical hit dialog.
 */
async function renderCritHitDialog(damageType, severity, targetName) {
    const locationTablePath = "modules/2e-players-option/scripts/combat-tactics/crit-tables/poTableCritLocations.json";

    const critTableFiles = {
        "poCritMajorHumanoidBludgeoning": "poCritHumanoidBludgeoningMajor.json",
        "poCritMinorHumanoidBludgeoning": "poCritHumanoidBludgeoningMinor.json",
        "poCritMortalHumanoidBludgeoning": "poCritHumanoidBludgeoningMortal.json",
        "poCritSevereHumanoidBludgeoning": "poCritHumanoidBludgeoningSevere.json",
        "poCritMajorHumanoidPiercing": "poCritHumanoidPiercingMajor.json",
        "poCritMinorHumanoidPiercing": "poCritHumanoidPiercingMinor.json",
        "poCritMortalHumanoidPiercing": "poCritHumanoidPiercingMortal.json",
        "poCritSevereHumanoidPiercing": "poCritHumanoidPiercingSevere.json",
        "poCritMajorHumanoidSlashing": "poCritHumanoidSlashingMajor.json",
        "poCritMinorHumanoidSlashing": "poCritHumanoidSlashingMinor.json",
        "poCritMortalHumanoidSlashing": "poCritHumanoidSlashingMortal.json",
        "poCritSevereHumanoidSlashing": "poCritHumanoidSlashingSevere.json",
        "poCritMajorAnimalBludgeoning": "poCritAnimalBludgeoningMajor.json",
        "poCritMinorAnimalBludgeoning": "poCritAnimalBludgeoningMinor.json",
        "poCritMortalAnimalBludgeoning": "poCritAnimalBludgeoningMortal.json",
        "poCritSevereAnimalBludgeoning": "poCritAnimalBludgeoningSevere.json",
        "poCritMajorAnimalPiercing": "poCritAnimalPiercingMajor.json",
        "poCritMortalAnimalPiercing": "poCritAnimalPiercingMortal.json",
        "poCritSevereAnimalPiercing": "poCritAnimalPiercingSevere.json",
        "poCritMinorAnimalPiercing": "poCritAnimalPiercingMinor.json",
        "poCritMajorAnimalSlashing": "poCritAnimalSlashingMajor.json",
        "poCritMinorAnimalSlashing": "poCritAnimalSlashingMinor.json",
        "poCritMortalAnimalSlashing": "poCritAnimalSlashingMortal.json",
        "poCritSevereAnimalSlashing": "poCritAnimalSlashingSevere.json",
        "poCritMajorMonsterBludgeoning": "poCritMonsterBludgeoningMajor.json",
        "poCritMinorMonsterBludgeoning": "poCritMonsterBludgeoningMinor.json",
        "poCritMortalMonsterBludgeoning": "poCritMonsterBludgeoningMortal.json",
        "poCritSevereMonsterBludgeoning": "poCritMonsterBludgeoningSevere.json",
        "poCritMajorMonsterPiercing": "poCritMonsterPiercingMajor.json",
        "poCritMinorMonsterPiercing": "poCritMonsterPiercingMinor.json",
        "poCritMortalMonsterPiercing": "poCritMonsterPiercingMortal.json",
        "poCritSevereMonsterPiercing": "poCritMonsterPiercingSevere.json",
        "poCritMajorMonsterSlashing": "poCritMonsterSlashingMajor.json",
        "poCritMinorMonsterSlashing": "poCritMonsterSlashingMinor.json",
        "poCritMortalMonsterSlashing": "poCritMonsterSlashingMortal.json",
        "poCritSevereMonsterSlashing": "poCritMonsterSlashingSevere.json"
    };

    async function fetchJSON(filePath) {
        try {
            console.log(`Fetching JSON from: ${filePath}`);
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.statusText}`);
            return await response.json();
        } catch (err) {
            console.error(`Error fetching JSON from ${filePath}:`, err);
            ui.notifications.error(`Error loading JSON: ${err.message}`);
        }
    }

    const locationData = await fetchJSON(locationTablePath);
    if (!locationData) return;

    function generateLocationOptions(entries) {
        const options = entries.map(entry => `<option value="${entry.location}">${entry.location}</option>`);
        options.unshift('<option value="random">Random</option>');
        return options.join("");
    }

    new Dialog({
        title: "Critical Hit Details",
        content: `
            <form>
                <div class="form-group">
                    <label for="damage-type">Damage Type:</label>
                    <select id="damage-type">
                        <option value="bludgeoning" ${damageType === "bludgeoning" ? "selected" : ""}>Bludgeoning</option>
                        <option value="piercing" ${damageType === "piercing" ? "selected" : ""}>Piercing</option>
                        <option value="slashing" ${damageType === "slashing" ? "selected" : ""}>Slashing</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="severity">Severity:</label>
                    <select id="severity">
                        <option value="minor" ${severity.toLowerCase() === "minor" ? "selected" : ""}>Minor</option>
                        <option value="major" ${severity.toLowerCase() === "major" ? "selected" : ""}>Major</option>
                        <option value="severe" ${severity.toLowerCase() === "severe" ? "selected" : ""}>Severe</option>
                        <option value="mortal" ${severity.toLowerCase() === "mortal" ? "selected" : ""}>Mortal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="creature-type">Creature Type:</label>
                    <select id="creature-type">
                        <option value="humanoid" selected>Humanoid</option>
                        <option value="animal">Animal</option>
                        <option value="monster">Monster</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="location">Location:</label>
                    <select id="location">
                        <option value="">Loading...</option>
                    </select>
                </div>
            </form>
        `,
        buttons: {
            confirm: {
                label: "Confirm",
                callback: async (html) => {
                    const selectedDamageType = html.find("#damage-type").val();
                    const selectedSeverity = html.find("#severity").val();
                    const creatureType = html.find("#creature-type").val();
                    const location = html.find("#location").val();
    
                    const constructedName = `poCrit${capitalizeFirstLetter(selectedSeverity)}${capitalizeFirstLetter(creatureType)}${capitalizeFirstLetter(selectedDamageType)}`;
                    const critTableFile = critTableFiles[constructedName];
                    const critTablePath = `modules/2e-players-option/scripts/combat-tactics/crit-tables/${critTableFile}`;
    
                    if (!critTableFile) {
                        ui.notifications.error(`Critical hit table mapping not found for: ${constructedName}`);
                        return;
                    }
    
                    const critTable = await fetchJSON(critTablePath);
    
                    if (!critTable) {
                        ui.notifications.error(`Critical hit table not found at: ${critTablePath}`);
                        return;
                    }
    
                    // Handle random location
                    let finalLocation = location;
                    if (location === "random") {
                        const locationTableName = `poTblCritLoc${capitalizeFirstLetter(creatureType)}`;
                        const locationTable = locationData.find(table => table.name === locationTableName);
    
                        if (!locationTable) {
                            ui.notifications.error("Location table not found for random selection.");
                            return;
                        }
    
                        finalLocation = await rollRandomLocation(locationTable.entries, locationTable.roll.dice);
                    }
    
                    const critEntry = critTable.entries.find(entry => entry.location === finalLocation);
                    if (!critEntry) {
                        ui.notifications.error(`No entry found for location: ${finalLocation}`);
                        return;
                    }
    
                    const effectsRoll = await new Roll("1d6").evaluate({ async: true });
                    const effect = critEntry.effects[effectsRoll.total - 1].effect;
    
                    ChatMessage.create({
                        content: `
                            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; background-color: #f8f9fa;">
                                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 5px; text-align: center; font-weight: bold; font-size: 1.2em; color: #155724;">
                                    ${capitalizeFirstLetter(selectedSeverity)} Critical Hit - ${capitalizeFirstLetter(finalLocation)}
                                </div>
                                <div style="text-align: center; margin-top: 5px; font-size: 1.1em; color: #333;">
                                    ${effect}
                                </div>
                                <details style="margin-top: 10px; padding: 5px; background-color: #fdfd96; border: 1px solid #f0e68c; border-radius: 4px;">
                                    <summary style="cursor: pointer; color: #856404; font-weight: bold;">Expand Details:</summary>
                                    <div style="margin-top: 5px; font-size: 0.9em; color: #444;">
                                        <p><strong>Creature Type:</strong> ${capitalizeFirstLetter(creatureType)}</p>
                                        <p><strong>Weapon Type:</strong> ${capitalizeFirstLetter(selectedDamageType)}</p>
                                    </div>
                                </details>
                            </div>
                        `
                    });
                    
                },
            },
            cancel: { label: "Cancel" },
        },
        render: (html) => {
            const creatureTypeField = html.find("#creature-type");
            const locationField = html.find("#location");
    
            const updateLocationDropdown = () => {
                const creatureType = creatureTypeField.val();
                const locationTableName = `poTblCritLoc${capitalizeFirstLetter(creatureType)}`;
                const locationTable = locationData.find(table => table.name === locationTableName);
    
                if (locationTable) {
                    locationField.html(generateLocationOptions(locationTable.entries));
                } else {
                    locationField.html('<option value="">No Locations Found</option>');
                }
            };
    
            updateLocationDropdown();
            creatureTypeField.on("change", updateLocationDropdown);
        },
    }).render(true);
    
}

async function rollRandomLocation(entries, diceExpression) {
    const roll = await new Roll(diceExpression).evaluate({ async: true });
    const rolledValue = roll.total;
    const entry = entries.find(e => e.range.some(r => r === rolledValue));
    return entry ? entry.location : "Unknown";
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * Process the fumble table result.
 * Rolls on the main fumble table and handles any required subtables.
 * @param {string} actorUuid - The UUID of the actor tied to the fumble.
 * @param {string} actorName - The display name of the actor.
 */
async function processFumbleResult(actorUuid, actorName) {
    const actor = await fromUuid(actorUuid);

    // Check if the fumble table has already been processed for this actor
    if (await actor.getFlag("world", "fumbleProcessed")) {
        console.log(`Fumble already processed for ${actorName}. Skipping.`);
        return; // Prevent duplicate processing
    }

    // Set the flag to indicate fumble processing is underway
    await actor.setFlag("world", "fumbleProcessed", true);

    // Roll on the main fumble table
    const fumbleRoll = new Roll("1d20");
    await fumbleRoll.evaluate({ async: true });
    const fumbleResult = fumbleRoll.total;

    console.log(`Fumble Table Roll for ${actorName} (UUID: ${actorUuid}): ${fumbleResult}`);

    // Define the fumble message
    let fumbleMessage = "";
    let secondaryResultMessage = null;

    // Switch logic for fumble results
    switch (true) {
        case fumbleResult <= 2:
            secondaryResultMessage = await rollArmorTrouble(actorUuid, actorName); // Armor Trouble Subtable
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
            secondaryResultMessage = await rollMountTrouble(actorUuid, actorName); // Mount Trouble Subtable
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
            secondaryResultMessage = await rollWeaponTrouble(actorUuid, actorName); // Weapon Trouble Subtable
            break;
    }

    // Combine the main and secondary results
    const finalMessage = [fumbleMessage, secondaryResultMessage].filter(Boolean).join("<br>");

    // Send a single chat message
    if (finalMessage) {
        ChatMessage.create({
            speaker: { alias: actorName },
            content: `<strong>Fumble Result:</strong> ${finalMessage}`,
        });
    }

    // Clear the flag after processing
    console.log(`Clearing fumbleProcessed flag for ${actorName}.`);
    await actor.unsetFlag("world", "fumbleProcessed");
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