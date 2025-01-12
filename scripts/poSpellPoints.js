console.log("Spell Points Module: Script is loading!");

Hooks.once("ready", async () => {
  console.log("Spell Points Module: Ready hook triggered.");

  // Initialize the flags for spell points if not already set
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;

    const current = actor.getFlag("2e-players-option", "spellPoints");
    const max = actor.getFlag("2e-players-option", "maxSpellPoints");

    if (current === undefined || max === undefined) {
      console.log(`Initializing Spell Points for actor: ${actor.name}`);
      await actor.setFlag("2e-players-option", "spellPoints", 0);
      await actor.setFlag("2e-players-option", "maxSpellPoints", 0);
    }
  }
});

Hooks.on("renderActorSheet", async (sheet, html, data) => {
  const actor = sheet.actor;
  if (actor.type !== "character") return;

  const spellPointsData = {
    current: actor.getFlag("2e-players-option", "spellPoints") || 0,
    max: actor.getFlag("2e-players-option", "maxSpellPoints") || 0,
  };

  const spellPointsHtml = await renderTemplate("modules/2e-players-option/templates/poSpellPoints.hbs", {
    flags: {
      po: {
        spellPoints: spellPointsData.current,
        maxSpellPoints: spellPointsData.max,
      },
    },
  });

  const spellsTab = html.find('.tab[data-tab="spells"]');
  if (spellsTab.length) {
    spellsTab.append(spellPointsHtml);

    // Add listeners for updates
    spellsTab.find(".spell-points-input").on("change", async (event) => {
      const value = parseInt(event.target.value, 10) || 0;
      await actor.setFlag("2e-players-option", "spellPoints", value);
    });

    spellsTab.find(".max-spell-points-input").on("change", async (event) => {
      const value = parseInt(event.target.value, 10) || 0;
      await actor.setFlag("2e-players-option", "maxSpellPoints", value);
    });
  }
});


