# src/lib/audio/crackle-worklet.ts runs the same model live; keep the constants in sync.
from __future__ import annotations

import numpy as np
from scipy import signal

CRACKLE = {
    'ticks_per_second': 3.0,
    'tick_db': (-55.0, -29.0),  # peak level range
    'tick_decay_ms': (0.06, 0.3),
    'tick_highpass_hz': 700.0,
    'pops_per_second': 0.16,
    'pop_db': (-45.0, -28.0),
    'pop_hz': (180.0, 520.0),
    'pop_decay_ms': (0.8, 2.4),
    'hiss_db': -47.0,  # RMS of white noise before the band-pass
    'hiss_hz': 3200.0,
    'hiss_q': 0.6,
    'rumble_db': -34.0,  # RMS of white noise before the low-passes
    'rumble_hz': 30.0,
    'rpm': 100 / 3,  # rumble swells once per turn of a 33 1/3 record
    'rumble_swell': 0.35,
    'width': 0.35,  # how far events may pan from the centre (0..1)
}


def _one_pole_lowpass(x: np.ndarray, hz: float, sr: int) -> np.ndarray:
    a = np.exp(-2 * np.pi * hz / sr)
    return signal.lfilter([1 - a], [1, -a], x, axis=0)


def _one_pole_highpass(x: np.ndarray, hz: float, sr: int) -> np.ndarray:
    a = np.exp(-2 * np.pi * hz / sr)
    return signal.lfilter([(1 + a) / 2, -(1 + a) / 2], [1, -a], x, axis=0)


def _bandpass(x: np.ndarray, hz: float, q: float, sr: int) -> np.ndarray:
    w0 = 2 * np.pi * hz / sr
    alpha = np.sin(w0) / (2 * q)
    b = np.array([alpha, 0.0, -alpha])
    a = np.array([1 + alpha, -2 * np.cos(w0), 1 - alpha])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def _events(rng: np.random.Generator, rate: float, n: int, sr: int) -> np.ndarray:
    count = rng.poisson(rate * n / sr)
    return np.sort(rng.integers(0, n, count))


def _level(rng: np.random.Generator, lo_hi: tuple[float, float]) -> float:
    lo, hi = lo_hi
    return 10 ** ((lo + (hi - lo) * rng.random() ** 2) / 20)


def _pan(rng: np.random.Generator, width: float) -> tuple[float, float]:
    p = (rng.random() * 2 - 1) * width
    angle = (p + 1) * np.pi / 4
    return np.cos(angle) * np.sqrt(2), np.sin(angle) * np.sqrt(2)


def generate(n: int, seed: int = 0, sr: int = 48000, level_db: float = 0.0, params: dict | None = None) -> np.ndarray:
    p = {**CRACKLE, **(params or {})}
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2))

    hiss = rng.uniform(-1, 1, (n, 2)) * np.sqrt(3) * 10 ** (p['hiss_db'] / 20)
    out += _bandpass(hiss, p['hiss_hz'], p['hiss_q'], sr)

    rumble = rng.uniform(-1, 1, n) * np.sqrt(3) * 10 ** (p['rumble_db'] / 20)
    rumble = _one_pole_lowpass(_one_pole_lowpass(rumble, p['rumble_hz'], sr), p['rumble_hz'], sr)
    turn = 1 + p['rumble_swell'] * np.sin(2 * np.pi * p['rpm'] / 60 * np.arange(n) / sr + rng.random() * 6.28)
    out += (rumble * turn)[:, None]

    ticks = np.zeros((n, 2))
    for at in _events(rng, p['ticks_per_second'], n, sr):
        tau = rng.uniform(*p['tick_decay_ms']) / 1000 * sr
        length = min(int(6 * tau) + 2, n - at)
        k = np.arange(length)
        burst = rng.uniform(-1, 1, length) * np.exp(-k / tau) * _level(rng, p['tick_db'])
        left, right = _pan(rng, p['width'])
        ticks[at:at + length, 0] += burst * left
        ticks[at:at + length, 1] += burst * right
    out += _one_pole_highpass(ticks, p['tick_highpass_hz'], sr)

    for at in _events(rng, p['pops_per_second'], n, sr):
        tau = rng.uniform(*p['pop_decay_ms']) / 1000 * sr
        hz = rng.uniform(*p['pop_hz'])
        length = min(int(6 * tau) + 2, n - at)
        k = np.arange(length)
        pop = np.sin(2 * np.pi * hz * k / sr) * np.exp(-k / tau) * _level(rng, p['pop_db'])
        if rng.random() < 0.5:
            pop = -pop
        left, right = _pan(rng, p['width'] * 0.6)
        out[at:at + length, 0] += pop * left
        out[at:at + length, 1] += pop * right

    return out * 10 ** (level_db / 20)
