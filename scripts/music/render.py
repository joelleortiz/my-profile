#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ctypes
import ctypes.util
import os
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import mido
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose  # noqa: E402
import crackle  # noqa: E402
import lofi  # noqa: E402
import loopwrap  # noqa: E402
from lofi import SR  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'music' / 'work'
SOUNDFONT = WORK / 'soundfonts' / 'GeneralUser-GS.sf2'
SOUNDFONT_URL = 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2'
SOUNDFONT_LICENSE_URL = 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/documentation/LICENSE.txt'

LUFS_TARGET = -16.0
TRUE_PEAK_MAX = -1.5
MASTER_TRUE_PEAK = -2.5  # Opus and AAC add up to ~1 dB of overshoot
STEM_LUFS = {'keys': -20.0, 'lead': -21.0, 'bass': -21.0, 'drums': -22.0}
PAD_UNDER_KEYS_DB = 12.0
SUB_RATIO = 0.75  # sub RMS relative to the fingered bass
SEAM_FADE_S = 0.1
WRAP_MS = 0.0  # opt-in: Opus encoding that wraps the loop (loopwrap.py)
REVERB = {'synth.reverb.room-size': 0.62, 'synth.reverb.damp': 0.45,
          'synth.reverb.width': 0.9, 'synth.reverb.level': 0.7}


def load_fluidsynth() -> ctypes.CDLL:
    candidates = [os.environ.get('FLUIDSYNTH_LIB'), ctypes.util.find_library('fluidsynth'),
                  '/opt/homebrew/lib/libfluidsynth.dylib', '/usr/local/lib/libfluidsynth.dylib',
                  'libfluidsynth.so.3', 'libfluidsynth.so']
    for path in filter(None, candidates):
        try:
            lib = ctypes.CDLL(path)
            break
        except OSError:
            continue
    else:
        raise SystemExit('libfluidsynth not found: brew install fluid-synth (or set FLUIDSYNTH_LIB)')
    vp, cp, i, d = ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int, ctypes.c_double
    sigs = {
        'new_fluid_settings': ([], vp), 'delete_fluid_settings': ([vp], None),
        'fluid_settings_setnum': ([vp, cp, d], i), 'fluid_settings_setint': ([vp, cp, i], i),
        'new_fluid_synth': ([vp], vp), 'delete_fluid_synth': ([vp], None),
        'fluid_synth_sfload': ([vp, cp, i], i),
        'fluid_synth_noteon': ([vp, i, i, i], i), 'fluid_synth_noteoff': ([vp, i, i], i),
        'fluid_synth_cc': ([vp, i, i, i], i), 'fluid_synth_program_change': ([vp, i, i], i),
        'fluid_synth_pitch_bend': ([vp, i, i], i),
        'fluid_synth_write_float': ([vp, i, vp, i, i, vp, i, i], i),
    }
    for name, (args, res) in sigs.items():
        fn = getattr(lib, name)
        fn.argtypes, fn.restype = args, res
    return lib


@dataclass
class Song:
    events: list[tuple[int, int, str, int, int, int]]  # tick, order, kind, channel, a, b
    ppq: int
    bpm: float
    end_tick: int
    markers: dict[str, int]

    @property
    def samples_per_tick(self) -> float:
        return SR * 60 / (self.bpm * self.ppq)

    @property
    def loop_samples(self) -> int:
        return round(self.end_tick * self.samples_per_tick)

    @property
    def bars(self) -> int:
        return self.end_tick // (4 * self.ppq)

    def at(self, tick: int) -> int:
        return round(tick * self.samples_per_tick)


def read_song(path: Path) -> Song:
    mid = mido.MidiFile(path)
    events, markers, tempo, end = [], {}, None, 0
    for track in mid.tracks:
        now = 0
        for msg in track:
            now += msg.time
            if msg.type == 'set_tempo' and tempo is None:
                tempo = msg.tempo
            elif msg.type == 'marker':
                markers[msg.text] = now
            elif msg.type == 'note_on' and msg.velocity > 0:
                events.append((now, 3, 'on', msg.channel, msg.note, msg.velocity))
            elif msg.type in ('note_off', 'note_on'):
                events.append((now, 0, 'off', msg.channel, msg.note, 0))
            elif msg.type == 'control_change':
                events.append((now, 2, 'cc', msg.channel, msg.control, msg.value))
            elif msg.type == 'program_change':
                events.append((now, 1, 'prog', msg.channel, msg.program, 0))
            elif msg.type == 'pitchwheel':
                events.append((now, 2, 'bend', msg.channel, msg.pitch + 8192, 0))
        end = max(end, now)
    # MIDI stores whole microseconds per beat (666,667 at 90 BPM); use the nominal tempo
    bpm = round(mido.tempo2bpm(tempo or 500000), 3)
    return Song(sorted(events), mid.ticks_per_beat, bpm, end, markers)


def render_channels(lib: ctypes.CDLL, song: Song, channels: list[int], passes: float) -> np.ndarray:
    n_loop = song.loop_samples
    total = round(n_loop * passes)
    settings = lib.new_fluid_settings()
    for key, value in {'synth.sample-rate': float(SR), 'synth.gain': 0.5, **REVERB}.items():
        if lib.fluid_settings_setnum(settings, key.encode(), value) != 0:
            print(f'  warning: FluidSynth rejected {key}={value}')
    for key, value in {'synth.polyphony': 512, 'synth.reverb.active': 1,
                       'synth.chorus.active': 0, 'synth.cpu-cores': 1}.items():
        if lib.fluid_settings_setint(settings, key.encode(), value) != 0:
            print(f'  warning: FluidSynth rejected {key}={value}')
    synth = lib.new_fluid_synth(settings)
    if lib.fluid_synth_sfload(synth, str(SOUNDFONT).encode(), 1) < 0:
        raise SystemExit(f'could not load {SOUNDFONT}')

    left = np.zeros(total, dtype=np.float32)
    right = np.zeros(total, dtype=np.float32)
    lp, rp = left.ctypes.data, right.ctypes.data
    cur = 0

    def write_until(pos: int) -> None:
        nonlocal cur
        while cur < pos:
            n = min(pos - cur, 1 << 20)
            lib.fluid_synth_write_float(synth, n, lp, cur, 1, rp, cur, 1)
            cur += n

    timeline = []
    for p in range(int(np.ceil(passes))):
        for tick, order, kind, ch, a, b in song.events:
            if ch in channels:
                pos = song.at(tick) + p * n_loop
                if pos < total:
                    timeline.append((pos, order, kind, ch, a, b))
    timeline.sort()
    for pos, _, kind, ch, a, b in timeline:
        write_until(pos)
        if kind == 'on':
            lib.fluid_synth_noteon(synth, ch, a, b)
        elif kind == 'off':
            lib.fluid_synth_noteoff(synth, ch, a)
        elif kind == 'cc':
            lib.fluid_synth_cc(synth, ch, a, b)
        elif kind == 'prog':
            lib.fluid_synth_program_change(synth, ch, a)
        elif kind == 'bend':
            lib.fluid_synth_pitch_bend(synth, ch, a)
    write_until(total)
    lib.delete_fluid_synth(synth)
    lib.delete_fluid_settings(settings)
    return np.stack([left, right], axis=1)


def breakdown_envelope(song: Song, n: int) -> np.ndarray:
    env = np.zeros(n)
    if 'Breakdown' not in song.markers:
        return env
    start = song.at(song.markers['Breakdown'])
    after = [t for t in song.markers.values() if t > song.markers['Breakdown']]
    stop = song.at(min(after)) if after else song.loop_samples
    beat = song.at(song.ppq)
    one = np.zeros(song.loop_samples)
    one[start:stop] = 1.0
    ramp_in = min(beat // 2, stop - start)
    one[start:start + ramp_in] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ramp_in))
    ramp_out = 2 * beat
    one[stop - ramp_out:stop] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, ramp_out))
    reps = int(np.ceil(n / song.loop_samples))
    return np.tile(one, reps)[:n]


def darken(x: np.ndarray, env: np.ndarray, hz: float = 1300.0) -> np.ndarray:
    dark = lofi.lowpass(x, hz, order=2)
    return x * (1 - env[:, None]) + dark * env[:, None]


def loop_part(x: np.ndarray, n_loop: int) -> np.ndarray:
    return x[n_loop:2 * n_loop]


def match_lufs(x: np.ndarray, n_loop: int, target: float) -> np.ndarray:
    level = lofi.loudness(loop_part(x, n_loop))
    return x * lofi.gain(target - level)


def process(song: Song, raw: dict[str, np.ndarray], log) -> dict[str, np.ndarray]:
    n_loop = song.loop_samples
    n = len(raw['keys'])
    env = breakdown_envelope(song, n)

    keys = lofi.highpass(raw['keys'], 70)
    keys = lofi.chorus(keys, n_loop, mix=0.25)
    keys = lofi.tape_saturate(keys, drive_db=6)
    keys = lofi.peaking(keys, 2200, 2.5)  # presence: warm, not underwater
    keys = lofi.lowpass(keys, 4200)
    pad = lofi.highpass(raw['pad'], 90)
    pad = lofi.tape_saturate(pad, drive_db=3)
    pad = lofi.lowpass(pad, 2500)
    keys_lufs = lofi.loudness(loop_part(keys, n_loop))
    pad = match_lufs(pad, n_loop, keys_lufs - PAD_UNDER_KEYS_DB)
    keys = darken(keys + pad, env)

    lead = lofi.highpass(raw['lead'], 200)
    lead = lofi.tape_saturate(lead, drive_db=3)
    lead = lofi.peaking(lead, 2800, 2.0)
    lead = lofi.lowpass(lead, 4400)
    lead = darken(lead, env)

    # one tape machine: keys and lead share the same wow and flutter
    keys = lofi.wow_flutter(keys, n_loop)
    lead = lofi.wow_flutter(lead, n_loop)

    fingered = raw['bass'].mean(axis=1, keepdims=True)
    fingered = lofi.highpass(fingered, 30, order=4)
    fingered = lofi.lowpass(fingered, 1000)
    fingered = lofi.tape_saturate(fingered, drive_db=6)
    sub = raw['sub'].mean(axis=1, keepdims=True)
    sub = lofi.highpass(sub, 30, order=4)
    sub = lofi.lowpass(sub, 100, order=4)
    rms = lambda s: np.sqrt(np.mean(loop_part(s, n_loop) ** 2))  # noqa: E731
    sub *= SUB_RATIO * rms(fingered) / (rms(sub) + 1e-12)
    bass = np.repeat(fingered + sub, 2, axis=1)

    drums = lofi.highpass(raw['drums'], 30)
    drums = lofi.lowpass(drums, 6000)
    drums = lofi.bitcrush_mix(drums, bits=11, mix=0.3)
    level = 10 * np.log10(uniform_filter1d(np.mean(loop_part(drums, n_loop) ** 2, axis=1), 480) + 1e-12)
    drums, gr = lofi.compress(drums, threshold_db=np.percentile(level, 99) - 6, ratio=2.5,
                              attack_ms=8, release_ms=120)
    log(f'  drums compressor: up to {-gr.min():.1f} dB gain reduction')

    stems = {'keys': keys, 'lead': lead, 'bass': bass, 'drums': drums}
    for name, target in STEM_LUFS.items():
        stems[name] = match_lufs(stems[name], n_loop, target)
    return stems


def master(song: Song, stems: dict[str, np.ndarray], log) -> tuple[np.ndarray, dict[str, np.ndarray], dict]:
    n_loop = song.loop_samples
    mix = sum(stems.values())

    level = 10 * np.log10(uniform_filter1d(np.mean(loop_part(mix, n_loop) ** 2, axis=1), 1440) + 1e-12)
    mix, gr = lofi.compress(mix, threshold_db=np.percentile(level, 90), ratio=1.8,
                            attack_ms=25, release_ms=250, rms_ms=30)
    log(f'  glue compressor: {-np.percentile(gr[n_loop:2 * n_loop], 50):.1f} dB median, '
        f'{-gr[n_loop:2 * n_loop].min():.1f} dB max gain reduction')

    fade = round(SEAM_FADE_S * SR)
    report = {}

    def cut(x: np.ndarray) -> np.ndarray:
        loop = x[n_loop:2 * n_loop].copy()
        head = x[2 * n_loop:2 * n_loop + fade]
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fade))[:, None]
        loop[:fade] = head * (1 - w) + loop[:fade] * w
        return loop

    raw_loop = mix[n_loop:2 * n_loop]
    head = mix[2 * n_loop:2 * n_loop + fade]
    diff = np.sqrt(np.mean((head - raw_loop[:fade]) ** 2)) / (np.sqrt(np.mean(raw_loop[:fade] ** 2)) + 1e-12)
    report['pass_mismatch_db'] = lofi.db(diff)
    log(f'  pass 2 vs pass 3 over the first {SEAM_FADE_S * 1000:.0f} ms: {lofi.db(diff):.1f} dB (crossfaded away)')

    loop = cut(mix)
    stems = {k: cut(v) for k, v in stems.items()}

    out, lufs, tp, limited = finalise(loop, MASTER_TRUE_PEAK)
    report.update(lufs=lufs, true_peak=tp, samples=len(out))
    log(f'  limiter: {limited:.2f} dB average gain change')
    log(f'  master: {len(out)} samples, {lufs:.2f} LUFS, {tp:.2f} dBTP (internal meter)')
    return out, stems, report


def finalise(loop: np.ndarray, max_true_peak: float) -> tuple[np.ndarray, float, float, float]:
    ceiling = max_true_peak - 0.1
    g = lofi.gain(LUFS_TARGET - lofi.loudness(loop))
    for _ in range(8):
        out = lofi.limit(loop * g, ceiling)
        lufs, tp = lofi.loudness(out), lofi.db(lofi.true_peak(out, circular=True))
        if abs(lufs - LUFS_TARGET) < 0.05 and tp <= max_true_peak:
            break
        g *= lofi.gain(LUFS_TARGET - lufs)
        if tp > max_true_peak:
            ceiling -= tp - (max_true_peak - 0.05)
    limited = lofi.db(np.sqrt(np.mean(out**2)) / (np.sqrt(np.mean((loop * g) ** 2)) + 1e-12))
    return out, lufs, tp, limited


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, SR, x.astype(np.float32))


def ffmpeg(*args: str) -> None:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def write_preview(song: Song, loop: np.ndarray, path: Path, title: str, crackle_seed: int, log) -> None:
    bar = song.loop_samples // song.bars
    x = np.concatenate([loop, loop[:8 * bar]])
    x = x + crackle.generate(len(x), seed=crackle_seed, sr=SR)
    fade = 2 * bar
    x[-fade:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade)))[:, None]
    log(f'  preview with crackle: {lofi.loudness(x):.2f} LUFS, {lofi.db(lofi.true_peak(x)):.2f} dBTP')
    tmp = WORK / 'tmp-preview.wav'
    write_wav(tmp, x)
    path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg('-i', str(tmp), '-c:a', 'libmp3lame', '-q:a', '3', '-metadata', f'title={title}',
           '-metadata', 'artist=joelleortiz.me', str(path))
    tmp.unlink()
    log(f'  preview: {path} ({path.stat().st_size / 1e6:.2f} MB, loop point at '
        f'{song.loop_samples / SR // 60:.0f}:{song.loop_samples / SR % 60:05.2f})')


CODECS = {
    'ogg': ['-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', '-compression_level', '10', '-application', 'audio'],
    'm4a': ['-c:a', 'aac_at', '-b:a', '96k', '-movflags', '+faststart'],
}


def export(loop: np.ndarray, out_dir: Path, log, wrap_ms: float = WRAP_MS) -> None:
    from check_loop import ebur128

    out_dir.mkdir(parents=True, exist_ok=True)
    for ext, args in CODECS.items():
        path = out_dir / f'lofi-loop.{ext}'
        pad = round(wrap_ms / 1000 * SR) if ext == 'ogg' else 0
        x, max_tp = loop, MASTER_TRUE_PEAK
        for _ in range(5):
            encode(x, path, args, pad)
            lufs, tp = ebur128(path)
            if tp <= TRUE_PEAK_MAX - 0.1:  # ffmpeg reports one decimal
                break
            max_tp -= tp - (TRUE_PEAK_MAX - 0.15)
            x = finalise(loop, max_tp)[0]
        log(f'  export: {path} ({path.stat().st_size / 1e6:.2f} MB, {lufs:.1f} LUFS, {tp:.1f} dBTP, '
            f'master limited to {max_tp:.1f} dBTP, wrapped {pad / SR * 1000:g} ms)')


def encode(loop: np.ndarray, path: Path, codec_args: list[str], pad: int) -> None:
    tmp = WORK / 'tmp-export.wav'
    write_wav(tmp, loopwrap.wrap(loop, pad))
    ffmpeg('-i', str(tmp), *codec_args, str(path))
    tmp.unlink()
    if pad:
        loopwrap.trim_ogg_opus(path, pad, len(loop))


def ensure_soundfont(log) -> None:
    if SOUNDFONT.exists():
        return
    SOUNDFONT.parent.mkdir(parents=True, exist_ok=True)
    log(f'downloading GeneralUser GS from {SOUNDFONT_URL}')
    urllib.request.urlretrieve(SOUNDFONT_URL, SOUNDFONT)
    urllib.request.urlretrieve(SOUNDFONT_LICENSE_URL, SOUNDFONT.with_name('GeneralUser-GS-LICENSE.txt'))


def render(mid: Path, name: str, preview: Path | None = None, preview_title: str = '',
           export_dir: Path | None = None, crackle_seed: int = 7, wrap_ms: float = WRAP_MS) -> dict:
    log = print
    ensure_soundfont(log)
    song = read_song(mid)
    n_loop = song.loop_samples
    log(f'{mid.name}: {song.bars} bars at {song.bpm:g} BPM = {n_loop} samples ({n_loop / SR:.4f} s)')
    if n_loop % 64:
        log('  note: the loop is not a whole number of 64-sample FluidSynth blocks')

    lib = load_fluidsynth()
    head_bars = 4
    passes = 2 + head_bars / song.bars
    raw = {}
    for stem, spec in compose.TRACKS.items():
        raw[stem] = render_channels(lib, song, [spec['channel']], passes)
    log(f'  rendered {len(raw)} stems x {passes:.3f} passes')

    stems = process(song, raw, log)
    loop, loop_stems, report = master(song, stems, log)

    out = WORK / name
    for stem, x in loop_stems.items():
        write_wav(out / 'stems' / f'{stem}.wav', x)
    master_wav = out / 'lofi-loop.wav'
    write_wav(master_wav, loop)
    low, mid_band, high = lofi.band_energy(loop)
    report['bands'] = (low, mid_band, high)
    log(f'  energy: {low:.0%} below 400 Hz, {mid_band:.0%} 400 Hz-2 kHz, {high:.1%} above 2 kHz')
    log(f'  wrote {master_wav}')
    if preview:
        write_preview(song, loop, preview, preview_title or name, crackle_seed, log)
    if export_dir:
        export(loop, export_dir, log, wrap_ms)
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description='Render the MIDI loop into a seamless, mastered lo-fi loop.')
    ap.add_argument('--mid', type=Path, default=compose.OUT)
    ap.add_argument('--name', default='main', help='folder under music/work for stems and the master WAV')
    ap.add_argument('--preview', type=Path, help='also write an MP3 preview with crackle baked in')
    ap.add_argument('--title', default='', help='title tag for the preview MP3')
    ap.add_argument('--export', type=Path, help='write lofi-loop.ogg and lofi-loop.m4a into this folder')
    ap.add_argument('--crackle-seed', type=int, default=7)
    ap.add_argument('--wrap-ms', type=float, default=WRAP_MS,
                    help='loop audio the encoder sees on each side (0 = plain encode)')
    args = ap.parse_args()
    render(args.mid, args.name, args.preview, args.title, args.export, args.crackle_seed, args.wrap_ms)


if __name__ == '__main__':
    main()
