// === MAIN ENTRY POINT ===
let game;
let ui;
let setup;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game engine
    game = new Game();

    // Initialize UI
    ui = new GameUI(game);

    // Initialize setup screen
    setup = new SetupScreen();

    console.log('Reclamation Wars loaded. Select a faction to begin.');
});
