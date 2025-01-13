Hooks.on('renderActorSheet', (app, html, data) => {
    // Check if Fatigue is enabled in settings
    const isFatigueEnabled = game.settings.get("2e-players-option", "enableFatigue");
    if (!isFatigueEnabled) return;

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
                    <div><input type="number" class="fatigue-input" name="flags.core.baseFA" value="${app.object.getFlag('core', 'baseFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.bonusFA" value="${app.object.getFlag('core', 'bonusFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.currentFA" value="${app.object.getFlag('core', 'currentFA') || 0}" data-dtype="Number" /></div>
                    <div><input type="number" class="fatigue-input" name="flags.core.maxFA" value="${calculateMaxFA(app)}" data-dtype="Number" readonly /></div>
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
            await app.object.setFlag('core', name.split('.').pop(), value);

            // Automatically update Maximum FA
            const maxFA = calculateMaxFA(app);
            fatigueSection.find('input[name="flags.core.maxFA"]').val(maxFA);
        });

        console.log("Fatigue section added between Combat and Experience headers.");
    }
});

// ---- Helper Function to Calculate Maximum FA ---- //
function calculateMaxFA(app) {
    const baseFA = parseInt(app.object.getFlag('core', 'baseFA') || 0);
    const bonusFA = parseInt(app.object.getFlag('core', 'bonusFA') || 0);
    return baseFA + bonusFA;
}

// ---- Add Settings ---- //
Hooks.once('init', () => {
    game.settings.register("2e-players-option", "enableFatigue", {
        name: "Enable Fatigue System",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => window.location.reload() // Reload sheets when setting changes
    });
});
