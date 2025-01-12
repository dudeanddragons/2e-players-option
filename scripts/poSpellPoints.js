console.log("Spell Points Module: Script is loading!");

// Register Handlebars helper "divide"
Handlebars.registerHelper("divide", (value1, value2) => {
  return value2 === 0 ? 0 : (value1 / value2).toFixed(2);
});

// Utility functions for collapsibility
function getCollapseState(actorId, level) {
  const key = `spellLevel-${actorId}-${level}`;
  return localStorage.getItem(key) === "true";
}

function setCollapseState(actorId, level, state) {
  const key = `spellLevel-${actorId}-${level}`;
  localStorage.setItem(key, state);
}

function bindCollapsibility(html, actorId) {
  html.find(".spell-level-header").on("click", function () {
    const level = $(this).data("level");
    const isCollapsed = getCollapseState(actorId, level);
    setCollapseState(actorId, level, !isCollapsed);

    $(this).find("i").toggleClass("fa-angle-right fa-angle-down");
    $(this).next(".spell-level-group").toggle();
  });
}

// Spell Point Calculation Utilities
const spellPointConversion = { 0: 2, 1: 4, 2: 6, 3: 10, 4: 15, 5: 22, 6: 30, 7: 40, 8: 50, 9: 60 };

function calculateSpellPointsFromSlots(spellSlots) {
  return Object.keys(spellSlots).reduce((total, level) => {
    return total + (spellSlots[level] || 0) * (spellPointConversion[level] || 0);
  }, 0);
}

function calculateBonusSpellPoints(actor) {
  const intScore = actor.system.abilities?.int?.value || 0;
  const chaScore = actor.system.abilities?.cha?.value || 0;

  return actor.items.reduce((total, item) => {
    const name = item.name.toLowerCase();
    if (name.includes("mage") || name.includes("wizard")) return total + Math.max(0, Math.floor((intScore - 10) / 2));
    if (name.includes("bard")) return total + Math.max(0, Math.floor((chaScore - 10) / 2));
    return total;
  }, 0);
}

function getStatusBarColor(percentage) {
  return percentage > 75 ? "#4caf50" : percentage > 25 ? "#ffeb3b" : "#f44336";
}

async function updateActorSpellPoints(actor) {
  const spellSlots = actor.system.spellInfo?.slots?.arcane?.value || {};
  const maxSpellPoints = calculateSpellPointsFromSlots(spellSlots) + calculateBonusSpellPoints(actor);

  await actor.setFlag("2e-players-option", "maxSpellPoints", maxSpellPoints);

  const currentPoints = actor.getFlag("2e-players-option", "spellPoints") || maxSpellPoints;
  await actor.setFlag("2e-players-option", "spellPoints", Math.min(currentPoints, maxSpellPoints));

  console.log(`${actor.name}'s Spell Points updated. Max: ${maxSpellPoints}, Current: ${currentPoints}`);
}

// Rendering Hook
Hooks.once("ready", async () => {
  console.log("Spell Points Module: Ready hook triggered.");

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    await updateActorSpellPoints(actor);
  }
});

Hooks.on("renderActorSheet", async (sheet, html) => {
  const actor = sheet.actor;
  if (actor.type !== "character") return;

  console.log(`Rendering Spell Points for actor: ${actor.name}`);
  await updateActorSpellPoints(actor);

  const spellsByLevel = actor.items
    .filter((item) => item.type === "spell")
    .reduce((groups, spell) => {
      const level = spell.system.level || 0;
      if (!groups[level]) groups[level] = [];
      groups[level].push(spell);
      return groups;
    }, {});

  const percentage = (actor.getFlag("2e-players-option", "spellPoints") / actor.getFlag("2e-players-option", "maxSpellPoints")) * 100;
  const statusColor = getStatusBarColor(percentage);

  const htmlContent = await renderTemplate("modules/2e-players-option/templates/poSpellPoints.hbs", {
    flags: {
      po: {
        spellPoints: actor.getFlag("2e-players-option", "spellPoints"),
        maxSpellPoints: actor.getFlag("2e-players-option", "maxSpellPoints"),
      },
    },
    spellLevels: Object.keys(spellsByLevel).map((level) => ({
      level,
      isCollapsed: getCollapseState(actor.id, level),
      spells: spellsByLevel[level],
    })),
    spellPointConversion,
    statusColor,
  });

  const spellsTab = html.find('.tab[data-tab="spells"]');
  if (spellsTab.length) {
    spellsTab.append(htmlContent);
    bindCollapsibility(spellsTab, actor.id);

    spellsTab.find("#reset-spell-points").on("click", async () => {
      await actor.setFlag("2e-players-option", "spellPoints", actor.getFlag("2e-players-option", "maxSpellPoints"));
      console.log(`${actor.name}'s Spell Points reset.`);
      spellsTab.find(".po-spell-points-fill").css("width", "100%").css("background-color", "#4caf50");
    });
  }

          // Roll Initiative Action
          html.on('click', '.spell-init', async function (event) {
            if (!actor.isOwner) return;
            event.stopImmediatePropagation();

            const spellID = $(this).data("spell-id");
            const spellItem = actor.items.get(spellID);
            let initModifier = parseInt(spellItem.system.castingTime) || 0;
            if (isNaN(initModifier) || initModifier > 9) initModifier = 10;

            const roll = new Roll(`1d10 + ${initModifier}`);
            await roll.evaluate();

            roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: `Initiative Roll for ${spellItem.name}: 1d10 + ${initModifier}`,
            });

            const combatant = actor?.combatant;
            if (combatant) {
                await combatant.update({ initiative: roll.total });
            }
        });

        // Spell Name Click Action
        html.on('click', '.spell-name-clickable', async function (event) {
          if (!actor.isOwner) return;
          event.stopImmediatePropagation();
      
          const spellID = $(this).data("spell-id");
          const spellItem = actor.items.get(spellID);
          if (!spellItem) return ui.notifications.warn("Spell not found!");
      
          const context = {
              item: spellItem,
              sourceActor: actor,
              sourceToken: actor.token,
              event: { clientX: 200, clientY: 100 },
              popoutOptions: { left: 200, top: 100 }
          };
          spellItem._chatRoll(context);
      });

              // Cast Spell Action
              html.find(".spell-cast").off("click").on("click", async function (event) {
                event.preventDefault();
              
                // Retrieve the actor from the rendered sheet context
                const actorId = sheet.actor.id;
                const actor = game.actors.get(actorId);
              
                if (!actor) {
                  ui.notifications.error("Actor not found!");
                  console.error("Failed to retrieve actor with ID:", actorId);
                  return;
                }
              
                const spellId = $(this).data("spell-id");
                const spellItem = actor.items.get(spellId);
              
                if (!spellItem) {
                  ui.notifications.warn("Spell not found!");
                  console.error("Failed to find spell for ID:", spellId);
                  return;
                }
              
                // Determine spell level and cost
                const spellLevel = spellItem.system.level || 0;
                const spellCost = spellPointConversion[spellLevel] || 0;
              
                // Fetch current spell points
                const currentSpellPoints = actor.getFlag("2e-players-option", "spellPoints") || 0;
              
                // Check if the actor has enough spell points to cast
                if (currentSpellPoints >= spellCost) {
                  // Deduct spell points
                  const updatedPoints = currentSpellPoints - spellCost;
                  await actor.setFlag("2e-players-option", "spellPoints", updatedPoints);
              
                  // Use existing utility to update spell points and bar UI
                  await updateActorSpellPoints(actor);
              
                  // Log and notify
                  console.log(`${actor.name} casts "${spellItem.name}". Spell Points remaining: ${updatedPoints}`);
                  ChatMessage.create({
                    speaker: { actor: actor.id, alias: actor.name },
                    content: `${actor.name} casts <b>${spellItem.name}</b> (Level ${spellLevel}), consuming ${spellCost} spell points.`,
                  });
                } else {
                  ui.notifications.warn("Not enough spell points to cast this spell!");
                  console.warn(`${actor.name} does not have enough spell points to cast "${spellItem.name}".`);
                }
              });
              

});
