// Intro screen + how-to-play logic
(function() {
    var STORAGE_KEY = 'forgeDefense_helpSeen';

    // Dismiss the intro screen and mark as seen
    window.dismissIntro = function() {
        document.getElementById('intro-screen').classList.add('hidden');
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
    };

    // Open the full help overlay (re-openable via ❓ button)
    window.openHowToPlay = function() {
        document.getElementById('how-to-play-overlay').style.display = 'flex';
    };

    window.closeHowToPlay = function() {
        document.getElementById('how-to-play-overlay').style.display = 'none';
    };

    // Show intro on first visit only
    try {
        if (!localStorage.getItem(STORAGE_KEY)) {
            // Show immediately — intro screen is already in the DOM
            // No need to wait for load; it sits above everything at z-index 20000
        } else {
            // Returning player — hide intro immediately
            document.getElementById('intro-screen').classList.add('hidden');
        }
    } catch(e) {}

    // Close help overlay on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var overlay = document.getElementById('how-to-play-overlay');
            if (overlay && overlay.style.display === 'flex') {
                window.closeHowToPlay();
            }
        }
    });
})();
