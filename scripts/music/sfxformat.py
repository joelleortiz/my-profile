from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

import lofi
from check_loop import ebur128

SR = 48000
ROOT = Path(__file__).resolve().parents[2]
SFX_DIR = ROOT / 'static' / 'audio' / 'sfx'
MANIFEST = ROOT / 'src' / 'lib' / 'audio' / 'sfx-manifest.ts'
WORK = ROOT / 'music' / 'work' / 'sfx'

ONE_SHOT_LUFS = -20.0
AMBIENT_LUFS = -26.0
PEAK_DBFS = -3.0
SOURCE_PEAK_DBFS = -3.5
MAX_LIMITING_DB = 4.0
FADE_S = 0.008
LOOP_CROSSFADE_S = 0.25
LOOP_HIGHPASS_HZ = 40.0
AAC_FRAME = 1024  # aac_at records the encoder delay but not the end padding, so lengths stay whole frames
SILENCE_DB = -50.0

LOOPS = {'purr'}
SOUND_IDS = ('sticker', 'cup-down', 'sip', 'purr', 'pet-trill', 'sleepy-chirp', 'stretch-yawn', 'meow-soft')

CODECS = {
    'ogg': ['-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-compression_level', '10', '-application', 'audio'],
    'm4a': ['-c:a', 'aac_at', '-b:a', '64k'],
}


@dataclass(frozen=True)
class Measured:
    path: str
    seconds: float
    momentary_max: float
    short_term_max: float
    integrated: float
    true_peak: float


def load(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1',
                          '-ar', str(SR), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def finish_one_shot(x: np.ndarray, gain_db: float = 0.0) -> np.ndarray:
    x = trim_silence(remove_dc(x))
    x = fit_loudness(x, ONE_SHOT_LUFS + gain_db)
    return pad_to_aac_frames(fade(x))


def fit_loudness(x: np.ndarray, target: float) -> np.ndarray:
    y = x * lofi.gain(target - momentary_max(x))
    peak = true_peak_db(y)
    if peak > SOURCE_PEAK_DBFS:
        y = lofi.limit(y[:, None], max(SOURCE_PEAK_DBFS, peak - MAX_LIMITING_DB))[:, 0]
        y = y * lofi.gain(min(0.0, SOURCE_PEAK_DBFS - true_peak_db(y)))
    return y


def true_peak_db(x: np.ndarray) -> float:
    return lofi.db(lofi.true_peak(x[:, None]))


def finish_loop(x: np.ndarray, gain_db: float = 0.0, crossfade_s: float = LOOP_CROSSFADE_S) -> np.ndarray:
    crossfade = round(crossfade_s * SR)
    if crossfade:
        x = make_loop(quiet_excerpt(x, crossfade), crossfade)
    if len(x) % AAC_FRAME:
        raise ValueError('a loop must be a whole number of AAC frames long')
    x = circular(lambda y: lofi.highpass(y, LOOP_HIGHPASS_HZ, order=2), x)
    return normalise(x, loop_loudness(x), AMBIENT_LUFS + gain_db)


def quiet_excerpt(x: np.ndarray, crossfade: int) -> np.ndarray:
    level = np.sqrt(uniform_filter1d(x**2, round(0.02 * SR)))
    start = int(np.argmin(level[:len(x) // 3]))
    ends = np.arange(start + crossfade + AAC_FRAME, len(x) + 1, AAC_FRAME)
    ends = ends[ends - crossfade >= 2 * len(x) // 3]
    if not len(ends):
        raise SystemExit('the excerpt is too short to loop; give it at least 3 seconds')
    end = ends[np.argmin(level[ends - crossfade])]
    return x[start:end]


def pad_to_aac_frames(x: np.ndarray) -> np.ndarray:
    return np.concatenate([x, np.zeros(-len(x) % AAC_FRAME)])


def circular(process, x: np.ndarray) -> np.ndarray:
    n = len(x)
    return process(np.tile(x, 3))[n:2 * n]


def reduce_noise(x: np.ndarray, strength: float = 1.5, floor: float = 0.1) -> np.ndarray:
    _, _, spectrum = signal.stft(x, SR, nperseg=2048, noverlap=1536)
    magnitude = np.abs(spectrum)
    noise = np.percentile(magnitude, 10, axis=1, keepdims=True)
    gain = np.clip(1 - strength * noise / (magnitude + 1e-12), floor, 1)
    _, y = signal.istft(spectrum * gain, SR, nperseg=2048, noverlap=1536)
    return y[:len(x)]


def remove_dc(x: np.ndarray) -> np.ndarray:
    return lofi.highpass(x, 20, order=2)


def trim_silence(x: np.ndarray) -> np.ndarray:
    envelope = np.convolve(np.abs(x), np.ones(96) / 96, 'same')
    loud = np.flatnonzero(envelope > envelope.max() * lofi.gain(SILENCE_DB))
    margin = round(0.005 * SR)
    return x[max(loud[0] - margin, 0):loud[-1] + margin]


def fade(x: np.ndarray) -> np.ndarray:
    n = round(FADE_S * SR)
    ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))
    y = x.copy()
    y[:n] *= ramp
    y[-n:] *= ramp[::-1]
    return y


def make_loop(x: np.ndarray, crossfade: int) -> np.ndarray:
    if crossfade == 0:
        return x
    angle = np.linspace(0, np.pi / 2, crossfade)
    y = x[:-crossfade].copy()
    y[:crossfade] = x[:crossfade] * np.sin(angle) + x[-crossfade:] * np.cos(angle)
    return y


def normalise(x: np.ndarray, loudness: float, target: float) -> np.ndarray:
    by_loudness = target - loudness
    by_peak = SOURCE_PEAK_DBFS - true_peak_db(x)
    return x * lofi.gain(min(by_loudness, by_peak))


def momentary_max(x: np.ndarray) -> float:
    block = round(0.4 * SR)
    padded = np.concatenate([np.zeros(block), x, np.zeros(block)])
    weighted = k_weighted(padded) ** 2
    cs = np.concatenate([[0.0], np.cumsum(weighted)])
    starts = np.arange(0, len(weighted) - block, round(0.01 * SR))
    return float(-0.691 + 10 * np.log10(np.max(cs[starts + block] - cs[starts]) / block + 1e-20))


def loop_loudness(x: np.ndarray) -> float:
    return lofi.loudness(np.tile(x, 3)[:, None])


def k_weighted(x: np.ndarray) -> np.ndarray:
    return signal.lfilter(*lofi.K_HIGHPASS, signal.lfilter(*lofi.K_SHELF, x))


def write_sound(sound_id: str, variations: list[np.ndarray]) -> list[Measured]:
    if sound_id not in SOUND_IDS:
        raise SystemExit(f"unknown sound id {sound_id!r}; use one of {', '.join(SOUND_IDS)}")
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    for old in SFX_DIR.glob(f'{sound_id}-*.*'):
        old.unlink()
    measured = []
    for n, x in enumerate(variations, start=1):
        measured += encode_within_peak(x, SFX_DIR / f'{sound_id}-{n}')
    write_manifest()
    return measured


def encode_within_peak(x: np.ndarray, base: Path) -> list[Measured]:
    for _ in range(4):
        encode(x, base)
        measured = [measure(base.with_suffix(f'.{ext}'), len(x)) for ext in CODECS]
        over = max(m.true_peak for m in measured) - (PEAK_DBFS - 0.05)
        if over <= 0:
            return measured
        x = x * lofi.gain(-over)
    raise ValueError(f'{base.name} stays above {PEAK_DBFS} dBTP after encoding')


def encode(x: np.ndarray, base: Path) -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    wav = WORK / f'{base.name}.wav'
    wavfile.write(wav, SR, x.astype(np.float32))
    for ext, args in CODECS.items():
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), *args,
                        str(base.with_suffix(f'.{ext}'))], check=True)


def measure(path: Path, expected_samples: int) -> Measured:
    decoded = load(path)
    if len(decoded) != expected_samples:
        raise ValueError(f'{path.name} decodes to {len(decoded)} samples, expected {expected_samples}')
    integrated, true_peak = ebur128(path)
    return Measured(path.name, len(decoded) / SR, momentary_max(decoded), short_term_max(decoded), integrated,
                    true_peak)


def short_term_max(x: np.ndarray) -> float:
    block = 3 * SR
    padded = np.concatenate([np.zeros(block), x, np.zeros(block)])
    weighted = k_weighted(padded) ** 2
    cs = np.concatenate([[0.0], np.cumsum(weighted)])
    starts = np.arange(0, len(weighted) - block, round(0.1 * SR))
    return float(-0.691 + 10 * np.log10(np.max(cs[starts + block] - cs[starts]) / block + 1e-20))


def write_manifest() -> None:
    variations = {sound_id: sorted(SFX_DIR.glob(f'{sound_id}-*.ogg'), key=variation_number) for sound_id in SOUND_IDS}
    lines = ['export const sfxFiles = {']
    for sound_id, files in variations.items():
        paths = ', '.join(f"'audio/sfx/{f.stem}'" for f in files)
        lines.append(f"\t'{sound_id}': [{paths}],")
    lines += ['} as const;', '']
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text('\n'.join(lines))
    subprocess.run(['npx', 'prettier', '--write', str(MANIFEST)], cwd=ROOT, capture_output=True)


def variation_number(path: Path) -> int:
    return int(path.stem.rsplit('-', 1)[1])


def print_measurements(measured: list[Measured]) -> None:
    for m in measured:
        print(f'{m.path:22s} {m.seconds:5.2f} s  momentary max {m.momentary_max:6.1f}  '
              f'short-term max {m.short_term_max:6.1f}  integrated {m.integrated:6.1f} LUFS  '
              f'true peak {m.true_peak:5.1f} dBTP')
