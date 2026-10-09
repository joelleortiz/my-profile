#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose  # noqa: E402
import render  # noqa: E402

PREVIEWS = Path(__file__).resolve().parents[2] / 'music' / 'previews'
VARIATIONS = {
    'A': dict(lead=8, seed=1909, colour='borrowed', title='celesta lead'),
    'B': dict(lead=10, seed=1909, colour='borrowed', title='music box lead'),
    'C': dict(lead=11, seed=523, colour='borrowed', title='vibraphone lead, seed 523'),
    'C2': dict(lead=11, seed=523, colour='bright-b', title='vibraphone, diatonic B section'),
    'C3': dict(lead=11, seed=523, colour='diatonic', title='vibraphone, diatonic B and breakdown'),
    'C4': dict(lead=11, seed=523, colour='diatonic-e', title='vibraphone, C3 plus E9sus4 in bars 15 and 39'),
}


def main() -> None:
    names = sys.argv[1:] or list(VARIATIONS)
    reports = {}
    for name in names:
        v = VARIATIONS[name]
        mid = render.WORK / f'{name}.mid'
        composer = compose.Composer(compose.TEMPO_BPM, compose.KEY, compose.BARS, v['lead'], v['seed'], v['colour'])
        song = composer.compose()
        compose.validate(song, composer.end)
        mid.parent.mkdir(parents=True, exist_ok=True)
        song.save(mid)
        reports[name] = render.render(mid, name, PREVIEWS / f'{name}.mp3',
                                      f"lo-fi loop preview {name}: {v['title']}")
    print()
    for name, r in reports.items():
        print(f"{name}: {r['samples']} samples, {r['lufs']:.2f} LUFS, {r['true_peak']:.2f} dBTP")


if __name__ == '__main__':
    main()
