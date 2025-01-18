Hooks.once('init', () => {
    // Register the Combat & Tactics menu
    game.settings.registerMenu("2e-players-option", "combatTacticsMenu", {
        name: "Combat & Tactics",
        label: "Configure Combat & Tactics",
        hint: "Configure options for combat and tactics.",
        icon: "fas fa-cogs",
        type: CombatTacticsConfig,
        restricted: true // Only GMs can access this menu
    });

    // Register individual settings
    game.settings.register("2e-players-option", "enable12SecondRounds", {
        name: "Enable 12-Second Combat Rounds",
        scope: "world",
        config: false, // Hide from default settings menu
        type: Boolean,
        default: false
    });

    game.settings.register("2e-players-option", "advance600EndCombat", {
        name: "Advance 600 Seconds (1 Turn) After Combat",
        scope: "world",
        config: false, // Hide from default settings menu
        type: Boolean,
        default: false
    });

    // Register Fatigue system setting
    game.settings.register("2e-players-option", "enableFatigue", {
        name: "Enable Fatigue System",
        scope: "world",
        config: false, // Hide from default settings menu
        type: Boolean,
        default: true
    });

    // Register Initiative Phases setting
    game.settings.register("2e-players-option", "enableInitiPhases", {
        name: "Enable Initiative Phases",
        hint: "Display and sort combatants by initiative phases (Very Fast, Fast, Average, Slow, Very Slow).",
        scope: "world",
        config: false, // Hide from default settings menu
        type: Boolean,
        default: true
    });

    // Register individual settings
    game.settings.register("2e-players-option", "criticalHitOption", {
        name: "Critical Hit Option",
        hint: "Select the rule for determining a critical hit.",
        scope: "world",
        config: false, // Hide from default settings menu
        type: String,
        choices: {
            none: "None",
            natural20: "Natural 20",
            natural20Plus5: "Natural 20+5",
            natural20Reroll: "Natural 20 Reroll",
            natural18Plus5: "Natural 18+5",
            natural18Reroll: "Natural 18 Reroll"
        },
        default: "none"
    });

    game.settings.register("2e-players-option", "criticalMissOption", {
        name: "Critical Miss Option",
        hint: "Select the rule for determining a critical miss.",
        scope: "world",
        config: false, // Hide from default settings menu
        type: String,
        choices: {
            none: "None",
            natural1: "Natural 1",
            natural1Minus5: "Natural 1-5",
            natural1Reroll: "Natural 1 Reroll"
        },
        default: "none"
    });
});

// Update the CombatTacticsConfig class
class CombatTacticsConfig extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: "Combat & Tactics Settings",
            id: "combat-tactics-config",
            template: "modules/2e-players-option/templates/poCombatTacticsConfig.hbs",
            width: 500,
            closeOnSubmit: true,
            submitOnChange: false,
            submitOnClose: false
        });
    }

    async getData() {
        return {
            enable12SecondRounds: game.settings.get("2e-players-option", "enable12SecondRounds"),
            advance600EndCombat: game.settings.get("2e-players-option", "advance600EndCombat"),
            enableFatigue: game.settings.get("2e-players-option", "enableFatigue"),
            enableInitiPhases: game.settings.get("2e-players-option", "enableInitiPhases"),
            criticalHitOption: game.settings.get("2e-players-option", "criticalHitOption"), // Add Critical Hit option
            criticalMissOption: game.settings.get("2e-players-option", "criticalMissOption") // Add Critical Miss option
        };
    }

    async _updateObject(event, formData) {
        await game.settings.set("2e-players-option", "enable12SecondRounds", formData.enable12SecondRounds);
        await game.settings.set("2e-players-option", "advance600EndCombat", formData.advance600EndCombat);
        await game.settings.set("2e-players-option", "enableFatigue", formData.enableFatigue);
        await game.settings.set("2e-players-option", "enableInitiPhases", formData.enableInitiPhases);
        await game.settings.set("2e-players-option", "criticalHitOption", formData.criticalHitOption); // Save Critical Hit option
        await game.settings.set("2e-players-option", "criticalMissOption", formData.criticalMissOption); // Save Critical Miss option
        ui.notifications.info("Combat & Tactics settings have been updated!");
    }
}

