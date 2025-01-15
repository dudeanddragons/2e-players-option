//--------------------------//
// Log Attack Roll Metadata //
//--------------------------//
(async () => {
    console.log("Searching for the most recent attack roll in chat messages...");

    // Fetch the most recent chat message
    const chatMessages = game.messages.contents;
    if (!chatMessages.length) {
        console.log("No chat messages found.");
        return;
    }

    const chatMessage = chatMessages[chatMessages.length - 1];
    const roll = chatMessage.rolls?.[0];
    const isARSAttackRoll = roll?.isAttack === true;
    const isCustomAttackRoll = chatMessage.flags.world?.context?.actorUuid && chatMessage.flags.world?.context?.itemUuid;

    if (!isARSAttackRoll && !isCustomAttackRoll) {
        console.log("The most recent chat message is not an attack roll.");
        return;
    }

    // Extract roll details
    const atkNaturalRoll = roll?.dice?.[0]?.total || null;
    const atkTotalRoll = roll?.total || null;
    const atkRollFormula = roll?.formula || "Unknown Formula";

    // Extract weapon and actor information
    const atkActorUuid = chatMessage.flags.world?.context?.actorUuid || "Unknown Actor UUID";
    const atkActor = await fromUuid(atkActorUuid);
    const atkActorName = atkActor?.name || "Unknown Actor";

    // Fetch actor size
    const atkActorSize = atkActor?.system?.attributes?.size || "medium";

    const atkWeaponUuid = chatMessage.flags.world?.context?.itemUuid || "Unknown Weapon UUID";
    const atkWeapon = await fromUuid(atkWeaponUuid);
    const atkWeaponName = atkWeapon?.name || "Unknown Weapon";

    // Fetch weapon size, default to actor size if missing
    let atkWeaponSize = atkWeapon?.system?.attributes?.size || atkActorSize;

    // Fetch weapon damage type, default to "slashing" if missing
    const atkWeaponDamageType = atkWeapon?.system?.damage?.type || "slashing";

    // Determine default knockdown dice based on actor size
    const defaultKnockdownDiceTable = {
        tiny: "1d4",
        small: "1d6",
        medium: "1d8",
        large: "1d10",
        huge: "1d12",
        gargantuan: "1d12",
    };

    let atkKnockdownDice = atkWeapon?.flags?.core?.knockdown || defaultKnockdownDiceTable[atkActorSize.toLowerCase()];

    // Adjust knockdown dice based on weapon size compared to medium
    const sizeHierarchy = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
    const sizeIndex = sizeHierarchy.indexOf(atkWeaponSize.toLowerCase());
    const mediumIndex = sizeHierarchy.indexOf("medium");
    const sizeDifference = sizeIndex - mediumIndex;

    // Adjust knockdown dice by size difference, capping at 1d4 and 1d12
    const diceSteps = ["1d4", "1d6", "1d8", "1d10", "1d12"];
    let currentDiceIndex = diceSteps.indexOf(atkKnockdownDice);
    if (currentDiceIndex === -1) currentDiceIndex = diceSteps.indexOf("1d8"); // Default to medium if not found
    currentDiceIndex = Math.max(0, Math.min(diceSteps.length - 1, currentDiceIndex + sizeDifference));
    atkKnockdownDice = diceSteps[currentDiceIndex];

    // Extract weapon properties and filter for "Crit:" values
    const atkCriticalProperties = Object.values(atkWeapon?.system?.attributes?.properties || {})
        .filter((value) => typeof value === "string" && value.toLowerCase().startsWith("crit:"))
        .join(", ");

    // Extract critical modifier from properties
    const atkCriticalModifierMatch = atkCriticalProperties.match(/crit:\s*(-?\d+)/i);
    const atkCriticalModifier = atkCriticalModifierMatch ? parseInt(atkCriticalModifierMatch[1], 10) : 0;

    // Calculate critical threat range
    let atkCriticalRange = 18 - atkCriticalModifier;
    atkCriticalRange = Math.max(15, Math.min(atkCriticalRange, 20)); // Cap at 15 (lower bound) and 20 (upper bound)

    // Extract target information
    const atkTargetTokenUuid = chatMessage.flags.world?.context?.targetTokenUuid || "Unknown Target UUID";
    const atkTargetToken = await fromUuid(atkTargetTokenUuid);
    const atkTargetName = atkTargetToken?.name || "No Target";

    // Fetch target size
    const atkTargetSize = atkTargetToken?.actor?.system?.attributes?.size || "Unknown Size";

    // Determine knockdown roll target
    const knockdownRollTable = {
        tiny: 3,
        small: 5,
        medium: 7,
        large: 9,
        huge: 11,
        gargantuan: 12,
    };
    const atkKnockdownRollTarget = knockdownRollTable[atkTargetSize.toLowerCase()] || "Unknown";

    // Preprocess content to remove HTML tags
    const rawContent = chatMessage.content || "";
    const strippedContent = rawContent.replace(/<\/?[^>]+(>|$)/g, ""); // Remove all HTML tags

    // Handle special cases for "Critical AC" and "Fumble"
    let atkHitAc = null;
    if (atkNaturalRoll === 1) {
        const fumbleMatch = strippedContent.match(/(?:Hit\s+AC|Critical\s+AC)\s+(-?\d+)/i);
        if (fumbleMatch) {
            atkHitAc = parseInt(fumbleMatch[1], 10); // Extract numeric AC value
        }

        // Extract "Missed by X" value
        const missedByMatch = strippedContent.match(/by\s+(-?\d+)/i);
        if (missedByMatch) {
            const missedBy = parseInt(missedByMatch[1], 10); // Convert "Missed by X" to X
            atkHitAc = atkHitAc || null; // Use atkHitAc if available
        }
    } else {
        const atkHitAcMatch = strippedContent.match(/(?:Hit\s+AC|Critical\s+AC)\s+(-?\d+)/i);
        if (atkHitAcMatch) {
            atkHitAc = parseInt(atkHitAcMatch[1], 10); // Extract numeric AC value
        }
    }

    // Extract "Target AC" value
    const atkTargetAcMatch = strippedContent.match(/Target\s+AC\s+(-?\d+)/i);
    const atkTargetAc = atkTargetAcMatch ? parseInt(atkTargetAcMatch[1], 10) : null;

    // Calculate "Hit By"
    const atkHitBy = atkHitAc !== null && atkTargetAc !== null ? atkTargetAc - atkHitAc : "Unknown";

    // Determine attack hit flag
    const atkAttackHit = atkHitBy !== "Unknown" && atkHitBy >= 0;

    // Determine critical threat
    const atkCriticalThreat = atkNaturalRoll !== null && atkNaturalRoll >= atkCriticalRange && atkAttackHit;

    // Determine critical hit
    const atkCriticalHit = atkCriticalThreat && atkHitBy !== "Unknown" && atkHitBy >= 5;

    // Determine fumble threat and fumble
    const atkFumbleThreat = atkNaturalRoll === 1;
    const atkFumble = atkFumbleThreat && atkHitBy !== "Unknown" && atkHitBy <= -5;

    // Log metadata
    console.log(`Attack Metadata:
        atkActor: ${atkActorName} (UUID: ${atkActorUuid}),
        atkActorSize: ${atkActorSize},
        atkWeapon: ${atkWeaponName} (UUID: ${atkWeaponUuid}),
        atkWeaponSize: ${atkWeaponSize},
        atkWeaponDamageType: ${atkWeaponDamageType},
        atkKnockdownDice: ${atkKnockdownDice},
        atkCriticalProperties: ${atkCriticalProperties || "None"},
        atkCriticalRange: ${atkCriticalRange},
        atkTarget: ${atkTargetName} (UUID: ${atkTargetTokenUuid}),
        atkTargetSize: ${atkTargetSize},
        atkKnockdownRollTarget: ${atkKnockdownRollTarget},
        atkNaturalRoll: ${atkNaturalRoll},
        atkTotalRoll: ${atkTotalRoll},
        atkRollFormula: ${atkRollFormula},
        atkHitAc: ${atkHitAc ?? "Unknown"},
        atkTargetAc: ${atkTargetAc ?? "Unknown"},
        atkHitBy: ${atkHitBy},
        atkAttackHit: ${atkAttackHit},
        atkCriticalThreat: ${atkCriticalThreat},
        atkCriticalHit: ${atkCriticalHit},
        atkFumbleThreat: ${atkFumbleThreat},
        atkFumble: ${atkFumble}
    `);

    console.log("Most recent attack roll processed.");
})();


//-------------------------//
// Log Initiative Metadata //
//-------------------------//
(async () => {
    console.log("Searching for the most recent chat message...");

    // Fetch all chat messages
    const chatMessages = game.messages.contents;
    if (!chatMessages.length) {
        console.log("No chat messages found.");
        return;
    }

    // Get the most recent chat message
    const chatMessage = chatMessages[chatMessages.length - 1];
    console.log("Last Chat Message Data:", chatMessage);

    // Check if this message appears to be an initiative roll
    const roll = chatMessage.rolls?.[0];
    if (!roll) {
        console.log("No roll data found in the most recent message.");
        return;
    }

    const isInitiativeRoll =
        chatMessage.content.includes("Initiative") || // Check for "Initiative" in the message content
        chatMessage.flags.world?.initiativeRoll ||   // Check if a specific flag exists
        chatMessage.flags.world?.context?.rollType === "initiative"; // Common structured flag

    if (!isInitiativeRoll) {
        console.log("The most recent chat message is not recognized as an initiative roll.");
        return;
    }

    // Extract roll details
    const initNaturalRoll = roll.dice?.[0]?.total || null; // Natural roll from the first die
    const initTotalRoll = roll.total || null;             // Total after modifiers
    const initRollFormula = roll.formula || "Unknown Formula";

    // Determine critical event
    let initCriticalEvent = 0; // Default to no critical event
    if (initNaturalRoll === 1) {
        initCriticalEvent = -1; // Fumble
    } else if (initNaturalRoll === 10) {
        initCriticalEvent = 1; // Critical
    }

    // Extract bonuses by parsing the roll formula
    const initBonusMatch = initRollFormula.match(/(?:\+|-)\s*\d+/g); // Match bonuses (e.g., +6 or -3)
    const initBonuses = initBonusMatch ? initBonusMatch.map(bonus => parseInt(bonus.replace(/\s+/g, ""), 10)) : [];
    const initTotalBonus = initBonuses.reduce((sum, bonus) => sum + bonus, 0);

    // Calculate the initiative phase
    let initPhase = 3; // Default phase
    if (initTotalBonus >= 0 && initTotalBonus <= 2) initPhase = 1;
    else if (initTotalBonus >= 3 && initTotalBonus <= 4) initPhase = 2;
    else if (initTotalBonus >= 8 && initTotalBonus <= 10) initPhase = 4;
    else if (initTotalBonus >= 11) initPhase = 5;

    // Adjust for critical events and calculate initPhaseFinal
    const initPhaseFinal = Math.max(1, Math.min(5, initPhase + initCriticalEvent));

    // Map phase names based on initPhase
    const initPhaseNameMap = {
        1: "VF",
        2: "FA",
        3: "AV",
        4: "SL",
        5: "VS",
    };
    const initPhaseName = initPhaseNameMap[initPhase] || "Unknown Phase";
    const initPhaseNameFinal = initPhaseNameMap[initPhaseFinal] || "Unknown Phase";

    // Fetch the actor UUID and resolve actor data
    let initActorUuid = chatMessage.speaker?.actor || "Unknown Actor UUID";
    let initActorName = "Unknown Actor";

    if (initActorUuid !== "Unknown Actor UUID") {
        initActorUuid = `Actor.${initActorUuid}`; // Ensure the correct prefix
        const initActor = await fromUuid(initActorUuid); // Use `fromUuid` to resolve the actor
        if (initActor) {
            initActorName = initActor.name; // Get actor name directly
        } else {
            console.warn(`Could not resolve actor from UUID: ${initActorUuid}`);
        }
    }

    // Log the initiative metadata
    console.log(`Initiative Metadata:
        initActorUuid: ${initActorUuid},
        initActor: ${initActorName},
        initNaturalRoll: ${initNaturalRoll ?? "Unknown"},
        initTotalRoll: ${initTotalRoll ?? "Unknown"},
        initRollFormula: ${initRollFormula ?? "Unknown"},
        initBonuses: ${initBonuses.length > 0 ? initBonuses.join(", ") : "None"},
        initTotalBonus: ${initTotalBonus},
        initPhase: ${initPhase},
        initPhaseName: ${initPhaseName},
        initCriticalEvent: ${initCriticalEvent},
        initPhaseFinal: ${initPhaseFinal},
        initPhaseNameFinal: ${initPhaseNameFinal}
    `);

    console.log("Initiative roll successfully processed.");
})();



//-----------------------------//
// Log Combat Tracker Metadata //
//-----------------------------//
(async () => {
    console.log("Fetching actor statuses from the combat tracker...");

    const combat = game.combat;
    if (!combat) {
        console.log("No active combat found.");
        return;
    }

    const combatants = combat.combatants;

    const combatantData = combatants.map(combatant => {
        const actor = combatant.actor;

        return {
            cbtActorName: actor?.name || "Unknown Actor",
            cbtActorUuid: actor ? `Actor.${actor.id}` : "Unknown Actor UUID",
            cbtVisibility: combatant.hidden ? "Hidden" : "Visible",
            cbtDefeated: combatant.defeated ? "Defeated" : "Active",
            cbtTargeted: game.user.targets.has(combatant.token?.object) ? "Targeted" : "Not Targeted",
            cbtCasting: combatant.flags?.world?.initCasting === true, // Fetch the casting state from world flags
            cbtInitiative: combatant.initiative || "No Initiative Rolled",
        };
    });

    console.log("Combat Tracker Data:");
    combatantData.forEach(data => {
        console.log(`
            cbtActorName: ${data.cbtActorName},
            cbtActorUuid: ${data.cbtActorUuid},
            cbtVisibility: ${data.cbtVisibility},
            cbtDefeated: ${data.cbtDefeated},
            cbtTargeted: ${data.cbtTargeted},
            cbtCasting: ${data.cbtCasting},
            cbtInitiative: ${data.cbtInitiative}
        `);
    });

    return combatantData;
})();
