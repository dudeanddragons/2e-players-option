// Function to roll secondary attack for critical hits
async function performSecondaryAttack(actor, formula, targetAC, hitAC, damageType) {
    if (!game.user.isGM) return; // Ensure only the GM can execute

    const secondaryRoll = new Roll(formula);
    await secondaryRoll.evaluate();  // Asynchronous by default in v12, no need for async parameter

    await secondaryRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        flavor: "Critical Threat",
    });

    const secondaryRollResult = secondaryRoll.total;
    const acHit = actor.acHit(secondaryRollResult);

    // Check if the secondary roll confirms the critical hit
    if (acHit <= targetAC) {
        console.log("Secondary roll hit: Confirmed critical hit!");
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `<strong>Confirmed Critical Hit!</strong>`,
        });

        // Only the GM should open the critical hit dialog
        if (game.user.isGM) {
            await openCriticalHitDialog(damageType); // Pass the damageType to openCriticalHitDialog
        }
    } else {
        console.log("Secondary roll did not hit: Not a critical hit.");
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `<strong>Critical Hit Not Confirmed!</strong>`,
        });
    }
}