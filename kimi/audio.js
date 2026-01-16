/**
 * Audio System for Factory Defense
 * Uses Web Audio API for synthesized sounds (no external files needed)
 */

const AudioSystem = (function() {
    let audioCtx = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let ambientOscillators = [];
    let isInitialized = false;
    
    // Settings
    let settings = {
        sfxEnabled: true,
        musicEnabled: false,
        masterVolume: 0.7
    };
    
    function init() {
        if (isInitialized) return;
        
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            sfxGain = audioCtx.createGain();
            musicGain = audioCtx.createGain();
            
            masterGain.connect(audioCtx.destination);
            sfxGain.connect(masterGain);
            musicGain.connect(masterGain);
            
            setMasterVolume(settings.masterVolume);
            setSfxVolume(0.5);
            setMusicVolume(0.3);
            
            isInitialized = true;
            console.log('Audio system initialized');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }
    
    function resume() {
        if (!audioCtx) {
            init();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    
    function setMasterVolume(volume) {
        resume();
        if (masterGain) {
            masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
        }
    }
    
    function setSfxVolume(volume) {
        resume();
        if (sfxGain) {
            sfxGain.gain.setValueAtTime(volume, audioCtx.currentTime);
        }
    }
    
    function setMusicVolume(volume) {
        resume();
        if (musicGain) {
            musicGain.gain.setValueAtTime(volume, audioCtx.currentTime);
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
        if (settings.musicEnabled) {
            startAmbient();
        } else {
            stopAmbient();
        }
        return settings.musicEnabled;
    }
    
    function getSettings() {
        return { ...settings };
    }
    
    // === SOUND EFFECTS ===
    
    function playBuildingPlace() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
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
    
    function playMining() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Create noise for pickaxe sound
        const bufferSize = audioCtx.sampleRate * 0.1;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        
        const noise = audioCtx.createBufferSource();
        const noiseGain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        noise.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(sfxGain);
        
        noiseGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        noise.start();
        
        // Add metallic click
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.connect(oscGain);
        oscGain.connect(sfxGain);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.05);
        
        oscGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }
    
    function playTurretFire() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Gunshot - quick burst of noise with filter sweep
        const bufferSize = audioCtx.sampleRate * 0.15;
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
        
        noiseGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        noise.start();
    }
    
    function playEnemyHit() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
    
    function playWaveAnnounce() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Alert siren
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.3);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.45);
        
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
    
    function playDeconstruct() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Dismantle sound - sliding down tone
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    }
    
    function playLowResource() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Warning chime
        const now = audioCtx.currentTime;
        
        [523.25, 659.25].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
            
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
        });
    }
    
    function playVictory() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Triumphant fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
        const now = audioCtx.currentTime;
        
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'square';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.12, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
            
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.5);
        });
    }
    
    function playGameOver() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Sad descending tones
        const notes = [392, 349.23, 293.66, 261.63];
        const now = audioCtx.currentTime;
        
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(sfxGain);
            
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now + i * 0.3);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.3 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.4);
            
            osc.start(now + i * 0.3);
            osc.stop(now + i * 0.3 + 0.5);
        });
    }
    
    function playBossSpawn() {
        if (!settings.sfxEnabled || !audioCtx) return;
        
        // Intense buildup sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 1.5);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 2);
    }
    
    // === AMBIENT MUSIC ===
    
    function startAmbient() {
        if (!settings.musicEnabled || !audioCtx) return;
        
        stopAmbient(); // Clear any existing
        
        // Factory ambiance - low drones
        const freqs = [55, 82.5, 110];
        
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(musicGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            filter.type = 'lowpass';
            filter.frequency.value = 200 + i * 50;
            filter.Q.value = 1;
            
            // Subtle LFO for movement
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = 0.1 + i * 0.05;
            lfoGain.gain.value = 0.02;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();
            
            ambientOscillators.push({ osc, gain, lfo });
            
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08 - i * 0.015, audioCtx.currentTime + 2);
            
            osc.start();
        });
        
        // Add rhythmic clicking (factory machinery)
        scheduleFactoryRhythm();
    }
    
    function scheduleFactoryRhythm() {
        if (!settings.musicEnabled || !audioCtx) return;
        
        const now = audioCtx.currentTime;
        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        
        click.connect(clickGain);
        clickGain.connect(musicGain);
        
        click.type = 'square';
        click.frequency.value = 80;
        
        clickGain.gain.setValueAtTime(0.02, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        
        click.start(now);
        click.stop(now + 0.02);
        
        // Schedule next click
        setTimeout(() => {
            if (settings.musicEnabled) scheduleFactoryRhythm();
        }, 500 + Math.random() * 500);
    }
    
    function stopAmbient() {
        ambientOscillators.forEach(({ osc, lfo }) => {
            try {
                lfo.stop();
                osc.stop();
            } catch (e) {}
        });
        ambientOscillators = [];
    }
    
    function updateAmbientForWave(waveNumber, inWave) {
        if (!settings.musicEnabled || !audioCtx) return;
        
        // Adjust ambient tension based on wave state
        ambientOscillators.forEach(({ filter }, i) => {
            const baseFreq = 200 + i * 50;
            const tensionAdd = inWave ? 100 : 0;
            const waveAdd = waveNumber > 5 ? 50 : 0;
            
            filter.frequency.setTargetAtTime(
                baseFreq + tensionAdd + waveAdd,
                audioCtx.currentTime,
                0.5
            );
        });
    }
    
    // Public API
    return {
        init,
        resume,
        setMasterVolume,
        setSfxVolume,
        setMusicVolume,
        toggleSfx,
        toggleMusic,
        getSettings,
        playBuildingPlace,
        playMining,
        playTurretFire,
        playEnemyHit,
        playWaveAnnounce,
        playDeconstruct,
        playLowResource,
        playVictory,
        playGameOver,
        playBossSpawn,
        startAmbient,
        stopAmbient,
        updateAmbientForWave
    };
})();

// Global functions for HTML integration
function toggleSfx() {
    const enabled = AudioSystem.toggleSfx();
    const btn = document.getElementById('sfxToggle');
    if (btn) {
        btn.textContent = enabled ? '🔊 ON' : '🔇 OFF';
        btn.classList.toggle('off', !enabled);
    }
}

function toggleMusic() {
    const enabled = AudioSystem.toggleMusic();
    const btn = document.getElementById('musicToggle');
    if (btn) {
        btn.textContent = enabled ? '🎵 ON' : '🎶 OFF';
        btn.classList.toggle('off', !enabled);
    }
}

function setMasterVolume(value) {
    AudioSystem.setMasterVolume(value);
    const volDisplay = document.getElementById('volumeValue');
    if (volDisplay) {
        volDisplay.textContent = Math.round(value * 100) + '%';
    }
}
