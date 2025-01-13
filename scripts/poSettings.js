Hooks.once('init', () => {
  game.settings.registerMenu("2e-players-option", "combatTacticsMenu", {
      name: "Combat & Tactics",
      label: "Configure Combat & Tactics",
      hint: "Configure options for combat and tactics.",
      icon: "fas fa-cogs",
      type: CombatTacticsConfig,
      restricted: true // Only GMs can access this menu
  });
});

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
          enableFatigue: game.settings.get("2e-players-option", "enableFatigue"), // Add Fatigue setting
          enableInitiPhases: game.settings.get("2e-players-option", "enableInitiPhases") // Add Initiative Phases setting
      };
  }

  async _updateObject(event, formData) {
      await game.settings.set("2e-players-option", "enable12SecondRounds", formData.enable12SecondRounds);
      await game.settings.set("2e-players-option", "advance600EndCombat", formData.advance600EndCombat);
      await game.settings.set("2e-players-option", "enableFatigue", formData.enableFatigue); // Save Fatigue setting
      await game.settings.set("2e-players-option", "enableInitiPhases", formData.enableInitiPhases); // Save Initiative Phases setting
      ui.notifications.info("Combat & Tactics settings have been updated!");
  }
}

Hooks.once('init', () => {
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
});
