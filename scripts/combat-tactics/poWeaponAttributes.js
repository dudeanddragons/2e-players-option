Hooks.on('renderItemSheet', (app, html, data) => {
    // Ensure this applies only to valid item types
    const validItemTypes = ['item', 'container', 'armor', 'weapon', 'potion', 'spell', 'currency'];
    if (!validItemTypes.includes(data.item.type)) return;

    // ---- Size Field ---- //
    const headerRow = html.find('.flexrow.general-header');
    const dataRow = html.find('.item-header-input.flexrow');

    // Create "Size" header
    const sizeHeader = $(`<div class="item-size short-number"><label class="resource-label">${game.i18n.localize("ARS.size")}</label></div>`);

    // Create "Size" dropdown
    const sizeDropdown = $(`
        <div class="item-size short-number">
            <select class="resource selector" name="system.attributes.size">
                ${Object.entries(CONFIG.ARS.sizeTypes).map(([key, label]) =>
                    `<option value="${key}" ${key === data.item.system.attributes.size ? 'selected' : ''}>${game.i18n.localize(label)}</option>`
                ).join('')}
            </select>
        </div>
    `);

    // Insert "Size" header and dropdown
    const weightHeader = headerRow.find('.item-weight');
    weightHeader.after(sizeHeader);
    const weightDropdown = dataRow.find('.item-weight');
    weightDropdown.after(sizeDropdown);

    // ---- Knockdown Field ---- //
    const attackHeader = html.find('div.tab[data-tab="description"] .item.item-titles .weapon-attack .flexrow');
    const attackInputs = html.find('div.tab[data-tab="description"] .item-input.flexrow').first();

    // Ensure both sections exist
    if (attackHeader.length && attackInputs.length) {
        // Add Knockdown header
        const knockdownHeader = $(`<label>${game.i18n.localize("Knockdown") || "Knockdown"}</label>`);
        attackHeader.append(knockdownHeader);

        // Retrieve the Knockdown value from the item's flags
        const knockdownValue = app.object.getFlag("core", "knockdown") || "1d4";

        // Add Knockdown dropdown
        const knockdownDropdown = $(`
            <div class="item-knockdown short-number">
                <select class="selector" name="flags.core.knockdown">
                    <option value="1d4" ${knockdownValue === "1d4" ? "selected" : ""}>1d4</option>
                    <option value="1d6" ${knockdownValue === "1d6" ? "selected" : ""}>1d6</option>
                    <option value="1d8" ${knockdownValue === "1d8" ? "selected" : ""}>1d8</option>
                    <option value="1d10" ${knockdownValue === "1d10" ? "selected" : ""}>1d10</option>
                    <option value="1d12" ${knockdownValue === "1d12" ? "selected" : ""}>1d12</option>
                </select>
            </div>
        `);
        attackInputs.append(knockdownDropdown);

        // Bind change event to save the Knockdown value as a flag
        knockdownDropdown.find('select').on('change', async (event) => {
            const newValue = event.target.value;

            // Save the value to the item's flags
            await app.object.setFlag("core", "knockdown", newValue);

            console.log(`Knockdown value saved as: ${newValue}`);
        });
    }
});

Hooks.on('preCreateItem', (item, data, options, userId) => {
    // Initialize the Knockdown flag for new weapon items
    if (item.type === 'weapon') {
        const defaultKnockdown = "1d4";
        item.setFlag("core", "knockdown", defaultKnockdown).then(() => {
            console.log(`Knockdown flag initialized to: ${defaultKnockdown}`);
        });
    }
});
