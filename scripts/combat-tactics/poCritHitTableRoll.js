/**
 * Critical Hit, Fumble, and Knockdown Processing Script
 * Automatically evaluates critical hits, fumbles, knockdowns, and renders critical hit dialogs when appropriate.
 */
Hooks.on("createChatMessage", async (chatMessage) => {
    // Ensure the message contains a roll
    const roll = chatMessage.rolls?.[0];
    if (!roll) return;

    const atkNaturalRoll = roll.dice?.[0]?.total || null; // Extract the natural roll
    if (atkNaturalRoll === null) return; // Exit if no roll is found

    // Extract settings for critical hits and fumbles
    const criticalHitOption = game.settings.get("2e-players-option", "criticalHitOption");
    const criticalMissOption = game.settings.get("2e-players-option", "criticalMissOption");

    // Exit early if both critical hit and fumble settings are disabled
    if (criticalHitOption === "none" && criticalMissOption === "none") return;

    console.log("Processing attack roll for critical hit, fumble, and knockdown...");

    // Extract roll metadata
    const atkTotalRoll = roll.total || null;
    const atkRollFormula = roll.formula || "Unknown Formula";

    // Extract actor and weapon details
    const atkActorUuid = chatMessage.flags.world?.context?.actorUuid || null;
    const atkActor = atkActorUuid ? await fromUuid(atkActorUuid) : null;
    const atkActorName = atkActor?.name || "Unknown Actor";

    const atkWeaponUuid = chatMessage.flags.world?.context?.itemUuid || null;
    const atkWeapon = atkWeaponUuid ? await fromUuid(atkWeaponUuid) : null;
    const atkWeaponName = atkWeapon?.name || "Unknown Weapon";

    // Fetch THAC0 and damage type
    const atkThac0 = atkActor?.system?.attributes?.thaco?.value;
    const atkDamageType = atkWeapon?.system?.damage?.type || "Unknown";

    // Fetch target details
    const atkTargetTokenUuid = chatMessage.flags.world?.context?.targetTokenUuid || null;
    const atkTargetToken = atkTargetTokenUuid ? await fromUuid(atkTargetTokenUuid) : null;
    const atkTargetName = atkTargetToken?.name || "Unknown Target";
    const atkTargetSize = atkTargetToken?.actor?.system?.attributes?.size || "Unknown";

    // Determine critical severity based on weapon size vs. target size
    const sizeHierarchy = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
    const atkWeaponSize = atkWeapon?.system?.attributes?.size || "medium";
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

    // Determine critical threat
    const atkCriticalThreat = atkNaturalRoll >= 18 && atkCriticalSeverity !== "Unknown";
    if (!atkCriticalThreat) return;

    console.log(`Critical hit detected! Weapon: ${atkWeaponName}, Severity: ${atkCriticalSeverity}`);

    // Render the critical hit dialog
    renderCritHitDialog(atkDamageType, atkCriticalSeverity, atkTargetName, atkTargetSize);
});

/**
 * Renders the critical hit dialog.
 */
async function renderCritHitDialog(damageType, severity, targetName, targetSize) {
    const locationTablePath = "modules/2e-players-option/scripts/combat-tactics/crit-tables/poTableCritLocations.json";
    const critTableBasePath = "modules/2e-players-option/scripts/combat-tactics/crit-tables/";

    // Fetch JSON helper
    async function fetchJSON(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.statusText}`);
            return await response.json();
        } catch (err) {
            console.error(`Error fetching JSON from ${filePath}:`, err);
            ui.notifications.error(`Error loading JSON: ${err.message}`);
        }
    }

    // Fetch location table data
    const locationData = await fetchJSON(locationTablePath);
    if (!locationData) return;

    // Generate location options
    function generateLocationOptions(entries) {
        const options = entries.map(entry => `<option value="${entry.location}">${entry.location}</option>`);
        options.unshift('<option value="random">Random</option>');
        return options.join("");
    }

    // Roll random location
    async function rollRandomLocation(entries, diceExpression) {
        const roll = await new Roll(diceExpression).evaluate({ async: true });
        const rolledValue = roll.total;
        const entry = entries.find(e => e.range.some(r => r === rolledValue));
        return entry ? entry.location : "Unknown";
    }

    // Dialog Rendering
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
                    <label for="target-name">Target:</label>
                    <input type="text" id="target-name" value="${targetName}" disabled>
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
                    const location = html.find("#location").val();
                    const critTablePath = `${critTableBasePath}poCrit${capitalizeFirstLetter(severity)}Humanoid${capitalizeFirstLetter(damageType)}.json`;
                    const critTable = await fetchJSON(critTablePath);

                    if (!critTable) {
                        ui.notifications.error("Critical hit table not found.");
                        return;
                    }

                    const critEntry = critTable.entries.find(entry => entry.location === location);
                    const effectsRoll = await new Roll("1d6").evaluate({ async: true });
                    const effect = critEntry.effects[effectsRoll.total - 1].effect;

                    ChatMessage.create({
                        content: `
                            <h2>Critical Hit Results</h2>
                            <p><strong>Target:</strong> ${targetName}</p>
                            <p><strong>Severity:</strong> ${capitalizeFirstLetter(severity)}</p>
                            <p><strong>Location:</strong> ${location}</p>
                            <p><strong>Effect:</strong> ${effect}</p>
                        `
                    });
                },
            },
            cancel: { label: "Cancel" },
        },
        render: (html) => {
            const locationField = html.find("#location");
            const locationTable = locationData.find(table => table.name === "poTblCritLocHumanoid");

            if (locationTable) {
                locationField.html(generateLocationOptions(locationTable.entries));
            } else {
                locationField.html('<option value="">No Locations Found</option>');
            }
        },
    }).render(true);
}

/**
 * Utility to capitalize the first letter.
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
