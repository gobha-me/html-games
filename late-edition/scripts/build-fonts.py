"""#88: run in a venv with fonttools[woff] and brotli; no runtime downloads.

    python3 -m venv node_modules/.cache/fonts-venv
    node_modules/.cache/fonts-venv/bin/pip install fonttools==4.67.0 brotli==1.2.0
    node_modules/.cache/fonts-venv/bin/python scripts/build-fonts.py

Latin, punctuation and UI symbols only. League Gothic's width axis is frozen at
its normal width to avoid shipping unused variation tables. OFL texts are copied
verbatim; font metadata/copyright remains in the subsets.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import fontTools
import brotli
from urllib.parse import quote
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

# Immutable google/fonts revision (same upstream for binaries and licenses).
REVISION = '45e3d5269e4a17d823f6d84470bc084dc5ae46f6'
FAMILIES = {
    'leaguegothic': ['LeagueGothic[wdth]'],
    'oldstandardtt': ['OldStandard-Regular', 'OldStandard-Bold', 'OldStandard-Italic'],
    'courierprime': ['CourierPrime-Regular', 'CourierPrime-Bold'],
    'unifrakturmaguntia': ['UnifrakturMaguntia-Book'],
}
DEST = Path(__file__).resolve().parents[1] / 'assets/fonts'

provenance = {'revision': REVISION, 'fonttools': fontTools.__version__, 'brotli': brotli.__version__, 'sources': []}

def fetch(family, name):
    url = f'https://raw.githubusercontent.com/google/fonts/{REVISION}/ofl/{family}/{quote(name)}'
    with urlopen(url, timeout=60) as response:
        data = response.read()
    provenance['sources'].append({'url': url, 'sha256': hashlib.sha256(data).hexdigest()})
    return data

for family, names in FAMILIES.items():
    (DEST / f'{family}-OFL.txt').write_bytes(fetch(family, 'OFL.txt'))
    for name in names:
        font = TTFont(BytesIO(fetch(family, name + '.ttf')), recalcTimestamp=False)
        if 'fvar' in font:
            font = instantiateVariableFont(font, {'wdth': 100}, inplace=True)
        options = subset.Options()
        options.flavor = 'woff2'
        options.recalc_timestamp = False
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=subset.parse_unicodes('U+0000-00FF,U+0100-024F,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+25CF'))
        sub.subset(font)
        # UnifrakturMaguntia has a Reserved Font Name. Rename the modified
        # subset's internal primary/PostScript names; CSS uses the credited
        # source family as a local @font-face alias, not an internal font name.
        if family == 'unifrakturmaguntia':
            for record in font['name'].names:
                if record.nameID in (1, 3, 4, 6, 16):
                    replacement = 'EveningStarFrakturLatin' if record.nameID == 6 else 'Evening Star Fraktur Latin'
                    record.string = replacement.encode(record.getEncoding())
        font.recalcTimestamp = False
        font.flavor = 'woff2'
        output = DEST / (name.replace('[wdth]', '-Regular') + '.woff2')
        if family == 'unifrakturmaguntia':
            output = DEST / 'EveningStarFraktur-Latin.woff2'
        font.save(output)
        print(output.name, output.stat().st_size)

(DEST / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
