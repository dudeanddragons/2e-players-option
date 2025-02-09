Hooks.on('renderActorSheet', async (app, html, data) => {
    // Check if Fatigue is enabled in settings
    const isFatigueEnabled = game.settings.get("2e-players-option", "enableFatigue");
    if (!isFatigueEnabled) return;

    // Ensure the actor is valid
    const actor = app.object;
    if (!actor) return;

    // If the actor is an NPC, ensure it has an appropriate base FA and max FA
    if (actor.type === "npc") {
        const hitDice = getNPC_HD(actor); // Retrieve HD dynamically
        const expectedBaseFA = calculateNPCBaseFA(hitDice);
        
        // Get stored values
        const currentBaseFA = actor.getFlag('core', 'baseFA') || 0;
        const currentMaxFA = actor.getFlag('core', 'maxFA') || 0;

        // If values do not match expected, update them
        if (currentBaseFA !== expectedBaseFA) {
            await actor.setFlag('core', 'baseFA', expectedBaseFA);
        }
        if (currentMaxFA !== expectedBaseFA) { 
            await actor.setFlag('core', 'maxFA', expectedBaseFA); // Ensure maxFA matches baseFA for NPCs
        }
    }

    // Locate the Combat section header
    const combatSection = html.find('.general-header[data-vs-control="combatDetails"]');
    const experienceSection = html.find('.general-header[data-vs-control="exp"]');

    if (combatSection.length && experienceSection.length) {
        // Create the Fatigue section
        const fatigueSection = $(`
            <div class="general-header ars_clps" data-vs-control="fatigue">
                <label>${game.i18n.localize("Fatigue") || "Fatigue"}</label>
            </div>
            <div class="ars_clps_container">
                <div class="general-subheader flexrow">
                    <label class="general-label">Base FA</label>
                    <label class="general-label">Bonus FA</label>
                    <label class="general-label">Current FA</label>
                    <label class="general-label">Maximum FA</label>
                </div>
                <div class="general-config flexrow">
                    <div><input type="number" class="fatigue-input" name="flags.core.baseFA" value="${actor.getFlag('core', 'baseFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.bonusFA" value="${actor.getFlag('core', 'bonusFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.currentFA" value="${actor.getFlag('core', 'currentFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.maxFA" value="${actor.getFlag('core', 'maxFA') || calculateMaxFA(actor)}" data-dtype="Number" readonly /></div>
                </div>
            </div>
        `);

        // Insert the Fatigue section between Combat and Experience sections
        combatSection.parent().after(fatigueSection);

        // Bind change events to save data and update Maximum FA
        fatigueSection.find('.fatigue-input').on('change', async (event) => {
            const input = event.target;
            const value = parseInt(input.value) || 0;
            const name = input.name;

            // Save the value to flags
            await actor.setFlag('core', name.split('.').pop(), value);

            // Automatically update Maximum FA
            const maxFA = calculateMaxFA(actor);
            fatigueSection.find('input[name="flags.core.maxFA"]').val(maxFA);
        });

        console.log("Fatigue section added between Combat and Experience headers.");
    }
});

// ---- Helper Function to Calculate Maximum FA ---- //
function calculateMaxFA(actor) {
    const baseFA = parseInt(actor.getFlag('core', 'baseFA') || 0);
    const bonusFA = parseInt(actor.getFlag('core', 'bonusFA') || 0);
    return baseFA + bonusFA;
}

// ---- Helper Function to Determine NPC Base FA ---- //
function calculateNPCBaseFA(hitDice) {
    return hitDice > 0 ? 8 + (hitDice - 1) : 8; // 8 base, +1 per HD after 1
}

// ---- FIXED: Retrieve NPC Hit Dice from `actor.system.hitdice` ---- //
function getNPC_HD(actor) {
    let hd = actor.system.hitdice || "1"; // Default to "1" if missing
    return parseInt(hd) || 1; // Convert to integer, default to 1
}
