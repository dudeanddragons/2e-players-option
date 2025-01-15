(async () => {
    console.log("Searching for attack rolls in recent chat messages...");

    // Fetch recent chat messages
    const chatMessages = game.messages.contents;
    console.log(`Found ${chatMessages.length} chat messages.`);

    for (const chatMessage of chatMessages) {
        const roll = chatMessage.rolls?.[0];
        const isARSAttackRoll = roll?.isAttack === true;
        const isCustomAttackRoll = chatMessage.flags.world?.context?.actorUuid && chatMessage.flags.world?.context?.itemUuid;

        if (!isARSAttackRoll && !isCustomAttackRoll) {
            console.log(`Skipping non-attack message: ${chatMessage.id}`);
            continue;
        }

        // Extract roll details
        const naturalRoll = roll?.dice?.[0]?.total || null;
        const total = roll?.total || null;
        const formula = roll?.formula || "Unknown Formula";

        // Extract weapon and actor information
        const actorUuid = chatMessage.flags.world?.context?.actorUuid || "Unknown Actor UUID";
        const actor = await fromUuid(actorUuid);
        const actorName = actor?.name || "Unknown Actor";

        const weaponUuid = chatMessage.flags.world?.context?.itemUuid || "Unknown Weapon UUID";
        const weapon = await fromUuid(weaponUuid);
        const weaponName = weapon?.name || "Unknown Weapon";

        // Extract weapon size (if available)
        const weaponSize = weapon?.system?.attributes?.size || "Unknown Size";

        // Extract target information
        const targetTokenUuid = chatMessage.flags.world?.context?.targetTokenUuid || "Unknown Target UUID";
        const targetToken = await fromUuid(targetTokenUuid);
        const targetName = targetToken?.name || "No Target";

        // Extract "Hit AC" value
        const hitAcMatch = chatMessage.content.match(/Hit\s+AC\s+(\d+)/i); // Look for "Hit AC X"
        const hitAc = hitAcMatch ? parseInt(hitAcMatch[1], 10) : "Unknown";

        // Extract "Hit By" value
        const hitByMatch = chatMessage.content.match(/Hit\s+by\s+(\d+)/i); // Look for "Hit by X"
        const hitBy = hitByMatch ? parseInt(hitByMatch[1], 10) : "Unknown";

        // Log metadata
        console.log(`Attack Metadata:
            Actor: ${actorName} (UUID: ${actorUuid}),
            Weapon: ${weaponName} (UUID: ${weaponUuid}),
            Weapon Size: ${weaponSize},
            Target: ${targetName} (UUID: ${targetTokenUuid}),
            Natural Roll: ${naturalRoll},
            Total Roll: ${total},
            Formula: ${formula},
            Hit AC: ${hitAc},
            Hit By: ${hitBy}
        `);
    }

    console.log("Attack roll search complete.");
})();
