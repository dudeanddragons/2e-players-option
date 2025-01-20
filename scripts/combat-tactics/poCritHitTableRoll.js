/**
 * Critical Hit Processing Script
 */
Hooks.on("createChatMessage", async (chatMessage) => {
    const roll = chatMessage.rolls?.[0];
    if (!roll) return;

    const atkNaturalRoll = roll.dice?.[0]?.total || null;
    if (atkNaturalRoll === null) return;

    const criticalHitOption = game.settings.get("2e-players-option", "criticalHitOption");
    if (criticalHitOption === "none") return;

    const atkActorUuid = chatMessage.flags.world?.context?.actorUuid || null;
    const atkActor = atkActorUuid ? await fromUuid(atkActorUuid) : null;
    const atkWeaponUuid = chatMessage.flags.world?.context?.itemUuid || null;
    const atkWeapon = atkWeaponUuid ? await fromUuid(atkWeaponUuid) : null;

    const atkDamageType = atkWeapon?.system?.damage?.type || "Unknown";
    const atkTargetTokenUuid = chatMessage.flags.world?.context?.targetTokenUuid || null;
    const atkTargetToken = atkTargetTokenUuid ? await fromUuid(atkTargetTokenUuid) : null;
    const atkTargetName = atkTargetToken?.name || "Unknown Target";

    const atkWeaponSize = atkWeapon?.system?.attributes?.size || "medium";
    const atkTargetSize = atkTargetToken?.actor?.system?.attributes?.size || "Unknown";

    const sizeHierarchy = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
    const atkWeaponSizeIndex = sizeHierarchy.indexOf(atkWeaponSize.toLowerCase());
    const atkTargetSizeIndex = sizeHierarchy.indexOf(atkTargetSize.toLowerCase());

    let atkCriticalSeverity = "Unknown";
    if (atkWeaponSizeIndex >= 0 && atkTargetSizeIndex >= 0) {
        const sizeDifference = atkWeaponSizeIndex - atkTargetSizeIndex;
        if (sizeDifference < 0) atkCriticalSeverity = "minor";
        else if (sizeDifference === 0) atkCriticalSeverity = "major";
        else if (sizeDifference === 1) atkCriticalSeverity = "severe";
        else if (sizeDifference >= 2) atkCriticalSeverity = "mortal";
    }

    const atkCriticalThreat = atkNaturalRoll >= 18 && atkCriticalSeverity !== "Unknown";
    if (!atkCriticalThreat) return;

    renderCritHitDialog(atkDamageType, atkCriticalSeverity, atkTargetName);
});

/**
 * Renders the critical hit dialog.
 */
async function renderCritHitDialog(damageType, severity, targetName) {
    const locationTablePath = "modules/2e-players-option/scripts/combat-tactics/crit-tables/poTableCritLocations.json";

    const critTableFiles = {
        "poCritMajorHumanoidBludgeoning": "poCritHumanoidBludgeoningMajor.json",
        "poCritMinorHumanoidBludgeoning": "poCritHumanoidBludgeoningMinor.json",
        "poCritMortalHumanoidBludgeoning": "poCritHumanoidBludgeoningMortal.json",
        "poCritSevereHumanoidBludgeoning": "poCritHumanoidBludgeoningSevere.json",
        "poCritMajorHumanoidPiercing": "poCritHumanoidPiercingMajor.json",
        "poCritMinorHumanoidPiercing": "poCritHumanoidPiercingMinor.json",
        "poCritMortalHumanoidPiercing": "poCritHumanoidPiercingMortal.json",
        "poCritSevereHumanoidPiercing": "poCritHumanoidPiercingSevere.json",
        "poCritMajorHumanoidSlashing": "poCritHumanoidSlashingMajor.json",
        "poCritMinorHumanoidSlashing": "poCritHumanoidSlashingMinor.json",
        "poCritMortalHumanoidSlashing": "poCritHumanoidSlashingMortal.json",
        "poCritSevereHumanoidSlashing": "poCritHumanoidSlashingSevere.json",
    };

    async function fetchJSON(filePath) {
        try {
            console.log(`Fetching JSON from: ${filePath}`);
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.statusText}`);
            return await response.json();
        } catch (err) {
            console.error(`Error fetching JSON from ${filePath}:`, err);
            ui.notifications.error(`Error loading JSON: ${err.message}`);
        }
    }

    const locationData = await fetchJSON(locationTablePath);
    if (!locationData) return;

    function generateLocationOptions(entries) {
        const options = entries.map(entry => `<option value="${entry.location}">${entry.location}</option>`);
        options.unshift('<option value="random">Random</option>');
        return options.join("");
    }

    new Dialog({
        title: "Critical Hit Details",
        content: `
            <form>
                <div class="form-group">
                    <label for="damage-type">Damage Type:</label>
                    <input type="text" id="damage-type" value="${capitalizeFirstLetter(damageType)}" disabled>
                </div>
                <div class="form-group">
                    <label for="severity">Severity:</label>
                    <input type="text" id="severity" value="${capitalizeFirstLetter(severity)}" disabled>
                </div>
                <div class="form-group">
                    <label for="creature-type">Creature Type:</label>
                    <select id="creature-type">
                        <option value="humanoid" selected>Humanoid</option>
                        <option value="animal">Animal</option>
                        <option value="monster">Monster</option>
                        <option value="snakefish">SnakeFish</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="location">Location:</label>
                    <select id="location">
                        <option value="">Loading...</option>
                    </select>
                </div>
            </form>
        `,
        buttons: {
            confirm: {
                label: "Confirm",
                callback: async (html) => {
                    const creatureType = html.find("#creature-type").val();
                    const location = html.find("#location").val();
                    const constructedName = `poCrit${capitalizeFirstLetter(severity)}${capitalizeFirstLetter(creatureType)}${capitalizeFirstLetter(damageType)}`;
                    const critTableFile = critTableFiles[constructedName];
                    const critTablePath = `modules/2e-players-option/scripts/combat-tactics/crit-tables/${critTableFile}`;

                    if (!critTableFile) {
                        ui.notifications.error(`Critical hit table mapping not found for: ${constructedName}`);
                        return;
                    }

                    const critTable = await fetchJSON(critTablePath);

                    if (!critTable) {
                        ui.notifications.error(`Critical hit table not found at: ${critTablePath}`);
                        return;
                    }

                    // Handle random location
                    let finalLocation = location;
                    if (location === "random") {
                        const locationTableName = `poTblCritLoc${capitalizeFirstLetter(creatureType)}`;
                        const locationTable = locationData.find(table => table.name === locationTableName);

                        if (!locationTable) {
                            ui.notifications.error("Location table not found for random selection.");
                            return;
                        }

                        finalLocation = await rollRandomLocation(locationTable.entries, locationTable.roll.dice);
                    }

                    const critEntry = critTable.entries.find(entry => entry.location === finalLocation);
                    if (!critEntry) {
                        ui.notifications.error(`No entry found for location: ${finalLocation}`);
                        return;
                    }

                    const effectsRoll = await new Roll("1d6").evaluate({ async: true });
                    const effect = critEntry.effects[effectsRoll.total - 1].effect;

                    ChatMessage.create({
                        content: `
                            <h2>Critical Hit Results</h2>
                            <p><strong>Target:</strong> ${targetName}</p>
                            <p><strong>Creature Type:</strong> ${capitalizeFirstLetter(creatureType)}</p>
                            <p><strong>Severity:</strong> ${capitalizeFirstLetter(severity)}</p>
                            <p><strong>Location:</strong> ${finalLocation}</p>
                            <p><strong>Effect:</strong> ${effect}</p>
                        `
                    });
                },
            },
            cancel: { label: "Cancel" },
        },
        render: (html) => {
            const creatureTypeField = html.find("#creature-type");
            const locationField = html.find("#location");

            const updateLocationDropdown = () => {
                const creatureType = creatureTypeField.val();
                const locationTableName = `poTblCritLoc${capitalizeFirstLetter(creatureType)}`;
                const locationTable = locationData.find(table => table.name === locationTableName);

                if (locationTable) {
                    locationField.html(generateLocationOptions(locationTable.entries));
                } else {
                    locationField.html('<option value="">No Locations Found</option>');
                }
            };

            updateLocationDropdown();
            creatureTypeField.on("change", updateLocationDropdown);
        },
    }).render(true);
}

async function rollRandomLocation(entries, diceExpression) {
    const roll = await new Roll(diceExpression).evaluate({ async: true });
    const rolledValue = roll.total;
    const entry = entries.find(e => e.range.some(r => r === rolledValue));
    return entry ? entry.location : "Unknown";
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
