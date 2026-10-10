#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lofi  # noqa: E402
from sfxformat import SR, circular, finish_loop, finish_one_shot, print_measurements, write_sound  # noqa: E402

TAU = 2 * np.pi


def main() -> None:
    rng = np.random.default_rng(2026)
    sounds = {
        'sticker': [finish_one_shot(sticker(rng, length)) for length in (0.14, 0.17)],
        'cup-down': [finish_one_shot(cup_down(rng, pitch)) for pitch in (1.0, 0.92)],
        'sip': [finish_one_shot(sip(rng, length)) for length in (0.95, 1.05, 1.15)],
        'purr': [finish_loop(purr(rng), crossfade_s=0)],
        'pet-trill': [finish_one_shot(pet_trill(pitch, trill, length))
                      for pitch, trill, length in ((1.0, 27, 0.5), (0.94, 24, 0.58), (1.07, 30, 0.45))],
        'sleepy-chirp': [finish_one_shot(sleepy_chirp(rng, pitch, length))
                         for pitch, length in ((1.0, 0.6), (0.95, 0.7), (1.06, 0.5))],
        'stretch-yawn': [finish_one_shot(stretch_yawn(rng))],
    }
    for sound_id, variations in sounds.items():
        print_measurements(write_sound(sound_id, variations))


def sticker(rng: np.random.Generator, length: float) -> np.ndarray:
    t = time_axis(length)
    peel = envelope(t, [(0, 0), (0.3 * length, 1), (length, 0)])
    crackle = sparse_clicks(rng, len(t), rate=420) * peel
    rustle = rng.standard_normal(len(t)) * peel * 0.25
    paper = bandpass(crackle + rustle, 1500, 7000)
    return lofi.peaking(paper, 3500, 4, q=1.2)


def cup_down(rng: np.random.Generator, pitch: float, length: float = 0.42) -> np.ndarray:
    t = time_axis(length)
    knock = sum(a * strike(t, 0.01, f * pitch, tau) for f, tau, a in
                ((170, 0.045, 1.0), (390, 0.025, 0.6), (820, 0.012, 0.35), (1600, 0.006, 0.2)))
    thump = lofi.lowpass(rng.standard_normal(len(t)) * window(t, 0.01, 0.014, edge=0.002), 3000) * 0.4
    return lofi.lowpass(knock + thump + ice_rattle(rng, t, start=0.02, end=0.3), 7000)


def sip(rng: np.random.Generator, length: float) -> np.ndarray:
    t = time_axis(length)
    end = length - 0.22
    draw = envelope(t, [(0, 0), (0.06, 1), (end - 0.1, 0.85), (end, 0)])
    suction = formants(rng.standard_normal(len(t)), (900, 2100)) * draw * 0.35
    bubbles = gurgle(rng, t, start=0.08, end=end - 0.05, rate=28)
    release = strike(t, end + 0.02, 300, 0.008) * 0.5
    ice = ice_rattle(rng, t, start=end + 0.06, end=length - 0.04, count=2)
    return lofi.lowpass(suction + bubbles + release + ice, 7000)


def purr(rng: np.random.Generator, breath: float = 2.4, breaths: int = 2) -> np.ndarray:
    rate, level = breathing(breath, breaths)
    n = len(rate)
    pulses = pulse_train(rng, rate) * level
    rattle = circular_convolve(pulses, purr_pulse(rng))
    body = circular(lambda x: lofi.peaking(lofi.peaking(lofi.lowpass(x, 1000), 130, 6, q=1.0), 380, 4, q=1.2),
                    rattle)
    breath_noise = circular(lambda x: bandpass(x, 300, 1800), rng.standard_normal(n)) * level * 0.08
    return body + breath_noise


def pet_trill(pitch: float, trill_hz: float, length: float) -> np.ndarray:
    t = time_axis(length)
    freq = glide(t, [(0, 430), (0.06, 470), (0.62 * length, 820), (length, 640)]) * pitch
    voice = pulse_wave(freq, duty=0.25)
    rolled_r = 1 - 0.65 * (0.5 + 0.5 * np.sin(TAU * trill_hz * t)) * window(t, 0.06, 0.62 * length)
    mouth = envelope(t, [(0, 0), (0.06, 0), (0.1, 1), (length, 1)])
    shaped = lofi.lowpass(voice, 700) * (1 - mouth) + lofi.lowpass(voice, 3200) * mouth
    loudness = envelope(t, [(0, 0), (0.015, 0.7), (0.06, 0.8), (0.3, 1), (length - 0.08, 0.8), (length, 0)])
    return shaped * rolled_r * loudness


def sleepy_chirp(rng: np.random.Generator, pitch: float, length: float) -> np.ndarray:
    t = time_axis(length)
    freq = glide(t, [(0, 360), (0.42 * length, 330), (0.92 * length, 560), (length, 540)]) * pitch
    voice = triangle_wave(freq) + bandpass(rng.standard_normal(len(t)), 1000, 3000) * 0.15
    drowsy_r = 1 - 0.4 * (0.5 + 0.5 * np.sin(TAU * 18 * t)) * window(t, 0.05, 0.42 * length)
    loudness = envelope(t, [(0, 0), (0.04, 0.6), (0.6 * length, 1), (length - 0.06, 0.7), (length, 0)])
    return lofi.lowpass(voice * drowsy_r * loudness, 2200)


def stretch_yawn(rng: np.random.Generator, length: float = 1.3) -> np.ndarray:
    t = time_axis(length)
    freq = glide(t, [(0, 520), (0.9, 280), (length, 270)])
    voice = triangle_wave(freq) * 0.7 + pulse_wave(freq, duty=0.4) * 0.3
    breath = rng.standard_normal(len(t)) * 0.25
    opening = envelope(t, [(0, 0), (0.5, 1), (1.0, 0.3), (length, 0)])
    vowel = bandpass(voice + breath, 700, 1200) * opening + bandpass(voice + breath, 300, 700) * (1 - opening)
    yawn = vowel * envelope(t, [(0, 0), (0.12, 1), (0.85, 0.7), (1.0, 0), (length, 0)])
    squeak_freq = glide(t, [(0, 1300), (1.05, 1300), (1.17, 1650), (length, 1650)])
    squeak = pulse_wave(squeak_freq, duty=0.3) * window(t, 1.05, 1.17) * 0.35
    return lofi.lowpass(yawn + squeak, 4000)


def ice_rattle(rng: np.random.Generator, t: np.ndarray, start: float, end: float, count: int = 7) -> np.ndarray:
    hits = np.sort(rng.uniform(start, end, count))
    out = np.zeros_like(t)
    for at in hits:
        f = rng.uniform(2200, 4800)
        level = 0.3 * np.exp(-(at - start) / 0.1) * rng.uniform(0.4, 1.0)
        out += level * (strike(t, at, f, rng.uniform(0.003, 0.008)) + 0.5 * strike(t, at, f * 1.47, 0.004))
    return lofi.lowpass(out, 6000)


def gurgle(rng: np.random.Generator, t: np.ndarray, start: float, end: float, rate: float) -> np.ndarray:
    out = np.zeros_like(t)
    for at in rng.uniform(start, end, rng.poisson(rate * (end - start))):
        f0 = rng.uniform(300, 700)
        age = t - at
        alive = (age >= 0) & (age < 0.03)
        chirp = np.sin(TAU * f0 * (age + age**2 / 0.12)) * np.exp(-np.maximum(age, 0) / 0.012)
        out += np.where(alive, chirp, 0) * rng.uniform(0.05, 0.2)
    return out


def formants(x: np.ndarray, peaks: tuple[float, ...]) -> np.ndarray:
    y = bandpass(x, 400, 3000)
    for f in peaks:
        y = lofi.peaking(y, f, 9, q=2.5)
    return y


BREATH = ((0.95, 22.5, 0.55), (0.15, 22.5, 0.0), (1.15, 25.5, 1.0), (0.15, 25.5, 0.0))  # seconds, Hz, level


def breathing(breath: float, breaths: int) -> tuple[np.ndarray, np.ndarray]:
    scale = breath / sum(seconds for seconds, _, _ in BREATH)
    segments = [breath_segment(seconds * scale, hz, level) for seconds, hz, level in BREATH]
    rate = np.tile(np.concatenate([r for r, _ in segments]), breaths)
    level = np.tile(np.concatenate([lv for _, lv in segments]), breaths)
    into_last_pause = round(BREATH[-1][0] * scale / 2 * SR)
    return np.roll(rate, into_last_pause), np.roll(level, into_last_pause)


def breath_segment(seconds: float, hz: float, level: float) -> tuple[np.ndarray, np.ndarray]:
    n = round(seconds * SR)
    shape = np.full(n, level)
    if level:
        edge = round(0.08 * SR)
        ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, edge))
        shape[:edge] *= ramp
        shape[-edge:] *= ramp[::-1]
    return np.full(n, hz), shape


def pulse_train(rng: np.random.Generator, rate: np.ndarray) -> np.ndarray:
    phase = np.cumsum(rate) / SR
    ticks = np.flatnonzero(np.diff(np.floor(phase)) > 0) + 1
    out = np.zeros_like(rate)
    out[ticks] = rng.uniform(0.7, 1.0, len(ticks))
    return out


def purr_pulse(rng: np.random.Generator) -> np.ndarray:
    k = np.arange(round(0.02 * SR)) / SR
    return rng.standard_normal(len(k)) * np.exp(-k / 0.005) + 2.0 * np.sin(TAU * 80 * k) * np.exp(-k / 0.008)


def circular_convolve(x: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    return np.real(np.fft.ifft(np.fft.fft(x) * np.fft.fft(kernel, len(x))))


def sparse_clicks(rng: np.random.Generator, n: int, rate: float) -> np.ndarray:
    out = np.zeros(n)
    at = rng.integers(0, n, rng.poisson(rate * n / SR))
    out[at] = rng.exponential(1.0, len(at)) * rng.choice([-1, 1], len(at))
    return out


def strike(t: np.ndarray, at: float, freq: float, tau: float) -> np.ndarray:
    age = t - at
    return np.where(age >= 0, np.sin(TAU * freq * age) * np.exp(-np.maximum(age, 0) / tau), 0.0)


def pulse_wave(freq: np.ndarray, duty: float) -> np.ndarray:
    phase = TAU * np.cumsum(freq) / SR
    harmonics = int(8000 // freq.max())
    return sum(2 / (k * np.pi) * np.sin(k * np.pi * duty) * np.cos(k * phase) for k in range(1, harmonics + 1))


def triangle_wave(freq: np.ndarray) -> np.ndarray:
    phase = TAU * np.cumsum(freq) / SR
    harmonics = int(8000 // freq.max())
    return sum(8 / np.pi**2 * (-1) ** ((k - 1) // 2) * np.sin(k * phase) / k**2
               for k in range(1, harmonics + 1, 2))


def glide(t: np.ndarray, points: list[tuple[float, float]]) -> np.ndarray:
    times, freqs = zip(*points)
    return np.exp(np.interp(t, times, np.log(freqs)))


def envelope(t: np.ndarray, points: list[tuple[float, float]]) -> np.ndarray:
    times, levels = zip(*points)
    return np.interp(t, times, levels)


def window(t: np.ndarray, start: float, end: float, edge: float = 0.01) -> np.ndarray:
    return envelope(t, [(start - edge, 0), (start, 1), (end, 1), (end + edge, 0)])


def bandpass(x: np.ndarray, low: float, high: float) -> np.ndarray:
    return lofi.butter(x, 'bandpass', (low, high), order=2)


def time_axis(length: float) -> np.ndarray:
    return np.arange(round(length * SR)) / SR


if __name__ == '__main__':
    main()
