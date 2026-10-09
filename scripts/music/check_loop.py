#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 'f32le',
                          '-ac', '2', '-ar', str(SR), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def ebur128(path: Path) -> tuple[float, float]:
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true',
                          '-f', 'null', '-'], capture_output=True, text=True).stderr
    summary = err[err.rfind('Summary:'):]
    lufs = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return lufs, tp


def percentile_of(value: float, population: np.ndarray) -> float:
    return float((population < value).mean() * 100)


def seam(x: np.ndarray, bars: int) -> dict[str, float]:
    steps = np.abs(np.diff(x, axis=0)).max(axis=1)
    step = float(np.abs(x[0] - x[-1]).max())
    d2 = np.abs(x[2:] - 2 * x[1:-1] + x[:-2]).max(axis=1)
    wrapped = np.concatenate([x[-2:], x[:2]])
    d2_seam = float(np.abs(wrapped[2:] - 2 * wrapped[1:-1] + wrapped[:-2]).max())

    ms = SR // 1000
    cs = np.concatenate([np.zeros((1, 2)), np.cumsum(np.concatenate([x[-ms:], x, x[:ms]]), axis=0)])
    before = (cs[ms:ms + len(x)] - cs[:len(x)]) / ms  # mean of the 1 ms before each sample
    after = (cs[2 * ms:2 * ms + len(x)] - cs[ms:ms + len(x)]) / ms  # mean of the 1 ms from it
    jumps = np.abs(after - before).max(axis=1)

    pad = SR // 10
    looped = np.concatenate([x[-pad:], x, x[:pad]])
    sos = signal.butter(4, 6000, 'highpass', fs=SR, output='sos')
    hf = (signal.sosfiltfilt(sos, looped, axis=0)[pad:pad + len(x)] ** 2).sum(axis=1)
    hf = np.concatenate([hf[-ms:], hf, hf[:ms]])
    bar = len(x) // bars
    bursts = np.array([hf[b * bar:b * bar + 2 * ms].sum() for b in range(bars)])  # +-1 ms round each downbeat

    return {
        'step': step, 'step_pct': percentile_of(step, steps),
        'click_pct': percentile_of(d2_seam, d2),
        'jump_pct': percentile_of(float(jumps[0]), jumps),
        'burst_rank': int((bursts > bursts[0]).sum()) + 1,
        'dc': float(x.mean()),
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description='Measure loop files: decoded length, loudness, true peak, and how the loop point compares '
                    'with every other point in the file.')
    ap.add_argument('files', nargs='+', type=Path)
    ap.add_argument('--bars', type=int, default=48, help='downbeats to rank the loop point against')
    args = ap.parse_args()
    for path in args.files:
        x = decode(path)
        lufs, tp = ebur128(path)
        s = seam(x, args.bars)
        print(f'{path}  ({path.stat().st_size / 1e6:.2f} MB)')
        print(f'  {len(x)} samples = {len(x) / SR:.4f} s   {lufs:.1f} LUFS   true peak {tp:.1f} dBTP   '
              f"DC offset {s['dc']:+.6f}")
        print(f"  loop point: step {s['step']:.5f} = {s['step_pct']:.1f}th percentile of all steps; "
              f"click {s['click_pct']:.1f}th pct; level jump {s['jump_pct']:.1f}th pct; "
              f"HF burst ranks {s['burst_rank']} of {args.bars} downbeats")


if __name__ == '__main__':
    main()
