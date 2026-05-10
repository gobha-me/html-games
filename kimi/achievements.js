/**
 * Achievement System for Factory Defense
 * Tracks player milestones and awards unlockable badges
 */

const ACHIEVEMENTS = {
    firstBlood: {
        id: 'firstBlood',
        name: 'First Blood',
        description: 'Destroy your first enemy',
        badge: '🗡️',
        points: 10,
        check: (gameState) => gameState.achievements.enemiesKilled >= 1
    },
    towerDefense: {
        id: 'towerDefense',
        name: 'Tower Defense',
        description: 'Build 10 turrets',
        badge: '🛡️',
        points: 25,
        check: (gameState) => countBuildingsTotal('turret') >= 10
    },
    resourceTycoon: {
        id: 'resourceTycoon',
        name: 'Resource Tycoon',
        description: 'Collect 1000 of any resource',
        badge: '💎',
        points: 50,
        check: (gameState) => {
            const resources = ['iron', 'copper', 'coal', 'stone', 'oil', 'steel', 'circuit', 'gear', 'ammo'];
            return resources.some(r => gameState.resources[r] >= 1000);
        }
    },
    waveSurvivor: {
        id: 'waveSurvivor',
        name: 'Wave Survivor',
        description: 'Complete wave 10',
        badge: '🌊',
        points: 100,
        check: (gameState) => gameState.wave > 10
    },
    efficiencyExpert: {
        id: 'efficiencyExpert',
        name: 'Efficiency Expert',
        description: 'Build 50 turrets without losing one',
        badge: '⚡',
        points: 200,
        check: (gameState) => gameState.achievements.turretsBuilt >= 50
    },
    speedDemon: {
        id: 'speedDemon',
        name: 'Speed Demon',
        description: 'Complete wave 5 within 10 minutes',
        badge: '⚡',
        points: 150,
        check: (gameState) => gameState.wave > 5 && gameState.gameTime <= 600000
    },
    collector: {
        id: 'collector',
        name: 'Collector',
        description: 'Have 100 of each resource simultaneously',
        badge: '🎯',
        points: 300,
        check: (gameState) => {
            const resources = ['iron', 'copper', 'coal', 'stone', 'oil', 'steel', 'circuit', 'gear', 'ammo'];
            return resources.every(r => gameState.resources[r] >= 100);
        }
    },
    masterBuilder: {
        id: 'masterBuilder',
        name: 'Master Builder',
        description: 'Build at least one of each building type',
        badge: '🏗️',
        points: 100,
        check: (gameState) => {
            const buildingTypes = ['miner', 'furnace', 'assembler', 'turret', 'barrier', 'pumpjack', 'silo'];
            return buildingTypes.every(type => countBuildingsTotal(type) >= 1);
        }
    },
    untouchable: {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Complete wave 5 with 100% core health',
        badge: '💯',
        points: 500,
        check: (gameState) => gameState.wave > 5 && gameState.coreHealth >= CORE_MAX_HEALTH
    },
    legendary: {
        id: 'legendary',
        name: 'Legendary',
        description: 'Earn 1000 total achievement points',
        badge: '🏆',
        points: 1000,
        check: (gameState) => calculateTotalPoints() >= 1000
    },
    bossSwarmSurvivor: {
        id: 'bossSwarmSurvivor',
        name: 'Boss Swarm Survivor',
        description: 'Survive a boss wave — kill at least one boss minion',
        badge: '🐉',
        points: 250,
        check: (gameState) => gameState.achievements && gameState.achievements.bossMinionsKilled >= 1
    }
};

// Achievement state
let achievementState = {
    unlocked: new Set(),
    unlockedAt: {},
    pointsEarned: 0,
    lastCheck: Date.now()
};

// Cache for achievement counts
let buildingCountsCache = {};

function countBuildingsTotal(type) {
    if (!buildingCountsCache[type]) {
        buildingCountsCache[type] = countBuildings(type);
    }
    return buildingCountsCache[type];
}

function invalidateBuildingCache() {
    buildingCountsCache = {};
}

function getAchievementState() {
    return {
        unlocked: Array.from(achievementState.unlocked),
        unlockedAt: achievementState.unlockedAt,
        pointsEarned: achievementState.pointsEarned
    };
}

function loadAchievementState(state) {
    if (state && state.unlocked) {
        achievementState.unlocked = new Set(state.unlocked);
        achievementState.unlockedAt = state.unlockedAt || {};
        achievementState.pointsEarned = state.pointsEarned || 0;
    }
}

function calculateTotalPoints() {
    return achievementState.pointsEarned;
}

function checkAchievements(gameStateToCheck) {
    const now = Date.now();
    if (now - achievementState.lastCheck < 1000) return [];
    achievementState.lastCheck = now;

    let newAchievements = [];

    Object.values(ACHIEVEMENTS).forEach(achievement => {
        if (!achievementState.unlocked.has(achievement.id)) {
            try {
                if (achievement.check(gameStateToCheck)) {
                    unlockAchievement(achievement);
                    newAchievements.push(achievement);
                }
            } catch (e) {
                // Some checks might fail if data isn't ready yet
            }
        }
    });

    return newAchievements;
}

function unlockAchievement(achievement) {
    achievementState.unlocked.add(achievement.id);
    achievementState.unlockedAt[achievement.id] = Date.now();
    achievementState.pointsEarned += achievement.points;

    showAchievementNotification(achievement);
    saveAchievementState();
    updateAchievementDisplay();
}

function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-badge">${achievement.badge}</div>
        <div class="achievement-info">
            <div class="achievement-name">Achievement Unlocked!</div>
            <div class="achievement-title">${achievement.name}</div>
            <div class="achievement-points">+${achievement.points} points</div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// FIX: Add openAchievements and closeAchievements as aliases for HTML onclick handlers
function openAchievements() {
    showAchievementsModal();
}

function closeAchievements() {
    closeAchievementsModal();
}

function showAchievementsModal() {
    const existingModal = document.getElementById('achievementsModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'achievementsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="achievements-modal-content">
            <div class="achievements-header">
                <h2>🏆 Achievements</h2>
                <div class="achievements-total">
                    <span class="points-display">${achievementState.pointsEarned} pts</span>
                    <span class="count-display">${achievementState.unlocked.size}/${Object.keys(ACHIEVEMENTS).length}</span>
                </div>
                <button class="close-btn" onclick="closeAchievements()">×</button>
            </div>
            <div class="achievements-list">
                ${Object.values(ACHIEVEMENTS).map(achievement => {
                    const isUnlocked = achievementState.unlocked.has(achievement.id);
                    const unlockedAt = achievementState.unlockedAt[achievement.id];
                    return `
                        <div class="achievement-item ${isUnlocked ? 'unlocked' : 'locked'}" data-id="${achievement.id}">
                            <div class="achievement-item-badge">${achievement.badge}</div>
                            <div class="achievement-item-info">
                                <div class="achievement-item-name">${achievement.name}</div>
                                <div class="achievement-item-desc">${achievement.description}</div>
                                <div class="achievement-item-points">${achievement.points} points</div>
                            </div>
                            ${isUnlocked ? `<div class="achievement-item-time">${formatTime(unlockedAt)}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAchievementsModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const items = modal.querySelectorAll('.achievement-item.unlocked');
        items.forEach((item, index) => {
            setTimeout(() => item.classList.add('show'), index * 50);
        });
    }, 100);
}

function closeAchievementsModal() {
    const modal = document.getElementById('achievementsModal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function saveAchievementState() {
    localStorage.setItem('factory_defense_achievements', JSON.stringify(getAchievementState()));
}

function loadAchievementStateFromStorage() {
    const saved = localStorage.getItem('factory_defense_achievements');
    if (saved) {
        try {
            loadAchievementState(JSON.parse(saved));
        } catch (e) {
            console.warn('Failed to load achievement state:', e);
        }
    }
}

function addAchievementButtonToSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (document.getElementById('achievementsBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'achievementsBtn';
    btn.className = 'achieve-btn';
    btn.innerHTML = `🏆 Achievements (0)`;
    btn.onclick = openAchievements;

    const stats = document.getElementById('stats');
    if (stats) {
        sidebar.insertBefore(btn, stats);
    } else {
        sidebar.appendChild(btn);
    }
}

function updateAchievementDisplay() {
    const btn = document.getElementById('achievementsBtn');
    if (btn) {
        const count = achievementState.unlocked.size;
        btn.innerHTML = `🏆 Achievements (${count})`;
    }
}

function initAchievements() {
    loadAchievementStateFromStorage();
    addAchievementButtonToSidebar();
    updateAchievementDisplay();
}

// Expose functions globally for HTML onclick handlers
window.openAchievements = openAchievements;
window.closeAchievements = closeAchievements;
