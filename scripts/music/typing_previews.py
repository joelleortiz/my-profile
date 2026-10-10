#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crackle  # noqa: E402
import lofi  # noqa: E402
from sfxformat import PEAK_DBFS, SR, momentary_max, short_term_max  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'music' / 'work' / 'typing'
PREVIEWS = ROOT / 'music' / 'previews'
LOOP = ROOT / 'static' / 'audio' / 'lofi-loop.ogg'
START_BAR = 9
SECONDS_PER_BAR = 4 * 60 / 90
SOLO_LUFS = -20.0
CRACKLE_SEED = 11
NAME = 'typing-tactile-crisp'


def main() -> None:
    meta = json.loads(subprocess.run(['node', 'scripts/music/typing-track.ts', str(WORK)], cwd=ROOT, check=True,
                                     capture_output=True, text=True).stdout)
    n = meta['seconds'] * SR
    loop = decode_stereo(LOOP)
    reference = lofi.loudness(loop * meta['musicGain'])
    start = round((START_BAR - 1) * SECONDS_PER_BAR * SR)
    bed = loop[start:start + n] * meta['musicGain'] + crackle.generate(n, CRACKLE_SEED, SR) * meta['crackleGain']

    print(f"music at the site's level: {reference:.1f} LUFS integrated; typing at {meta['typingDb']:+.1f} dB; "
          f"strokes {meta['strokes']}")
    typing = np.fromfile(WORK / 'typing.f32', dtype=np.float32).astype(np.float64)
    encode(solo(typing), PREVIEWS / f'{NAME}-solo.m4a')
    encode(bed + typing[:, None], PREVIEWS / f'{NAME}-mix.m4a')
    stroke = np.median([momentary_max(k) for k in keys(meta['keyLengths'])])
    print(f'{NAME}: one key {reference - stroke:.1f} dB under the music, '
          f'typing {reference - short_term_max(typing):.1f} dB under')


def solo(typing: np.ndarray) -> np.ndarray:
    stereo = typing[:, None].repeat(2, axis=1)
    by_loudness = SOLO_LUFS - lofi.loudness(stereo)
    by_peak = PEAK_DBFS - 20 * np.log10(np.abs(stereo).max())
    return stereo * lofi.gain(min(by_loudness, by_peak))


def keys(lengths: list[int]) -> list[np.ndarray]:
    flat = np.fromfile(WORK / 'keys.f32', dtype=np.float32).astype(np.float64)
    return np.split(flat, np.cumsum(lengths)[:-1])


def decode_stereo(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2',
                          '-ar', str(SR), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, 2)


def encode(x: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    wav = WORK / f'{path.stem}.wav'
    wavfile.write(wav, SR, x.astype(np.float32))
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'aac_at',
                    '-b:a', '160k', str(path)], check=True)


if __name__ == '__main__':
    main()
