// Phases Definition
const PHASES = [
    { range: [0, 2], id: 1, name: "VF" }, // Very Fast
    { range: [3, 4], id: 2, name: "FA" }, // Fast
    { range: [5, 7], id: 3, name: "AV" }, // Average
    { range: [8, 10], id: 4, name: "SL" }, // Slow
    { range: [11, Infinity], id: 5, name: "VS" } // Very Slow
];

// Helper: Format as Two-Digit Integer
function formatTwoDigit(num) {
    return num < 10 ? `0${num}` : `${num}`;
}

// Cap Initiative Values
function capInitiativeValue(phaseID, rollValue) {
    const cappedRoll = Math.max(1.01, Math.min(5.99, parseFloat(`${phaseID}.${formatTwoDigit(rollValue)}`)));
    return cappedRoll.toFixed(2); // Ensure two decimal places
}

// Determine Phase Based on Modifiers
function getPhase(initModifier) {
    for (const phase of PHASES) {
        if (initModifier >= phase.range[0] && initModifier <= phase.range[1]) {
            return phase;
        }
    }
    return { id: 3, name: "AV" }; // Default to Average
}

// Adjust Phase Based on Natural Roll
function adjustPhase(phaseID, naturalRoll) {
    if (naturalRoll === 1 && phaseID > 1) {
        return phaseID - 1; // Move to faster phase
    }
    if (naturalRoll === 10 && phaseID < 5) {
        return phaseID + 1; // Move to slower phase
    }
    return phaseID; // No change
}






// Hook: Capture Initiative Rolls via Chat Message
Hooks.on("createChatMessage", async (chatMessage) => {
    const enablePhases = game.settings.get("2e-players-option", "enableInitiPhases");
    if (!enablePhases) return;

    // Check if the message is flagged as a custom initiative roll
    const isCustomInitiativeRoll = chatMessage.flags.world?.isInitiativeRoll;

    // Attempt to detect standard initiative rolls
    const messageContent = chatMessage.content?.toLowerCase();
    const roll = chatMessage.rolls?.[0];

    // Stricter criteria for standard initiative rolls
    const isStandardInitiativeRoll = !!roll && messageContent?.includes("initiative");

    // If neither style matches, skip processing
    if (!isCustomInitiativeRoll && !isStandardInitiativeRoll) {
        console.log("Chat message is not recognized as an initiative roll. Ignoring.");
        return;
    }

    if (!roll) {
        console.log("No roll data found in chat message.");
        return;
    }

    const formula = roll.formula;
    const total = roll.total;
    console.log(`Initiative roll detected: ${formula}, Total: ${total}`);

    const match = formula.match(/\+\s*(\d+)/);
    const initModifier = match ? parseInt(match[1], 10) : 0;

    // Calculate natural roll
    const naturalRoll = total - initModifier;
    console.log(`Natural Roll: ${naturalRoll}`);

    // Get initial phase
    let phase = getPhase(initModifier);

    // Adjust phase based on natural roll
    const adjustedPhaseID = adjustPhase(phase.id, naturalRoll);
    phase = PHASES.find(p => p.id === adjustedPhaseID);
    console.log(`Adjusted Phase: ${phase.name} (${adjustedPhaseID})`);

    const speaker = chatMessage.speaker;
    const combat = game.combats.active;
    if (!combat) {
        console.warn("No active combat found for initiative roll.");
        return;
    }

    const combatant = combat.combatants.find((c) => c.token?.id === speaker.token);
    if (!combatant) {
        console.warn(`No combatant found for speaker: ${speaker.actor}`);
        return;
    }

    // Cap the initiative value
    const cappedRoll = capInitiativeValue(adjustedPhaseID, total);
    console.log(`Capped Initiative Value: ${cappedRoll}`);

    // Store all relevant data points as flags
    await combatant.setFlag("world", "initiativeData", {
        actorID: combatant.actor?.id,
        combatantID: combatant.id,
        actorName: combatant.actor?.name,
        roll: cappedRoll,
        naturalRoll,
        modifier: initModifier,
        phase: phase.name,
        phaseID: adjustedPhaseID
    });

    // Update the initiative with the capped value
    await combatant.update({ initiative: parseFloat(cappedRoll) });
    console.log(`Set initiative to ${cappedRoll} for combatant ${combatant.name}`);

    // Trigger sorting and tracker re-render
    ui.combat.render(true);
});











// Hook: Render Combat Tracker and Display/Remove Phases
Hooks.on("renderCombatTracker", (app, html, data) => {
    const enablePhases = game.settings.get("2e-players-option", "enableInitiPhases");
    if (!enablePhases) return;

    const combatants = html.find("li.combatant.actor.directory-item");

    combatants.each((index, element) => {
        const combatantId = $(element).data("combatant-id");
        const combatant = app.viewed?.combatants?.find((c) => c.id === combatantId);
        if (!combatant) return;

        const initiativeData = combatant.getFlag("world", "initiativeData");
        if (!initiativeData) return;

        const { phase, roll } = initiativeData;
        const initiativeElement = $(element).find(".token-initiative");
        if (!initiativeElement.length) return;

        const initiativeValue = initiativeElement.text().trim();

        if (initiativeValue) {
            // Show roll and phase only if initiative is visible
            initiativeElement.html(`${roll} ${phase}`);
            console.log(`Added phase ${phase} to combatant ${combatant.name}`);
        } else {
            // Remove phase if initiative is no longer displayed
            initiativeElement.find(".phase").remove();
            console.log(`Removed phase for combatant ${combatant.name}`);
        }
    });

    console.log("Combat tracker rendered with updated phases.");
});
