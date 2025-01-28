class CombatHUDActions {
    static addButtonsToHUD(app, html, data) {
        if (!app.actor) return;

        const actionsGroup = html.find(".mini-actions-buttons");
        if (!actionsGroup.length) {
            console.warn("Actions group not found in ARS HUD.");
            return;
        }

        const buttons = [
            {
                class: "half-move-action",
                title: "Half-Move Action",
                icon: "fas fa-shoe-prints",
                onClick: async (actor) => {
                    await CombatHUDActions.addEffect(actor, "Moved", "icons/skills/movement/feet-winged-boots-glowing-yellow.webp");
                    await CombatHUDActions.delayTurnForActor(actor);
                },
            },
            {
                class: "attack-action",
                title: "Attack Action",
                icon: "fas fa-swords",
                onClick: async (actor) => {
                    await CombatHUDActions.addEffect(actor, "Attacked", "icons/skills/melee/weapons-crossed-swords-yellow.webp");
                    await CombatHUDActions.incrementFatigue(actor);
                    await CombatHUDActions.delayTurnForActor(actor);
                },
            },
            {
                class: "full-attack-action",
                title: "Full Attack",
                icon: "fas fa-crosshairs",
                onClick: async (actor) => {
                    await CombatHUDActions.incrementFatigue(actor);
                    await CombatHUDActions.endTurnForActor(actor);
                },
            },
        ];

        // Add GM-only "Reset Fatigue" button
        if (game.user.isGM) {
            buttons.push({
                class: "reset-fatigue",
                title: "Reset Fatigue",
                icon: "fas fa-undo",
                onClick: async (actor) => {
                    await CombatHUDActions.resetFatigue(actor);
                },
            });
        }

        buttons.forEach((button) => {
            if (actionsGroup.find(`.${button.class}`).length) return;
            const buttonHTML = `
                <li class="mini-action flexrow ${button.class}" title="${button.title}">
                    <div class="mini-action-button action-name rollable mini-action-init" data-type="action-name">
                        <i class="${button.icon}"></i>
                        <div class="item-name">${button.title}</div>
                    </div>
                </li>
            `;
            actionsGroup.prepend(buttonHTML);
            actionsGroup.find(`.${button.class}`).on("click", async () => {
                await button.onClick(app.actor);
            });
        });
    }

    static async addEffect(actor, effectName, effectIcon) {
        const effectData = {
            name: effectName,
            icon: effectIcon,
            origin: actor.uuid,
            changes: [],
            duration: { seconds: 600 }, // Temporary effect
        };
        await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }

    static async delayTurnForActor(actor) {
        const combat = game.combat;
        if (!combat) return;

        const combatant = combat.combatants.find((c) => c.actorId === actor.id);
        if (!combatant) return;

        const lastInit = combat._getLastInInitiative();
        if (combatant.id === combat.combatant?.id) {
            await combat.nextTurn(combatant);
        }
        await combatant.update({ initiative: lastInit + 1 });
    }

    static async endTurnForActor(actor) {
        const combat = game.combat;
        if (!combat) return;

        const combatant = combat.combatants.find((c) => c.actorId === actor.id);
        if (!combatant) return;

        if (combatant.id === combat.combatant?.id) {
            await combat.nextTurn();
        }
    }

    static async incrementFatigue(actor) {
        const currentFA = actor.getFlag("core", "currentFA") || 0;
        const maxFA = actor.getFlag("core", "maxFA") || 0;

        const newFA = currentFA + 1;
        await actor.setFlag("core", "currentFA", newFA);

        CombatHUDActions.updateEncumbrance(actor);
    }

    static async updateEncumbrance(actor) {
        const encumbranceTiers = [
            {
                id: "encumbrance-light",
                name: "Light Encumbrance",
                icon: "systems/ars/icons/general/encumbrance-light.png",
                changes: [],
            },
            {
                id: "encumbrance-moderate",
                name: "Moderate Encumbrance",
                icon: "systems/ars/icons/general/encumbrance-moderate.png",
                changes: [
                    { key: "system.mods.attack.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-1" },
                ],
            },
            {
                id: "encumbrance-heavy",
                name: "Heavy Encumbrance",
                icon: "systems/ars/icons/general/encumbrance-heavy.png",
                changes: [
                    { key: "system.mods.attack.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" },
                    { key: "system.mods.ac.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-1" },
                ],
            },
            {
                id: "encumbrance-severe",
                name: "Severe Encumbrance",
                icon: "systems/ars/icons/general/encumbrance-severe.png",
                changes: [
                    { key: "system.mods.attack.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-4" },
                    { key: "system.mods.ac.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-3" },
                ],
            },
        ];

        const currentFA = actor.getFlag("core", "currentFA") || 0;
        const maxFA = actor.getFlag("core", "maxFA") || 1;

        const targetTier = encumbranceTiers.reduce((result, tier, index) => {
            const threshold = maxFA * (index + 1);
            return currentFA >= threshold ? tier : result;
        }, null);

        if (!targetTier) return;

        const currentEffect = actor.effects.find((effect) =>
            encumbranceTiers.some((tier) => effect.statuses?.has(tier.id))
        );

        if (currentEffect) {
            const currentTierId = Array.from(currentEffect.statuses || [])[0];
            if (currentTierId === targetTier.id) return;

            await currentEffect.delete();
        }

        const effectData = {
            name: targetTier.name,
            icon: targetTier.icon,
            origin: "macro.manageEncumbrance",
            duration: { seconds: 600 },
            changes: targetTier.changes,
            statuses: [targetTier.id],
        };

        await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }

    static async resetFatigue(actor) {
        const encumbranceTiers = ["encumbrance-light", "encumbrance-moderate", "encumbrance-heavy", "encumbrance-severe"];
        const encumbranceEffects = actor.effects.filter((effect) =>
            effect.statuses?.some((status) => encumbranceTiers.includes(status))
        );
        for (const effect of encumbranceEffects) {
            await effect.delete();
        }

        await actor.setFlag("core", "currentFA", 0);
    }
}

// Hook into ARS Combat HUD rendering
Hooks.on("renderARSCombatHUD", CombatHUDActions.addButtonsToHUD);
