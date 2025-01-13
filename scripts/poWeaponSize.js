Hooks.on('renderItemSheet', (app, html, data) => {
    // Ensure this applies only to valid item types
    const validItemTypes = ['item', 'container', 'armor', 'weapon', 'potion', 'spell', 'currency'];
    if (!validItemTypes.includes(data.item.type)) return;

    // Locate the header row and data row
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

    // Insert the "Size" header between "Weight" and "Cost" in the header row
    const weightHeader = headerRow.find('.item-weight');
    weightHeader.after(sizeHeader);

    // Insert the "Size" dropdown between "Weight" and "Cost" in the data row
    const weightDropdown = dataRow.find('.item-weight');
    weightDropdown.after(sizeDropdown);

    console.log("Size header and dropdown successfully inserted.");
});
