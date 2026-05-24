// Late Edition — single source of truth for the version string.
//
// 1.3.1 — introduced after the v1.3.0 playtest caught two stale hardcoded
// strings (the HTML <title> at v1.2.0 and the HUD masthead at v1.1.1 — both
// behind the actual repo at v1.3.0). main.js boot-writes both surfaces from
// these constants so the next version bump touches one file.

export const VERSION = '1.6.0';
export const VERSION_TAGLINE = 'HUD polish — dark bar + pinned dock';
