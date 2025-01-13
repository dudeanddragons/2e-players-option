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

// Determine Phase Based on Modifiers
function getPhase(initModifier) {
    for (const phase of PHASES) {
        if (initModifier >= phase.range[0] && initModifier <= phase.range[1]) {
            return phase;
        }
    }
    return { id: 3, name: "AV" }; // Default to Average
}

// Hook: Capture Initiative Rolls via Chat Message
Hooks.on("createChatMessage", async (chatMessage) => {
    const enablePhases = game.settings.get("2e-players-option", "enableInitiPhases");
    if (!enablePhases) return;

    const roll = chatMessage.rolls?.[0];
    if (!roll) return;

    const formula = roll.formula;
    const total = roll.total;
    console.log(`Chat message roll detected: ${formula}, Total: ${total}`);

    const match = formula.match(/\+\s*(\d+)/);
    const initModifier = match ? parseInt(match[1], 10) : 0;
    const phase = getPhase(initModifier);

    console.log(`Calculated Phase: ${phase.name} (${initModifier})`);

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

    // Update the roll with the phase ID prefix
    const formattedRoll = `${phase.id}.${formatTwoDigit(total)}`;
    const updatedRoll = parseFloat(formattedRoll);
    console.log(`Updated Roll with Phase ID: ${formattedRoll}`);

    // Store all relevant data points as flags
    await combatant.setFlag("world", "initiativeData", {
        actorID: combatant.actor?.id,
        combatantID: combatant.id,
        actorName: combatant.actor?.name,
        roll: formattedRoll,
        modifier: initModifier,
        phase: phase.name,
        phaseID: phase.id
    });

    // Update the initiative with the new formatted roll
    await combatant.update({ initiative: updatedRoll });
    console.log(`Set initiative to ${formattedRoll} for combatant ${combatant.name}`);

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
