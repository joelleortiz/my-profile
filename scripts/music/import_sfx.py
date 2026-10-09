#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfxformat import (  # noqa: E402
    LOOPS, SOUND_IDS, SR, finish_loop, finish_one_shot, load, print_measurements, reduce_noise, write_sound,
)


def main() -> None:
    ap = argparse.ArgumentParser(
        description='Replace a sound effect with your own recordings. Each file becomes one variation; '
                    'the old variations of that sound are removed.')
    ap.add_argument('sound', choices=SOUND_IDS)
    ap.add_argument('files', nargs='+', type=Path, help='any audio file ffmpeg can read')
    ap.add_argument('--start', type=float, default=0.0, help='seconds to skip at the start of each file')
    ap.add_argument('--length', type=float, help='seconds to keep after --start (default: the rest)')
    ap.add_argument('--gain', type=float, default=0.0, help='dB louder (+) or quieter (-) than the standard level')
    ap.add_argument('--no-denoise', action='store_true', help='skip the noise reduction')
    args = ap.parse_args()

    variations = [prepare(load(path), args) for path in args.files]
    print_measurements(write_sound(args.sound, variations))


def prepare(x: np.ndarray, args: argparse.Namespace) -> np.ndarray:
    x = excerpt(x, args.start, args.length)
    if not args.no_denoise:
        x = reduce_noise(x)
    if args.sound in LOOPS:
        return finish_loop(x, args.gain)
    return finish_one_shot(x, args.gain)


def excerpt(x: np.ndarray, start: float, length: float | None) -> np.ndarray:
    first = round(start * SR)
    last = len(x) if length is None else first + round(length * SR)
    return x[first:last]


if __name__ == '__main__':
    main()
