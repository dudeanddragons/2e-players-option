// Modify Round Duration
Hooks.on('updateCombat', (combat, updateData, options, userId) => {
    if (!game.settings.get("2e-players-option", "enable12SecondRounds")) return;
  
    // Combat Round 12 Seconds
    if (updateData.round !== undefined) {
      const previousTime = game.time.worldTime;
      const newTime = previousTime + 12;
      game.time.advance(newTime - previousTime);
      //ui.notifications.info("12 seconds have been added for this combat round.");
    }
  });
  
  // End Combat Add 1 Turn
  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (!game.settings.get("2e-players-option", "advance600EndCombat")) return;
  
    const previousTime = game.time.worldTime;
    const newTime = previousTime + 600;
    game.time.advance(newTime - previousTime);
    //ui.notifications.info("600 seconds have been added after combat.");
  });
  