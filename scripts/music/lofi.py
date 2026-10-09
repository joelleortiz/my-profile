from __future__ import annotations

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


def gain(decibels: float) -> float:
    return 10 ** (decibels / 20)


def butter(x: np.ndarray, kind: str, freq: float | tuple[float, float], order: int = 2) -> np.ndarray:
    sos = signal.butter(order, freq, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def lowpass(x: np.ndarray, freq: float, order: int = 2) -> np.ndarray:
    return butter(x, 'lowpass', freq, order)


def highpass(x: np.ndarray, freq: float, order: int = 2) -> np.ndarray:
    return butter(x, 'highpass', freq, order)


def peaking(x: np.ndarray, freq: float, gain_db: float, q: float = 0.8) -> np.ndarray:
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * freq / SR
    alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * a, -2 * np.cos(w0), 1 - alpha * a]
    den = [1 + alpha / a, -2 * np.cos(w0), 1 - alpha / a]
    return signal.lfilter(np.array(b) / den[0], np.array(den) / den[0], x, axis=0)


def tape_saturate(x: np.ndarray, drive_db: float = 6.0, bias: float = 0.08) -> np.ndarray:
    ref = np.percentile(np.abs(x), 99.9) + 1e-12
    k = 0.25 * gain(drive_db) / ref
    y = (np.tanh(k * x + bias) - np.tanh(bias)) / k
    y = highpass(y, 15)  # remove the DC the asymmetry creates
    return y * (np.sqrt(np.mean(x**2)) / (np.sqrt(np.mean(y**2)) + 1e-12))


def bitcrush_mix(x: np.ndarray, bits: int = 11, mix: float = 0.3) -> np.ndarray:
    peak = np.max(np.abs(x)) + 1e-12
    step = 2.0 / 2**bits
    crushed = np.round(x / peak / step) * step * peak
    return (1 - mix) * x + mix * crushed


def lfo(n: int, freq: float, loop_samples: int, phase: float = 0.0, start: int = 0) -> np.ndarray:
    # nudged to a whole number of cycles per loop, so loops stay seamless
    loop_seconds = loop_samples / SR
    cycles = max(1, round(freq * loop_seconds))
    f = cycles / loop_seconds
    t = (np.arange(n) + start) / SR
    return np.sin(2 * np.pi * f * t + phase)


def fractional_delay(x: np.ndarray, delay: np.ndarray, chunk: int = 1 << 19) -> np.ndarray:
    out = np.empty_like(x)
    for s in range(0, len(x), chunk):
        n = np.arange(s, min(s + chunk, len(x)))
        pos = n - delay[n]
        i = np.floor(pos).astype(np.int64)
        f = (pos - i)[:, None]
        p0, p1, p2, p3 = (x[np.clip(i + k, 0, len(x) - 1)] for k in (-1, 0, 1, 2))
        out[n] = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)))
    return out


def wow_flutter(x: np.ndarray, loop_samples: int, wow_cents: float = 5.0, wow_hz: float = 0.5,
                flutter_cents: float = 1.0, flutter_hz: float = 5.5) -> np.ndarray:
    def depth(cents: float, hz: float) -> float:
        # delay amplitude A gives a peak pitch ratio of 1 + A*2*pi*f
        return (2 ** (cents / 1200) - 1) / (2 * np.pi * hz) * SR

    a_w, a_f = depth(wow_cents, wow_hz), depth(flutter_cents, flutter_hz)
    d = 4 + a_w + a_f + a_w * lfo(len(x), wow_hz, loop_samples) + a_f * lfo(len(x), flutter_hz, loop_samples, 1.3)
    return fractional_delay(x, d)


def chorus(x: np.ndarray, loop_samples: int, mix: float = 0.25, base_ms: tuple[float, float] = (13.0, 18.0),
           depth_ms: float = 1.2, rates: tuple[float, float] = (0.375, 0.5)) -> np.ndarray:
    mono = x.mean(axis=1, keepdims=True)
    out = x.copy()
    for ch in range(x.shape[1]):
        d = (base_ms[ch % 2] + depth_ms * lfo(len(x), rates[ch % 2], loop_samples, ch * 1.7)) * SR / 1000
        out[:, ch] = (1 - mix) * x[:, ch] + mix * fractional_delay(mono, d)[:, 0]
    return out


def compress(x: np.ndarray, threshold_db: float, ratio: float, attack_ms: float, release_ms: float,
             knee_db: float = 6.0, rms_ms: float = 10.0) -> tuple[np.ndarray, np.ndarray]:
    hop = 32
    power = np.mean(x**2, axis=1)
    a = np.exp(-1 / (rms_ms / 1000 * SR))
    power = signal.lfilter([1 - a], [1, -a], power)
    level = 10 * np.log10(power[::hop] + 1e-12)
    over = level - threshold_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 / ratio - 1),
                           (1 / ratio - 1) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    rate = SR / hop
    att, rel = np.exp(-1 / (attack_ms / 1000 * rate)), np.exp(-1 / (release_ms / 1000 * rate))
    smooth = np.empty_like(gr)
    g = 0.0
    for i, target in enumerate(gr.tolist()):
        coef = att if target < g else rel
        g = target + coef * (g - target)
        smooth[i] = g
    gr_full = np.interp(np.arange(len(x)), np.arange(len(smooth)) * hop, smooth)
    return x * (10 ** (gr_full / 20))[:, None], gr_full


def oversampled_peaks(x: np.ndarray, circular: bool = True, chunk: int = 1 << 18) -> np.ndarray:
    pad = 256
    if circular:
        padded = np.concatenate([x[-pad:], x, x[:pad]])
    else:
        z = np.zeros((pad, x.shape[1]))
        padded = np.concatenate([z, x, z])
    peaks = np.empty(len(x))
    for s in range(0, len(x), chunk):
        e = min(s + chunk, len(x))
        up = signal.resample_poly(padded[s:e + 2 * pad], 4, 1, axis=0)[4 * pad:4 * (pad + e - s)]
        peaks[s:e] = np.abs(up).reshape(e - s, -1).max(axis=1)
    return peaks


def true_peak(x: np.ndarray, circular: bool = False) -> float:
    return float(oversampled_peaks(x, circular).max())


def limit(x: np.ndarray, ceiling_db: float, window_ms: float = 20.0) -> np.ndarray:
    # The gain is a moving average of a windowed minimum of the required gain, so it never
    # exceeds what any nearby peak needs. Everything wraps, keeping loops seamless.
    peaks = oversampled_peaks(x, circular=True)
    need = np.minimum(1.0, gain(ceiling_db) / np.maximum(peaks, 1e-12))
    w = int(window_ms / 1000 * SR)
    held = minimum_filter1d(need, size=2 * w + 1, mode='wrap')
    g = uniform_filter1d(held, size=w, mode='wrap')
    return x * g[:, None]


K_SHELF = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
K_HIGHPASS = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def loudness(x: np.ndarray) -> float:
    if x.ndim == 1:
        x = x[:, None]
    y = signal.lfilter(*K_SHELF, x, axis=0)
    y = signal.lfilter(*K_HIGHPASS, y, axis=0)
    block, step = int(0.4 * SR), int(0.1 * SR)
    if len(y) < block:
        return -np.inf
    cs = np.concatenate([np.zeros((1, y.shape[1])), np.cumsum(y**2, axis=0)])
    starts = np.arange(0, len(y) - block + 1, step)
    z = (cs[starts + block] - cs[starts]) / block
    lk = -0.691 + 10 * np.log10(z.sum(axis=1) + 1e-20)
    gated = lk > -70
    if not gated.any():
        return -np.inf
    rel = -0.691 + 10 * np.log10(z[gated].mean(axis=0).sum()) - 10
    gated &= lk > rel
    return float(-0.691 + 10 * np.log10(z[gated].mean(axis=0).sum()))


def band_energy(x: np.ndarray, edges: tuple[float, ...] = (400.0, 2000.0)) -> list[float]:
    spec = np.abs(np.fft.rfft(x.mean(axis=1))) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    total = spec.sum()
    bounds = (0.0, *edges, SR / 2 + 1)
    return [float(spec[(freqs >= lo) & (freqs < hi)].sum() / total) for lo, hi in zip(bounds[:-1], bounds[1:])]
