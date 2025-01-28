class CombatHUDActions {
    static addButtonsToHUD(app, html, data) {
        // Ensure the HUD is for a valid actor
        if (!app.actor) return;

        // Locate the `.mini-actions-buttons` section containing controls
        const actionsGroup = html.find(".mini-actions-buttons");
        if (!actionsGroup.length) {
            console.warn("Actions group not found in ARS HUD.");
            return;
        }

        // Define button configurations
        const buttons = [
            {
                class: "half-move-action",
                title: "Half-Move Action",
                icon: "fas fa-shoe-prints",
                effect: {
                    name: "Moved",
                    duration: 12, // Duration in seconds
                    icon: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
                    statusId: "moved",
                },
                onClick: async (actor) => {
                    // Apply the Moved effect
                    const effectData = {
                        name: "Moved",
                        duration: {
                            seconds: 12,
                        },
                        icon: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
                        origin: actor.uuid,
                        changes: [],
                        flags: {
                            core: {
                                statusId: "moved",
                            },
                        },
                    };
                    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

                    // Delay the turn
                    await CombatHUDActions.delayTurnForActor(actor);
                },
            },
            {
                class: "attack-action",
                title: "Attack Action",
                icon: "fas fa-swords", // Crossed swords icon
                effect: {
                    name: "Attacked",
                    duration: 12, // Duration in seconds
                    icon: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
                    statusId: "attacked",
                },
                onClick: async (actor) => {
                    // Apply the Attacked effect
                    const effectData = {
                        name: "Attacked",
                        duration: {
                            seconds: 12,
                        },
                        icon: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
                        origin: actor.uuid,
                        changes: [],
                        flags: {
                            core: {
                                statusId: "attacked",
                            },
                        },
                    };
                    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

                    // Increment Fatigue (currentFA)
                    const currentFA = actor.getFlag("core", "currentFA") || 0; // Default to 0 if undefined
                    await actor.setFlag("core", "currentFA", currentFA + 1); // Add 1 to currentFA

                    // Delay the turn
                    await CombatHUDActions.delayTurnForActor(actor);
                },
            },
            {
                class: "full-attack-action",
                title: "Full Attack",
                icon: "fas fa-crosshairs",
                onClick: async (actor) => {
                    // Increment Fatigue (currentFA)
                    const currentFA = actor.getFlag("core", "currentFA") || 0; // Default to 0 if undefined
                    await actor.setFlag("core", "currentFA", currentFA + 1); // Add 1 to currentFA

                    // End the actor's turn
                    await CombatHUDActions.endTurnForActor(actor);
                },
            },
        ];

        // Add buttons to the beginning of the HUD
        buttons.forEach((button) => {
            // Check if the button already exists to prevent duplicates
            if (actionsGroup.find(`.${button.class}`).length) return;

            // Insert the button
            const buttonHTML = `
                <li class="mini-action flexrow ${button.class}" title="${button.title}">
                    <div class="mini-action-button action-name rollable mini-action-init" data-type="action-name">
                        <i class="${button.icon}"></i>
                        <div class="item-name">${button.title}</div>
                    </div>
                </li>
            `;
            actionsGroup.prepend(buttonHTML); // Add to the beginning of the actions group

            // Add click event listener to the button
            actionsGroup.find(`.${button.class}`).on("click", async () => {
                await button.onClick(app.actor); // Invoke the button's specific action
            });
        });
    }

    static async delayTurnForActor(actor) {
        const combat = game.combat;
        if (!combat) {
            console.warn("No active combat found.");
            return;
        }

        const combatant = combat.combatants.find((c) => c.actorId === actor.id);
        if (!combatant) {
            console.warn("The actor is not part of the combat.");
            return;
        }

        // Calculate the new initiative
        const lastInit = combat._getLastInInitiative();
        console.log("Delaying turn for combatant:", combatant, "New initiative:", lastInit + 1);

        // Check if it's the combatant's turn and advance it
        if (combatant.id === combat.combatant?.id) {
            await combat.nextTurn(combatant);
        }

        // Update the combatant's initiative
        await combatant.update({ initiative: lastInit + 1 });
    }

    static async endTurnForActor(actor) {
        const combat = game.combat;
        if (!combat) {
            console.warn("No active combat found.");
            return;
        }

        const combatant = combat.combatants.find((c) => c.actorId === actor.id);
        if (!combatant) {
            console.warn("The actor is not part of the combat.");
            return;
        }

        // End the actor's turn by advancing to the next turn
        if (combatant.id === combat.combatant?.id) {
            await combat.nextTurn();
        }
    }
}

// Hook into ARS Combat HUD rendering
Hooks.on("renderARSCombatHUD", CombatHUDActions.addButtonsToHUD);
