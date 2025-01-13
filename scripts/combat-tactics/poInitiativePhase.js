// Phases Definition
const PHASES = [
    { range: [0, 2], id: 1, name: "VF" }, // Very Fast
    { range: [3, 5], id: 2, name: "FA" }, // Fast
    { range: [6, 8], id: 3, name: "AV" }, // Average
    { range: [9, 11], id: 4, name: "SL" }, // Slow
    { range: [12, Infinity], id: 5, name: "VS" } // Very Slow
];

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
Hooks.on('createChatMessage', async (chatMessage) => {
    const roll = chatMessage.rolls?.[0];
    if (!roll) return; // Ignore non-roll messages

    const formula = roll.formula;
    const total = roll.total;
    console.log(`Chat message roll detected: ${formula}, Total: ${total}`);

    // Extract modifiers and calculate the phase
    const match = formula.match(/\+\s*(\d+)/); // Extract the first modifier (e.g., "+6")
    const initModifier = match ? parseInt(match[1], 10) : 0;
    const phase = getPhase(initModifier);

    console.log(`Calculated Phase: ${phase.name} (${initModifier})`);

    // Find the combatant associated with this roll
    const speaker = chatMessage.speaker;
    const combat = game.combats.active;
    if (!combat) {
        console.warn("No active combat found for initiative roll.");
        return;
    }

    const combatant = combat.combatants.find(c => c.token?.id === speaker.token);
    if (!combatant) {
        console.warn(`No combatant found for speaker: ${speaker.actor}`);
        return;
    }

    // Store the phase on the combatant
    await combatant.setFlag('world', 'initiativePhase', phase.name);
    console.log(`Set phase ${phase.name} for combatant ${combatant.name}`);

    // Trigger tracker re-render to update UI
    ui.combat.render(true);
});

// Hook: Render Combat Tracker and Display/Remove Phases
Hooks.on('renderCombatTracker', (app, html, data) => {
    const combatants = html.find('li.combatant.actor.directory-item');

    combatants.each((index, element) => {
        const combatantId = $(element).data('combatant-id');
        const combatant = app.viewed?.combatants?.find(c => c.id === combatantId);
        if (!combatant) return;

        // Get the stored phase
        const phase = combatant.getFlag('world', 'initiativePhase');
        const initiativeElement = $(element).find('.token-initiative');
        if (!initiativeElement.length) return;

        const initiativeValue = initiativeElement.text().trim();

        if (initiativeValue) {
            // Add phase dynamically
            const phaseIndicator = initiativeElement.find('.phase');
            if (!phaseIndicator.length) {
                initiativeElement.html(`${initiativeValue} <span class="phase" style="margin-left: 5px;">${phase}</span>`);
                console.log(`Added phase ${phase} to combatant ${combatant.name}`);
            }
        } else {
            // Remove phase if initiative is no longer displayed
            initiativeElement.find('.phase').remove();
            console.log(`Removed phase for combatant ${combatant.name}`);
        }
    });

    console.log("Combat tracker rendered with updated phases.");
});
