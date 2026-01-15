// ============================================================================
// GAME STATE - Central state management for Factory Defense
// ============================================================================

// Import all game modules
const Game = {
    // Core game state - exposed globally for all modules
    state: null,
    
    // Constants (will be loaded from constants.js)
    CONSTANTS: {},
    
    // Module references
    World: null,
    Buildings: null,
    Enemies: null,
    Turrets: null,
    Waves: null,
    UI: null,
    Input: null,
    
    // Initialization
    init() {
        // Initialize state first
        this.state = this.createInitialState();
        
        // Make state globally accessible for all modules
        window.gameState = this.state;
        
        // Initialize modules in order
        this.World.init(this.state);
        this.Buildings.init(this.state);
        this.Enemies.init(this.state);
        this.Turrets.init(this.state);
        this.Waves.init(this.state);
        this.UI.init(this.state);
        this.Input.init(this.state);
        
        // Initialize achievements and audio if available
        if (typeof initAchievements === 'function') {
            setTimeout(() => initAchievements(), 100);
        }
        
        // Start game loop
        this.gameLoop();
        
        // Start timers
        this.startTimers();
        
        console.log('Game initialized successfully');
    },
    
    createInitialState() {
        const GRID_SIZE = 50;
        const CELL_SIZE = 32;
        const CORE_MAX_HEALTH = 100;
        const CORE_POS = { x: 25, y: 25 };
        const START_REVEAL_RADIUS = 8;
        const STARTING_RESOURCES = { 
            iron: 50, copper: 30, coal: 20, stone: 20, oil: 0, 
            gear: 5, circuit: 0, steel: 0, ammo: 30 
        };
        
        return {
            grid: Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null)),
            resources: {...STARTING_RESOURCES},
            enemies: [],
            projectiles: [],
            coreHealth: CORE_MAX_HEALTH,
            wave: 1,
            enemiesInWave: 3,
            waveTimer: 0,
            gameTime: 0,
            revealed: new Set(),
            buildingInHand: null,
            isPaused: false,
            rocketLaunched: false,
            objectives: [false, false, false, false, false],
            firstWaveSpawned: false,
            camera: { 
                x: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerWidth / 2, 
                y: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerHeight / 2 
            },
            manualCrafting: { lastCrafted: 0 },
            zoomLevel: 1.0,
            achievements: {
                enemiesKilled: 0,
                turretsBuilt: 0,
                wavesSurvived: 0,
                coreDamageTaken: 0
            },
            // Game config
            config: {
                GRID_SIZE,
                CELL_SIZE,
                CORE_POS,
                START_REVEAL_RADIUS,
                TICK_RATE: 100,
                ENEMY_SPAWN_RATE: 3000,
                WAVE_DURATION: 25000,
                FIRST_WAVE_DELAY: 60000
            }
        };
    },
    
    gameLoop() {
        const state = this.state;
        
        if (!state.isPaused) {
            // Process all game systems
            this.World.processProduction();
            this.Turrets.process(state);
            this.Enemies.move(state);
            this.Waves.update(state);
            this.UI.updateStats(state);
            this.UI.updateObjectives(state);
            
            // Check achievements
            if (typeof checkAchievements === 'function') {
                checkAchievements(state);
            }
        }
        
        // Continue loop
        setTimeout(() => this.gameLoop(), 100);
    },
    
    startTimers() {
        const state = this.state;
        const config = state.config;
        
        // Enemy spawner
        setInterval(() => {
            if (!state.isPaused && state.firstWaveSpawned) {
                this.Enemies.spawn(state);
            }
        }, config.ENEMY_SPAWN_RATE);
        
        // Game time counter
        setInterval(() => {
            if (!state.isPaused) {
                state.gameTime += 1000;
            }
        }, 1000);
        
        // Auto-save
        setInterval(() => {
            if (!state.isPaused && !state.rocketLaunched) {
                this.saveGame(state);
            }
        }, 30000);
        
        // Show first wave message
        setTimeout(() => {
            if (!state.firstWaveSpawned) {
                this.UI.showMessage('FIRST WAVE IN 60 SECONDS! Build turrets NOW!', '#f00');
            }
        }, 5000);
    },
    
    saveGame(state) {
        const saveData = {
            ...state,
            // Convert Set to Array for JSON serialization
            revealed: Array.from(state.revealed),
            // Remove config and non-serializable data
            config: undefined
        };
        localStorage.setItem('factory_defense_v6', JSON.stringify(saveData));
        this.UI.showMessage('Game Saved', '#0f0');
    },
    
    loadGame() {
        const saved = localStorage.getItem('factory_defense_v6');
        if (saved) {
            const data = JSON.parse(saved);
            
            // Restore state
            Object.keys(data).forEach(key => {
                if (key !== 'config' && key !== 'revealed') {
                    this.state[key] = data[key];
                }
            });
            
            // Restore revealed Set
            this.state.revealed = new Set(data.revealed || []);
            
            // Re-initialize UI
            this.UI.setupGrid(this.state);
            this.UI.updateResources(this.state);
            this.UI.updateZoomDisplay();
            
            this.UI.showMessage('Game Loaded', '#0f0');
        }
    },
    
    resetGame() {
        if (confirm('Reset game? All progress will be lost.')) {
            localStorage.removeItem('factory_defense_v6');
            location.reload();
        }
    },
    
    // Helper methods
    getGridSize() { return this.state.config.GRID_SIZE; },
    getCellSize() { return this.state.config.CELL_SIZE; },
    getCorePos() { return this.state.config.CORE_POS; }
};

// Global helper functions that legacy code expects
window.Game = Game;
window.gameState = null; // Will be set by Game.init()
window.initGame = () => Game.init();
window.saveGame = () => Game.saveGame(Game.state);
window.loadGame = () => Game.loadGame();
window.resetGame = () => Game.resetGame();
