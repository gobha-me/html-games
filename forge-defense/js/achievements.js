/**
 * Forge Defense - Achievement System
 */

const ACHIEVEMENTS = {
    firstBlood: {
        id: 'firstBlood',
        name: 'First Blood',
        description: 'Destroy your first enemy',
        badge: '🗡️',
        points: 10,
        check: (gs) => gs.achievements.enemiesKilled >= 1
    },
    massDestruction: {
        id: 'massDestruction',
        name: 'Mass Destruction',
        description: 'Kill 100 enemies',
        badge: '💀',
        points: 50,
        check: (gs) => gs.achievements.enemiesKilled >= 100
    },
    towerDefense: {
        id: 'towerDefense',
        name: 'Tower Defense',
        description: 'Build 10 turrets',
        badge: '🛡️',
        points: 25,
        check: (gs) => gs.achievements.turretsBuilt >= 10
    },
    waveSurvivor5: {
        id: 'waveSurvivor5',
        name: 'Getting Started',
        description: 'Survive wave 5',
        badge: '🌊',
        points: 25,
        check: (gs) => gs.wave > 5
    },
    waveSurvivor10: {
        id: 'waveSurvivor10',
        name: 'Wave Master',
        description: 'Survive wave 10',
        badge: '🌊',
        points: 50,
        check: (gs) => gs.wave > 10
    },
    waveSurvivor25: {
        id: 'waveSurvivor25',
        name: 'Veteran',
        description: 'Survive wave 25',
        badge: '⭐',
        points: 100,
        check: (gs) => gs.wave > 25
    },
    resourceTycoon: {
        id: 'resourceTycoon',
        name: 'Resource Tycoon',
        description: 'Collect 1000 resources total',
        badge: '💎',
        points: 50,
        check: (gs) => gs.achievements.resourcesCollected >= 1000
    },
    masterBuilder: {
        id: 'masterBuilder',
        name: 'Master Builder',
        description: 'Place 50 buildings',
        badge: '🏗️',
        points: 75,
        check: (gs) => gs.achievements.buildingsPlaced >= 50
    },
    speedRunner: {
        id: 'speedRunner',
        name: 'Speed Runner',
        description: 'Reach wave 10 in under 10 minutes',
        badge: '⚡',
        points: 150,
        check: (gs) => gs.wave > 10 && gs.gameTime <= 600000
    },
    victorious: {
        id: 'victorious',
        name: 'Victorious',
        description: 'Reach wave 50 and win!',
        badge: '🏆',
        points: 500,
        check: (gs) => gs.objectives.victory
    }
};

let achievementState = {
    unlocked: new Set(),
    unlockedAt: {},
    pointsEarned: 0,
    lastCheck: 0
};

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

function checkAchievements(gs) {
    const now = Date.now();
    if (now - achievementState.lastCheck < 500) return [];
    achievementState.lastCheck = now;

    let newAchievements = [];

    Object.values(ACHIEVEMENTS).forEach(achievement => {
        if (!achievementState.unlocked.has(achievement.id)) {
            try {
                if (achievement.check(gs)) {
                    unlockAchievement(achievement);
                    newAchievements.push(achievement);
                }
            } catch (e) {
                // Some checks might fail
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
    updateAchievementDisplay();
    saveAchievementState();
    AudioSystem.playAchievement();
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

function openAchievements() {
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
                        <div class="achievement-item ${isUnlocked ? 'unlocked show' : 'locked show'}">
                            <div class="achievement-item-badge">${achievement.badge}</div>
                            <div class="achievement-item-info">
                                <div class="achievement-item-name">${achievement.name}</div>
                                <div class="achievement-item-desc">${achievement.description}</div>
                                <div class="achievement-item-points">${achievement.points} points</div>
                            </div>
                            ${isUnlocked ? `<div class="achievement-item-time">${formatTimeAgo(unlockedAt)}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAchievements();
    });

    document.body.appendChild(modal);
}

function closeAchievements() {
    const modal = document.getElementById('achievementsModal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 300);
    }
}

function formatTimeAgo(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function saveAchievementState() {
    localStorage.setItem('forge_defense_achievements', JSON.stringify(getAchievementState()));
}

function loadAchievementStateFromStorage() {
    const saved = localStorage.getItem('forge_defense_achievements');
    if (saved) {
        try {
            loadAchievementState(JSON.parse(saved));
        } catch (e) {
            console.warn('Failed to load achievements:', e);
        }
    }
}

function updateAchievementDisplay() {
    const btn = document.getElementById('achievement-count');
    if (btn) {
        btn.textContent = achievementState.unlocked.size;
    }
}

function initAchievements() {
    loadAchievementStateFromStorage();
    updateAchievementDisplay();
}

// Expose globally
window.openAchievements = openAchievements;
window.closeAchievements = closeAchievements;
