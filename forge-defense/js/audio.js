/**
 * Forge Defense - Audio System
 * Web Audio API synthesized sounds (no external files)
 */

const AudioSystem = (function() {
    let audioCtx = null;
    let masterGain = null;
    let sfxGain = null;
    let isInitialized = false;
    
    let settings = {
        sfxEnabled: true,
        musicEnabled: false,
        masterVolume: 0.5
    };
    
    function init() {
        if (isInitialized) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            sfxGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
            sfxGain.connect(masterGain);
            masterGain.gain.setValueAtTime(settings.masterVolume, audioCtx.currentTime);
            sfxGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            isInitialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }
    
    function resume() {
        if (!audioCtx) init();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    
    function toggleSfx() {
        resume();
        settings.sfxEnabled = !settings.sfxEnabled;
        return settings.sfxEnabled;
    }
    
    function toggleMusic() {
        resume();
        settings.musicEnabled = !settings.musicEnabled;
        return settings.musicEnabled;
    }
    
    function playBuildingPlace() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    }
    
    function playTurretFire() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const bufferSize = audioCtx.sampleRate * 0.12;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        
        const noise = audioCtx.createBufferSource();
        const noiseGain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(sfxGain);
        
        noiseGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        
        noise.start();
    }
    
    function playEnemyHit() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.08);
        
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    }
    
    function playWaveAnnounce() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.3);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.45);
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
    
    function playDeconstruct() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
    
    function playVictory() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const now = audioCtx.currentTime;
        
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'square';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
            
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.5);
        });
    }
    
    function playGameOver() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const notes = [392, 349.23, 293.66, 261.63];
        const now = audioCtx.currentTime;
        
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.25);
            gain.gain.linearRampToValueAtTime(0.08, now + i * 0.25 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.25 + 0.35);
            
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.4);
        });
    }
    
    function playBossSpawn() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 1);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    }
    
    function playAchievement() {
        if (!settings.sfxEnabled || !audioCtx) return;
        resume();
        
        const notes = [523.25, 659.25, 783.99];
        const now = audioCtx.currentTime;
        
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.12, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.35);
        });
    }
    
    return {
        init,
        resume,
        toggleSfx,
        toggleMusic,
        getSettings: () => ({ ...settings }),
        playBuildingPlace,
        playTurretFire,
        playEnemyHit,
        playWaveAnnounce,
        playDeconstruct,
        playVictory,
        playGameOver,
        playBossSpawn,
        playAchievement
    };
})();

// Global toggle functions
function toggleSfx() {
    const enabled = AudioSystem.toggleSfx();
    const btn = document.getElementById('sfx-toggle');
    if (btn) {
        btn.textContent = enabled ? '🔊' : '🔇';
        btn.classList.toggle('off', !enabled);
    }
}

function toggleMusic() {
    const enabled = AudioSystem.toggleMusic();
    const btn = document.getElementById('music-toggle');
    if (btn) {
        btn.textContent = enabled ? '🎵' : '🎶';
        btn.classList.toggle('off', !enabled);
    }
}
