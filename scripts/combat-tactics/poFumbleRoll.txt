/**
 * Handles fumble results.
 * Reads fumble metadata from chatMessage.flags.world.context and outputs a message to chat when confirmed.
 */
Hooks.on("createChatMessage", async (chatMessage) => {
    console.log("Checking chat message for fumble metadata...");

    // Fetch the metadata from the chat message
    const metadata = chatMessage.flags.world?.context;
    if (!metadata) {
        console.warn("No metadata found in message flags.");
        return;
    }

    console.log("Fetched metadata from message flags:", metadata);

    // Check if the fumbled flag exists and is true
    if (!metadata.fumbled) {
        console.log("No fumble data found or fumbled is not true.");
        return;
    }

    console.log("Fumble confirmed! Proceeding with fumble roll...");

    // Fetch the actor object to get the name
    const actor = await fromUuid(metadata.actorUuid);
    const actorName = actor?.name || "Unknown Actor";

    // Define a simple fumble result table
    const fumbleTable = [
        "You stumble slightly, causing you to lose your footing. Your next movement is halved.",
        "Your weapon slips from your grip and clatters noisily to the ground at your feet.",
        "You swing wide and overbalance, leaving you in a compromising position. Enemies gain advantage on their next attack against you.",
        "Your attack misses spectacularly, and you accidentally step on your own foot. No damage, but it hurts your pride.",
        "You fumble with your weapon, and it spins awkwardly in your hands. No one is hurt, but you look foolish.",
        "You lose track of your target for a moment, accidentally aiming at nothing but air.",
        "Your swing pulls you slightly off course, causing you to turn in place. You must spend your next movement reorienting yourself.",
        "Your attack is so off-target that you inadvertently create a breeze, ruffling everyone's hair dramatically.",
        "You drop a piece of your equipment, such as a belt pouch or a quiver, at your feet.",
        "Your weapon catches on your clothing, pulling at it awkwardly and leaving you slightly embarrassed.",
        "Your attack causes you to twist your wrist awkwardly. You have disadvantage on your next weapon attack roll.",
        "You manage to kick up a cloud of dust or dirt, partially obscuring your vision until the start of your next turn.",
        "Your weapon slips from your hand and lands noisily, startling an ally nearby.",
        "You swing wildly and hit a tree, wall, or other environmental object nearby instead of your target.",
        "Your attack misses, and the force causes you to spin halfway around, facing the wrong direction until your next turn.",
        "You accidentally knock over a small object or piece of equipment in your immediate area.",
        "Your grip slips slightly, and your weapon feels awkward to wield until the end of your next turn.",
        "You misjudge your strike and accidentally kick a small rock or piece of debris, sending it clattering.",
        "Your focus wavers, and you accidentally mutter a phrase that makes no sense. Everyone nearby hears it.",
        "Your attack misses, but your movements are so exaggerated they look more like a performance than combat.",
        "You briefly forget how to hold your weapon properly, fumbling it awkwardly before recovering.",
        "Your armor creaks loudly as you move, giving away your position to anyone listening nearby.",
        "You misstep slightly and kick over a nearby object, such as a small barrel or crate.",
        "Your aim is so far off that even your target looks confused for a moment.",
        "You accidentally grab at the wrong part of your weapon, momentarily losing your grip.",
        "You get your foot stuck in a loose patch of mud, requiring an extra movement to free it.",
        "Your swing tangles you in your own gear, causing you to look ridiculous but sustaining no harm.",
        "You trip slightly on an uneven surface, catching yourself just in time to avoid falling prone.",
        "Your attack is so poorly executed that it looks like you're attempting a dance move.",
        "You accidentally step on the hem of your cloak or robe, pulling it slightly off balance.",
        "Your strike ricochets off an unimportant object, making a loud and unexpected noise.",
        "You overreach and stumble, bumping into an ally and causing mild annoyance.",
        "You swing with such force that you drop your shield or other held item.",
        "You accidentally hit a loose stone or brick, creating a loud clatter in the area.",
        "Your hand cramps up momentarily, forcing you to adjust your grip on your weapon.",
        "You sneeze at the worst possible moment, disrupting your focus entirely.",
        "You accidentally knock over a nearby torch or lantern, causing it to sputter.",
        "Your weapon slips from your hand and embeds itself in a nearby object, such as a tree or the floor. It will take an action to retrieve it.",
        "Your wild swing narrowly misses an ally, causing them to flinch and lose their next reaction.",
        "You overbalance so badly that you fall prone, knocking over a nearby object in the process.",
        "Your fumble creates a loud, clanging noise, alerting hidden enemies to your presence.",
        "You lose control of your attack, and your weapon sails through the air, landing 1d10 feet away in a random direction.",
        "You strike a nearby torch or lantern, extinguishing it and plunging the area into partial darkness.",
        "Your attack ricochets off a solid surface, creating sparks that briefly blind you until the end of your next turn.",
        "You step on a loose stone or slick surface, causing you to stumble and slide 5 feet in a random direction.",
        "Your swing is so off-target that it hits a precarious object in the environment, triggering a minor collapse or falling debris.",
        "You accidentally tangle your weapon or shield in an ally’s gear, leaving both of you disarmed until you spend an action to free yourselves.",
        "Your weapon catches on a piece of your own equipment, such as your cloak or belt, tearing it slightly and reducing its effectiveness.",
        "You lose your footing on uneven ground and slam into a nearby object, making a loud and distracting noise.",
        "Your overenthusiastic swing dislodges a nearby piece of terrain, such as a rock or plank, causing it to shift dangerously.",
        "You trip over a small obstacle and collide with an ally, knocking both of you prone but unharmed.",
        "Your attack disrupts the balance of a nearby structure or item, causing it to teeter dangerously.",
        "You hit a pipe, barrel, or other container, causing a sudden release of liquid, smoke, or gas that obscures the area for 1d4 rounds.",
        "Your strike clips a loose rope or chain, causing an unexpected environmental hazard to fall nearby.",
        "You accidentally toss your weapon into a nearby body of water, fire, or similar hazard. It can be recovered with effort.",
        "Your fumble sends you stumbling backward into an enemy’s attack range, provoking an opportunity attack.",
        "You misstep and cause a small fire, spark, or other hazard to erupt, creating a distraction or minor environmental challenge.",
        "You lose control of your weapon, and it strikes you on the rebound. Take 1d6 damage.",
        "Your weapon snaps or cracks under the force of your mishandling, rendering it unusable until repaired.",
        "Your wild swing hits an ally within range. They take 1d8 damage from the unintended strike.",
        "You stumble backward into a sharp object or hazard, taking 1d4 piercing damage.",
        "Your fumble causes you to fall onto your own gear awkwardly, breaking a piece of non-magical equipment or dealing 1d6 bludgeoning damage to yourself.",
        "Your weapon lodges itself into an immovable surface, like a wall or the ground. You take 1d4 damage as the force jolts your arm.",
        "You accidentally slice through a strap or buckle on your armor, reducing its AC by 1 until repaired.",
        "Your attack sparks a small explosion or fire from a nearby flammable object, causing 1d8 fire damage to you and anyone within 5 feet.",
        "You twist your ankle during the mishap, reducing your movement speed by half and taking 1d6 bludgeoning damage.",
        "You accidentally shatter a potion or other volatile item you were carrying, taking 1d6 acid or poison damage as it splashes onto you.",
        "Your weapon shatters irreparably, leaving you unarmed until you can acquire a replacement.",
        "Your critical mistake causes you to strike yourself with full force. Take damage equal to your weapon’s maximum damage roll.",
        "You stumble directly into a trap or environmental hazard, such as a spike pit or fire, taking 2d10 damage.",
        "You hit an ally with devastating force, dealing damage equal to your attack roll to them instead of the intended target.",
        "Your armor or shield is completely destroyed in the mishap, leaving you vulnerable until it can be replaced.",
        "Your fumble ignites a chain reaction in the environment, such as a collapsing structure or spreading fire, causing heavy destruction and injuring everyone nearby (3d6 damage to all within 10 feet)."
    ];

    try {
        // Roll a 1d10 for the fumble effect
        console.log("Rolling 1d10 to determine the fumble result...");
        const fumbleRoll = new Roll("1d10");
        await fumbleRoll.evaluate({ async: true });
        const fumbleResult = fumbleTable[fumbleRoll.total - 1]; // Adjust for 0-based index

        console.log(`Fumble Roll Result (${fumbleRoll.total}):`, fumbleResult);

        // Output the fumble result to chat
        const chatMessageContent = `
            <div class="fumble-result">
                <h3>Fumble!</h3>
                <p><strong>${actorName}</strong> has fumbled their attack!</p>
                <p><em>${fumbleResult}</em></p>
            </div>
        `;

        console.log("Sending fumble result to chat...");
        await ChatMessage.create({
            speaker: chatMessage.speaker,
            content: chatMessageContent,
            flavor: "Fumble Result"
        });

        console.log("Fumble result successfully sent to chat.");
    } catch (error) {
        console.error("Error processing fumble roll:", error);
    }
});
