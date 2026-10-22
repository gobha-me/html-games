# Self-hosted period type (#88)

All seven WOFF2 faces are Latin subsets of the Google Fonts TTF sources at
revision `45e3d5269e4a17d823f6d84470bc084dc5ae46f6`. No font service is contacted.

| Family | Credit | Upstream / committed license |
| --- | --- | --- |
| League Gothic | The League of Moveable Type / Tyler Finck, Caroline Hadilaksono, Micah Rich | [google/fonts/ofl/leaguegothic](https://github.com/google/fonts/tree/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/leaguegothic), [OFL](leaguegothic-OFL.txt) |
| Old Standard TT | Alexey Kryukov / Old Standard Project Authors | [google/fonts/ofl/oldstandardtt](https://github.com/google/fonts/tree/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/oldstandardtt), [OFL](oldstandardtt-OFL.txt) |
| Courier Prime | Alan Dague-Greene / Courier Prime Project Authors | [google/fonts/ofl/courierprime](https://github.com/google/fonts/tree/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/courierprime), [OFL](courierprime-OFL.txt) |
| UnifrakturMaguntia | j. 'mach' wust and Peter Wiegel | [google/fonts/ofl/unifrakturmaguntia](https://github.com/google/fonts/tree/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/unifrakturmaguntia), [OFL](unifrakturmaguntia-OFL.txt) |

Rebuild with [scripts/build-fonts.py](../../scripts/build-fonts.py), using its
venv commands and pinned Python dependencies. League Gothic is instantiated at
width 100. Subsets retain Latin and Latin Extended, punctuation, arrows, the euro,
minus and carbon dot; other symbols fall through to the platform fallback stack.
Font display is `swap`. Explicit line heights and intrinsic grid tracks keep
Impact/Arial Narrow, Georgia and Courier New usable when every font request fails.
The blackletter face is used only for mixed-case The Evening Star mastheads.

The Unifraktur Latin subset's internal primary and PostScript names are renamed
to Evening Star Fraktur Latin to respect its Reserved Font Name. Its original
copyright/license records remain intact. `UnifrakturMaguntia` in CSS is the
credited source-family alias for that self-hosted face. `provenance.json` records
the raw source URLs, SHA-256 digests and converter versions.
