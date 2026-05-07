// === MAIN ENTRY POINT ===
let game;
let ui;
let setup;
let keyboard;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game engine
    game = new Game();

    // Initialize UI
    ui = new GameUI(game);

    // Initialize setup screen
    setup = new SetupScreen();

    // Initialize keyboard input handler
    keyboard = new KeyboardInput(game, ui);

    console.log('Reclamation Wars loaded. Select a faction to begin.');
});
