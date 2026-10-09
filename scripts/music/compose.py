#!/usr/bin/env python3
from __future__ import annotations

import argparse
import random
from dataclasses import dataclass, field
from pathlib import Path

import mido

TEMPO_BPM = 90
KEY = 'G'  # the parts are written in G major and transposed to KEY
BARS = 48
LEAD_PROGRAM = 11  # General MIDI, 0-based: 8 celesta, 10 music box, 11 vibraphone
SEED = 523
COLOUR = 'bright-b'
DRUM_KIT = 0  # GS kit: 0 standard, 8 room, 32 jazz, 40 brush
OUT = Path(__file__).resolve().parents[2] / 'music' / 'lofi-loop.mid'

PPQ = 480
BEAT = PPQ
BAR = 4 * BEAT
SIXTEENTH = BEAT // 4

LEAD_NAMES = {8: 'Celesta', 9: 'Glockenspiel', 10: 'Music Box', 11: 'Vibraphone', 13: 'Xylophone'}

# render.py reads the channel map from here.
TRACKS = {
    'keys': dict(name='Keys - Electric Piano 1', channel=0, program=4, volume=100, pan=50, reverb=52),
    'lead': dict(name='Lead', channel=1, program=None, volume=96, pan=78, reverb=64),
    'bass': dict(name='Bass - Fingered', channel=2, program=33, volume=104, pan=64, reverb=6),
    'sub': dict(name='Sub - Synth Bass 1', channel=3, program=38, volume=96, pan=64, reverb=0),
    'pad': dict(name='Pad - Warm', channel=4, program=89, volume=58, pan=64, reverb=84),
    'drums': dict(name='Drums', channel=9, program=None, volume=100, pan=64, reverb=26),
}

KICK, SIDESTICK, SNARE, CLOSED_HAT, OPEN_HAT, SHAKER = 36, 37, 38, 42, 46, 70

NOTE_INDEX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
MAJOR_KEYS = {  # key name -> (pitch class, name mido accepts for the key-signature event)
    'C': (0, 'C'), 'C#': (1, 'Db'), 'Db': (1, 'Db'), 'D': (2, 'D'), 'D#': (3, 'Eb'),
    'Eb': (3, 'Eb'), 'E': (4, 'E'), 'F': (5, 'F'), 'F#': (6, 'F#'), 'Gb': (6, 'Gb'),
    'G': (7, 'G'), 'G#': (8, 'Ab'), 'Ab': (8, 'Ab'), 'A': (9, 'A'), 'A#': (10, 'Bb'),
    'Bb': (10, 'Bb'), 'B': (11, 'B'),
}


def note(name: str) -> int:
    pitch = NOTE_INDEX[name[0]]
    rest = name[1:]
    while rest and rest[0] in '#b':
        pitch += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return pitch + 12 * (int(rest) + 1)


@dataclass(frozen=True)
class Chord:
    root: str
    keys: tuple[str, ...]
    pad: tuple[str, ...] = ()


CHORDS = {
    'Cmaj9': Chord('C', ('D4', 'E4', 'G4', 'B4'), ('C3', 'G3', 'E4')),
    'Cmaj9^': Chord('C', ('E4', 'G4', 'B4', 'D5')),
    'D69': Chord('D', ('E4', 'F#4', 'A4', 'B4')),
    'Bm7': Chord('B', ('D4', 'E4', 'F#4', 'A4'), ('B2', 'F#3', 'D4')),
    'Em9': Chord('E', ('D4', 'F#4', 'G4', 'B4')),
    'E7b9': Chord('E', ('D4', 'F4', 'G#4', 'B4')),
    'Am9': Chord('A', ('C4', 'E4', 'G4', 'B4')),
    'D9sus4': Chord('D', ('C4', 'E4', 'G4', 'A4')),
    'Fmaj9': Chord('F', ('E4', 'G4', 'A4', 'C5')),
    'Gmaj9': Chord('G', ('F#4', 'A4', 'B4', 'D5')),
    'A9sus4^': Chord('A', ('E4', 'G4', 'B4', 'D5')),
    'A9^': Chord('A', ('E4', 'G4', 'B4', 'C#5')),
    'A9sus4': Chord('A', ('D4', 'E4', 'G4', 'B4')),
    'A9': Chord('A', ('C#4', 'E4', 'G4', 'B4')),
    'Cm6': Chord('C', ('D4', 'Eb4', 'G4', 'A4'), ('C3', 'G3', 'Eb4')),
    'Bbmaj7#11': Chord('Bb', ('D4', 'E4', 'F4', 'A4'), ('Bb2', 'F3', 'D4')),
    'Dm9': Chord('D', ('C4', 'E4', 'F4', 'A4')),
    'G13': Chord('G', ('B3', 'E4', 'F4', 'A4')),
    'E9sus4': Chord('E', ('D4', 'F#4', 'A4', 'B4')),
    'D9^': Chord('D', ('F#4', 'A4', 'C5', 'E5')),
    'D9sus4^': Chord('D', ('E4', 'G4', 'A4', 'C5')),
    'D9sus4 bd': Chord('D', ('C4', 'E4', 'G4', 'A4'), ('D3', 'A3', 'E4')),
    'Gmaj9 bd': Chord('G', ('D4', 'F#4', 'A4', 'B4'), ('G2', 'D3', 'B3')),
}

# A bar is a list of chord names; two names split the bar into halves.
A_LOOP = [['Cmaj9'], ['D69'], ['Bm7'], ['Em9']]
A_TURN = [['Cmaj9'], ['D69'], ['Bm7', 'E7b9'], ['Am9', 'D9sus4']]
A_TURN_SUS = [['Cmaj9'], ['D69'], ['Bm7', 'E9sus4'], ['Am9', 'D9sus4']]
TURNAROUND_CHART = [['Cmaj9'], ['D69'], ['Bm7'], ['Em9'],
                    ['Cmaj9'], ['Bm7'], ['Am9'], ['Dm9', 'G13']]

B_BORROWED = [['Cmaj9^'], ['Fmaj9'], ['Gmaj9'], ['A9sus4^', 'A9^'],
              ['Cmaj9^'], ['Fmaj9'], ['Em9'], ['A9sus4', 'A9']]
B_BRIGHT = [['Cmaj9^'], ['D9^'], ['Gmaj9'], ['A9sus4^', 'A9^'],
            ['Cmaj9^'], ['D9sus4^'], ['Em9'], ['A9sus4', 'A9']]
BREAKDOWN_BORROWED = [['Cmaj9'], ['Cm6'], ['Bm7'], ['Bbmaj7#11']]
BREAKDOWN_DIATONIC = [['Cmaj9'], ['D9sus4 bd'], ['Bm7'], ['Gmaj9 bd']]
B_LEAD = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']
B_LEAD_BRIGHT = ['b1', 'b2 V9', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']
_BORROWED = dict(b=B_BORROWED, b_lead=B_LEAD, breakdown=BREAKDOWN_BORROWED,
                 breakdown_lead=['bd1', 'bd2', 'bd3', 'bd4'], turn=A_TURN, call4='call4', call4v='call4v')
_BRIGHT_B = {**_BORROWED, 'b': B_BRIGHT, 'b_lead': B_LEAD_BRIGHT}
_DIATONIC = {**_BRIGHT_B, 'breakdown': BREAKDOWN_DIATONIC, 'breakdown_lead': ['bd1', 'bd2', 'bd3', 'bd4 I']}
COLOURS = {
    'borrowed': _BORROWED,
    'bright-b': _BRIGHT_B,
    'diatonic': _DIATONIC,
    'diatonic-e': {**_DIATONIC, 'turn': A_TURN_SUS, 'call4': 'call4 sus', 'call4v': 'call4v sus'},
}
G_MAJOR = {0, 2, 4, 6, 7, 9, 11}  # pitch classes, before transposition

# One bar per string: 'beat:length:pitch' with 0-based beats.
P = {
    'call1': '0.5:0.5:D5 1:0.5:G5 1.5:0.5:B5 2:1:D6 3:0.75:B5',
    'resp1': '0:1.5:A5 1.5:0.5:B5 2:0.5:A5 2.5:1.5:E5',
    'call2': '0.5:0.5:A4 1:0.5:D5 1.5:0.5:F#5 2:1:A5 3:0.75:F#5',
    'resp2': '0:1.5:G5 1.5:0.5:F#5 2:0.5:E5 2.5:1.5:D5',
    'call3': '0.5:0.5:D5 1:0.5:G5 1.5:0.5:B5 2:1:E6 3:0.75:D6',
    'resp3': '0:1.5:B5 1.5:0.5:A5 2:0.5:F#5 2.5:1.5:E5',
    'call4': '0.5:0.5:D5 1:0.5:F#5 1.5:1:A5 2.5:0.5:G#5 3:1:B5',
    'resp4': '0:1.5:B5 1.5:0.5:A5 2:0.5:G5 2.5:1.5:E5',
    'call4 sus': '0.5:0.5:D5 1:0.5:F#5 1.5:1:A5 2.5:0.5:F#5 3:1:B5',
    'b1': '0.5:0.5:G5 1:0.5:B5 1.5:1:E6 2.5:1.5:D6',
    'b2': '0:1:C6 1:0.5:A5 1.5:1.5:G5',
    'b3': '0.5:0.5:F#5 1:0.5:A5 1.5:1:D6 2.5:1.5:B5',
    'b4': '0:1.5:A5 1.5:0.5:B5 2:1:C#6 3:1:B5',
    'b5': '0:0.5:E6 0.5:0.5:D6 1:1:B5 2:0.5:G5 2.5:1.5:A5',
    'b6': '0:1.5:G5 1.5:0.5:A5 2:2:E5',
    'b7': '0.5:0.5:B4 1:0.5:D5 1.5:0.5:E5 2:1:G5 3:0.75:F#5',
    'b8': '0:1.5:E5 1.5:0.5:D5 2:2:C#5',
    'b2 V9': '0:1:C6 1:0.5:A5 1.5:1.5:F#5',
    'bd1': '1:1:D5 2:1:G5 3:1:B5',
    'bd2': '0:2:D6 2:1:C6 3:1:A5',
    'bd3': '0:1.5:A5 1.5:0.5:B5 2:2:F#5',
    'bd4': '0:1.5:F5 1.5:0.5:A5 2:1:D6 3:1:E6',
    'bd4 I': '0:1.5:F#5 1.5:0.5:A5 2:1:D6 3:1:E6',
    'call1v': '0.5:0.5:D5 1:0.5:G5 1.5:0.5:B5 1.875:0.125:C6 2:1:D6 3:0.5:B5 3.5:0.5:G5',
    'resp1v': '0:1:A5 1:0.5:B5 1.5:0.5:D6 2:0.5:B5 2.5:1.5:A5',
    'call2v': '0.5:0.5:A4 1:0.5:D5 1.5:0.5:F#5 2:1:A5 3:0.5:B5 3.5:0.5:A5',
    'resp2v': '0:1.5:G5 1.5:0.5:B5 2:0.5:A5 2.5:1.5:G5',
    'call1i': '0.5:0.5:D6 1:0.5:B5 1.5:0.5:G5 2:0.5:B5 2.5:1.5:E6',
    'resp1i': '0:1.5:D6 1.5:0.5:B5 2:0.5:A5 2.5:1.5:E5',
    'call2i': '0.5:0.5:A5 1:0.5:F#5 1.5:0.5:D5 2:0.5:F#5 2.5:1.5:B5',
    'resp2i': '0:1.5:A5 1.5:0.5:G5 2:0.5:F#5 2.5:1.5:E5',
    'call3v': '0.5:0.5:D5 1:0.5:G5 1.5:0.5:B5 2:1:E6 3:0.5:D6 3.5:0.5:B5',
    'resp3v': '0:1.5:A5 1.5:0.5:B5 2:0.5:A5 2.5:0.5:F#5 3:1:E5',
    'call4v': '0.5:0.5:D5 1:0.5:F#5 1.5:1:A5 2.5:0.5:G#5 3:0.5:B5 3.5:0.5:D6',
    'call4v sus': '0.5:0.5:D5 1:0.5:F#5 1.5:1:A5 2.5:0.5:F#5 3:0.5:B5 3.5:0.5:D6',
    'resp4v': '0:1.5:C6 1.5:0.5:B5 2:0.5:A5 2.5:1.5:E5',
    't1': '0.5:0.5:D5 1:0.5:G5 1.5:1.5:B5',
    't3': '0.5:0.5:A4 1:0.5:D5 1.5:1.5:F#5',
    't5': '2:2:D6',
    't6': '0:1.5:A5 1.5:0.5:B5 2:2:F#5',
    't8': '2:0.5:F5 2.5:0.5:E5 3:0.5:D5 3.5:0.5:B4',
}
A2_BLOCKS = [
    ['call1v', 'resp1v', 'call2v', 'resp2v'],
    ['call1i', 'resp1i', 'call2i', 'resp2i'],
]
A2_LAST = ['call3v', 'resp3v', 'call4v', 'resp4v']


@dataclass
class Bar:
    number: int  # 1-based
    section: str
    chords: list[str]
    lead: str | None = None


def build_form(bars: int, colour: str = 'borrowed') -> list[Bar]:
    if bars % 4 or bars < 40:
        raise SystemExit('BARS must be a multiple of 4 and at least 40')
    if colour not in COLOURS:
        raise SystemExit(f"COLOUR must be one of {', '.join(COLOURS)}")
    c = COLOURS[colour]
    a2_len = bars - 36
    form: list[tuple[str, list[list[str]], list[str | None]]] = [
        ('A', A_LOOP + A_TURN, [None] * 8),
        ("A'", A_LOOP + c['turn'], ['call1', 'resp1', 'call2', 'resp2', 'call3', 'resp3', c['call4'], 'resp4']),
        ('B', c['b'], c['b_lead']),
        ('Breakdown', c['breakdown'], c['breakdown_lead']),
    ]
    a2_chords: list[list[str]] = []
    a2_lead: list[str | None] = []
    blocks = a2_len // 4
    for i in range(blocks - 1):
        a2_chords += A_LOOP
        a2_lead += A2_BLOCKS[i % len(A2_BLOCKS)]
    a2_chords += c['turn']
    a2_lead += [c['call4v'] if p == 'call4v' else p for p in A2_LAST]
    form.append(("A''", a2_chords, a2_lead))
    form.append(('Turnaround', TURNAROUND_CHART, ['t1', None, 't3', None, 't5', 't6', None, 't8']))

    out: list[Bar] = []
    for section, chart, lead in form:
        for chords, phrase in zip(chart, lead, strict=True):
            out.append(Bar(len(out) + 1, section, chords, phrase))
    assert len(out) == bars
    return out


@dataclass
class Track:
    key: str
    notes: list[tuple[int, int, int, int]] = field(default_factory=list)  # start, end, pitch, vel
    controls: list[tuple[int, int, int]] = field(default_factory=list)  # tick, cc, value

    def add(self, start: float, end: float, pitch: int, vel: float) -> None:
        self.notes.append((round(start), round(end), pitch, max(1, min(127, round(vel)))))


class Composer:
    def __init__(self, tempo: float, key: str, bars: int, lead_program: int, seed: int,
                 colour: str = 'borrowed'):
        self.tempo = tempo
        self.bars = bars
        self.end = bars * BAR
        self.lead_program = lead_program
        self.seed = seed
        self.colour = colour
        self.key = key
        if key not in MAJOR_KEYS:
            raise SystemExit(f'unknown key {key!r}; use a major key name such as G, F, Bb, D')
        self.key_signature = MAJOR_KEYS[key][1]
        offset = (MAJOR_KEYS[key][0] - 7) % 12
        self.transpose = offset - 12 if offset > 5 else offset
        self.form = build_form(bars, colour)
        self.tracks = {k: Track(k) for k in TRACKS}
        self.prev_bass = note('C2')

    # per-part random generators, so editing one part does not reshuffle the others
    def rng(self, part: str) -> random.Random:
        return random.Random(f'{self.seed}:{part}')

    def ms(self, milliseconds: float) -> float:
        return milliseconds / 1000 * self.tempo / 60 * PPQ

    def bar_tick(self, bar: Bar, beat: float = 0) -> float:
        return (bar.number - 1) * BAR + beat * BEAT

    def chord_spans(self, bar: Bar) -> list[tuple[float, float, str]]:
        n = len(bar.chords)
        return [(4 / n * i, 4 / n, c) for i, c in enumerate(bar.chords)]

    def pitched(self, pitch: int) -> int:
        return pitch + self.transpose

    def compose_keys(self) -> None:
        rng = self.rng('keys')
        keys = self.tracks['keys']
        changes: list[int] = []
        for bar in self.form:
            spans = self.chord_spans(bar)
            for start, length, name in spans:
                chord = CHORDS[name]
                voicing = [note(n) for n in chord.keys]
                if bar.section == 'Breakdown':  # no bass here, so the left hand plays the root
                    voicing = [self.root_in_range(chord.root, 45, 56)] + voicing
                hits = self.keys_pattern(bar, length, rng)
                for i, (offset, dur, accent) in enumerate(hits):
                    t0 = self.bar_tick(bar, start + offset)
                    t1 = self.bar_tick(bar, start + offset + dur) - 12
                    roll = self.ms(rng.uniform(5, 15))
                    base = {'A': 72, "A'": 74, 'B': 78, 'Breakdown': 64, "A''": 76, 'Turnaround': 70}[bar.section]
                    for j, p in enumerate(sorted(voicing)):
                        vel = base * accent + rng.uniform(-8, 8) + (3 if j == len(voicing) - 1 else 0)
                        keys.add(t0 + roll * j / (len(voicing) - 1), t1, self.pitched(p), vel)
                    if i == 0:
                        changes.append(round(t0))
        # legato pedalling: lift just after each new chord sounds, press again a moment later
        for t in changes:
            if t > 0:
                keys.controls.append((t + 18, 64, 0))
            keys.controls.append((t + 48, 64, 127))
        keys.controls.append((self.end - 2, 64, 0))  # pedal up before the loop point

    def keys_pattern(self, bar: Bar, length: float, rng: random.Random) -> list[tuple[float, float, float]]:
        if length < 4:
            return [(0, length, 1.0)]
        if bar.section == 'Breakdown':
            return [(0, 4, 1.0)]
        if bar.section == 'Turnaround' and bar.number - self.form[-8].number < 4:
            return [(0, 4, 0.95)]
        choices = {
            'hold': [(0, 4, 1.0)],
            'push': [(0, 1.5, 1.0), (1.5, 2.5, 0.8)],
            'late': [(0, 2.5, 1.0), (2.5, 1.5, 0.74)],
            'pulse': [(0, 1.5, 1.0), (1.5, 1.5, 0.8), (3, 1, 0.72)],
        }
        weights = {
            'A': {'hold': 3, 'push': 2, 'late': 1},
            "A'": {'hold': 2, 'push': 2, 'late': 2},
            'B': {'push': 2, 'late': 1, 'pulse': 3},
            "A''": {'hold': 1, 'push': 3, 'late': 2, 'pulse': 1},
            'Turnaround': {'hold': 3, 'late': 1},
        }[bar.section]
        pick = rng.choices(list(weights), weights=list(weights.values()))[0]
        return choices[pick]

    def root_in_range(self, pc_name: str, low: int, high: int, near: int | None = None) -> int:
        pc = NOTE_INDEX[pc_name[0]] + (1 if '#' in pc_name else -1 if 'b' in pc_name[1:] else 0)
        options = [p for p in range(low, high + 1) if p % 12 == pc % 12]
        target = near if near is not None else (low + high) / 2
        return min(options, key=lambda p: (abs(p - target), p))

    def compose_bass(self) -> list[tuple]:
        # Other colours replay the 'borrowed' random state at every chord, so bars whose
        # harmony is unchanged keep exactly the same bass.
        rng = self.rng('bass')
        replay = None
        if self.colour != 'borrowed':
            reference = Composer(self.tempo, self.key, self.bars, self.lead_program, self.seed, 'borrowed')
            replay = reference.compose_bass()
        states: list[tuple] = []
        bass, sub = self.tracks['bass'], self.tracks['sub']
        flat: list[tuple[Bar, float, float, str]] = []
        for bar in self.form:
            for start, length, name in self.chord_spans(bar):
                flat.append((bar, start, length, name))
        roots: list[int] = []
        prev = note('C2')
        for _, _, _, name in flat:
            prev = self.root_in_range(CHORDS[name].root, note('E1'), note('D#2'), near=prev)
            roots.append(prev)

        for i, (bar, start, length, name) in enumerate(flat):
            if replay is not None:
                rng.setstate(replay[i])
            states.append(rng.getstate())
            if bar.section == 'Breakdown':
                continue
            diatonic = self.colour != 'borrowed' and (bar.section == 'B' or name == 'E9sus4')
            chord_pcs = {roots[i] % 12} | {note(n) % 12 for n in CHORDS[name].keys}
            root = roots[i]
            fifth = root + 7 if root + 7 <= note('E2') else root - 5
            nxt_root = roots[(i + 1) % len(roots)]
            nxt_bar = flat[(i + 1) % len(flat)][0]
            leads_into_rest = nxt_bar.section == 'Breakdown'
            t = lambda beat: self.bar_tick(bar, start + beat) + self.ms(rng.uniform(0, 8))  # noqa: E731
            vel = lambda v: v + rng.uniform(-8, 8)  # noqa: E731

            sub.add(self.bar_tick(bar, start) + 4, self.bar_tick(bar, start + length) - 30,
                    self.pitched(root), vel(92))

            if length < 4:
                pattern = [(0, 1.5, root, 88), (1.5, 0.5, fifth, 64)]
                if start > 0:
                    pattern = [(0, 1.5, root, 84)]
                    approach = self.approach(nxt_root, rng, diatonic, chord_pcs)
                    if approach is not None and not leads_into_rest:
                        pattern.append((1.5, 0.5, approach, 66))
            else:
                thin = bar.section in ('A', 'Turnaround') and rng.random() < 0.5
                if thin:
                    pattern = [(0, 2.75, root, 88), (3, 0.5, fifth, 66)]
                else:
                    options = [
                        [(0, 1.25, root, 90), (1.5, 0.5, root, 62), (2.5, 1, fifth, 74)],
                        [(0, 1.5, root, 90), (2, 1.25, fifth, 72)],
                    ]
                    if root + 12 <= note('A2'):
                        options.append([(0, 1.5, root, 90), (1.5, 0.5, root + 12, 60), (2, 1.25, fifth, 72)])
                    pattern = rng.choice(options)
                approach = self.approach(nxt_root, rng, diatonic, chord_pcs)
                if approach is not None and not leads_into_rest and bar.section != 'A':
                    pattern.append((3.5, 0.5, approach, 68))
                elif not leads_into_rest:
                    pattern.append((3.5, 0.5, root, 58))
            if leads_into_rest and length == 4:
                pattern = [(0, 3.5, root, 84)]
            for beat, dur, pitch, v in pattern:
                end = self.bar_tick(bar, start + beat + dur) - 20
                bass.add(t(beat), end, self.pitched(pitch), vel(v))
        return states

    def approach(self, target: int, rng: random.Random, diatonic: bool = False,
                 chord_pcs: set[int] | None = None) -> int | None:
        pick = rng.choices(['below', 'above', 'fifth', 'none'], weights=[4, 3, 2, 1])[0]
        if pick == 'none':
            return None

        def step(direction: int) -> int:
            if not diatonic:
                return target + direction
            p = target + direction
            while p % 12 not in G_MAJOR:
                p += direction
            return p

        low, high = note('E1'), note('G2')
        pitch = {'below': step(-1), 'above': step(1), 'fifth': target - 5}[pick]
        if diatonic and chord_pcs and pick != 'fifth' and pitch % 12 not in chord_pcs:
            other = step(1 if pick == 'below' else -1)
            if other % 12 in chord_pcs and low <= other <= high:
                pitch = other
        if pitch < low:
            pitch = step(1) if pick == 'below' else pitch + 12
        return pitch if pitch <= high else step(-1)

    def compose_pad(self) -> None:
        pad = self.tracks['pad']
        rng = self.rng('pad')
        bd = [b for b in self.form if b.section == 'Breakdown']
        for bar in bd:
            chord = CHORDS[bar.chords[0]]
            for p in chord.pad:
                pad.add(self.bar_tick(bar), self.bar_tick(bar, 4) - 20, self.pitched(note(p)),
                        58 + rng.uniform(-6, 6))
        pad.controls.append((0, 11, 0))
        start, end = self.bar_tick(bd[0]), self.bar_tick(bd[-1], 4)
        for i in range(9):
            pad.controls.append((round(start + i * BEAT / 8), 11, round(110 * i / 8)))
        for i in range(17):
            pad.controls.append((round(end - 2 * BEAT + i * BEAT / 8) - 30, 11, round(110 * (1 - i / 16))))

    def compose_lead(self) -> None:
        rng = self.rng('lead')
        lead = self.tracks['lead']
        for bar in self.form:
            if not bar.lead:
                continue
            notes = [tuple(x.split(':')) for x in P[bar.lead].split()]
            pitches = [note(p) for _, _, p in notes]
            top = max(pitches)
            for beat, length, name in notes:
                beat, length, pitch = float(beat), float(length), note(name)
                vel = 76
                vel += 6 if beat in (0, 2) else 3 if beat in (1, 3) else 0
                vel += 5 if pitch == top else 0
                vel -= 10 if length <= 0.125 else 0
                vel *= {'Breakdown': 0.88, 'Turnaround': 0.84}.get(bar.section, 1.0)
                vel += rng.uniform(-8, 8)
                start = self.bar_tick(bar, beat) + self.ms(rng.uniform(-4, 4))
                end = self.bar_tick(bar, beat + length) - (4 if length <= 0.125 else 14)
                lead.add(max(0, start), min(end, self.end - 10), self.pitched(pitch), vel)

    def compose_drums(self) -> None:
        rng = self.rng('drums')
        drums = self.tracks['drums']
        hat_accents = [70, 46, 60, 50, 68, 44, 58, 52]
        shaker_accents = [36, 20, 28, 22]
        style = {  # kick scale, backbeat note, backbeat velocity, hat scale, ghost chance
            'A': (0.84, SIDESTICK, 70, 0.78, 0.0),
            "A'": (0.94, SIDESTICK, 76, 0.88, 0.22),
            'B': (1.0, SNARE, 62, 0.94, 0.28),
            "A''": (1.0, SNARE, 64, 0.94, 0.3),
            'Turnaround': (0.86, SIDESTICK, 70, 0.8, 0.0),
        }
        last = self.form[-1].number
        b_last = max(b.number for b in self.form if b.section == 'B')
        bd_last = max(b.number for b in self.form if b.section == 'Breakdown')

        def hit(bar: Bar, sixteenth: float, pitch: int, vel: float, late_ms: float = 0.0) -> None:
            jitter = self.ms(rng.uniform(-8, 8) + late_ms)
            start = self.bar_tick(bar) + sixteenth * SIXTEENTH + jitter
            if bar.number == 1:
                start = max(start, self.bar_tick(bar) + sixteenth * SIXTEENTH)  # nothing before tick 0
            # GM drums are one-shots; a short note keeps humanised neighbours from overlapping
            drums.add(start, min(start + 40, self.end - 5), pitch, vel + rng.uniform(-10, 10))

        for bar in self.form:
            if bar.section == 'Breakdown':
                if bar.number == bd_last:
                    for k, v in zip(range(12, 16), (22, 28, 34, 42)):
                        hit(bar, k, CLOSED_HAT, v)
                continue
            kick_s, backbeat, bb_vel, hat_s, ghost = style[bar.section]
            fill = bar.number == last

            plain = (bar.number % 2 == 1) or bar.section in ('A', 'Turnaround')
            kicks = [(0, 90), (10, 74)] if plain else [(0, 90), (7, 70), (10, 76)]
            if bar.section == "A''" and bar.number % 4 == 0:
                kicks = [(0, 90), (3, 58), (10, 76)]
            for k, v in kicks:
                hit(bar, k, KICK, v * kick_s)

            for k in (4, 12):
                hit(bar, k, backbeat, bb_vel, late_ms=rng.uniform(15, 25))
            if ghost and rng.random() < ghost:
                hit(bar, rng.choice([7, 9, 15]), SNARE, 22)

            open_hat = (bar.section != 'A' and bar.number % 4 == 0) or bar.number == b_last
            for i, v in enumerate(hat_accents):
                k = i * 2
                if fill and k >= 12:
                    continue
                if open_hat and k == 14:
                    hit(bar, k, OPEN_HAT, 54 * hat_s)
                else:
                    hit(bar, k, CLOSED_HAT, v * hat_s)
                if ghost and rng.random() < ghost * 0.6 and not (fill and k >= 10):
                    hit(bar, k + 1, CLOSED_HAT, 26)

            if bar.section == 'B':
                for k in range(16):
                    hit(bar, k, SHAKER, shaker_accents[k % 4])

            if fill:
                for k, v in zip(range(12, 16), (34, 42, 52, 62)):
                    hit(bar, k, SNARE, v)

    def compose(self) -> mido.MidiFile:
        self.compose_keys()
        self.compose_bass()
        self.compose_pad()
        self.compose_lead()
        self.compose_drums()
        return self.to_midi()

    def to_midi(self) -> mido.MidiFile:
        mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
        conductor: list[tuple[int, int, mido.Message | mido.MetaMessage]] = [
            (0, 0, mido.MetaMessage('track_name', name='joelleortiz.me lo-fi loop')),
            (0, 0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.tempo))),
            (0, 0, mido.MetaMessage('time_signature', numerator=4, denominator=4,
                                    clocks_per_click=24, notated_32nd_notes_per_beat=8)),
            (0, 0, mido.MetaMessage('key_signature', key=self.key_signature)),
        ]
        section = None
        for bar in self.form:
            if bar.section != section:
                section = bar.section
                conductor.append((self.bar_tick(bar), 1, mido.MetaMessage('marker', text=section)))
        mid.tracks.append(self.to_track(conductor))

        for key, spec in TRACKS.items():
            ch = spec['channel']
            program = spec['program']
            name = spec['name']
            if key == 'lead':
                program = self.lead_program
                name = f"Lead - {LEAD_NAMES.get(program, f'program {program}')}"
            if key == 'drums':
                program = DRUM_KIT
            events: list[tuple[int, int, mido.Message | mido.MetaMessage]] = [
                (0, 0, mido.MetaMessage('track_name', name=name)),
                (0, 1, mido.Message('program_change', channel=ch, program=program)),
                (0, 2, mido.Message('control_change', channel=ch, control=7, value=spec['volume'])),
                (0, 2, mido.Message('control_change', channel=ch, control=10, value=spec['pan'])),
                (0, 2, mido.Message('control_change', channel=ch, control=91, value=spec['reverb'])),
                (0, 2, mido.Message('control_change', channel=ch, control=11, value=127)),
            ]
            if key == 'keys':
                events.append((0, 2, mido.Message('control_change', channel=ch, control=64, value=0)))
            track = self.tracks[key]
            for tick, cc, value in track.controls:
                events.append((tick, 3, mido.Message('control_change', channel=ch, control=cc, value=value)))
            for start, end, pitch, vel in track.notes:
                events.append((start, 4, mido.Message('note_on', channel=ch, note=pitch, velocity=vel)))
                events.append((end, 0, mido.Message('note_off', channel=ch, note=pitch, velocity=0)))
            mid.tracks.append(self.to_track(events))
        return mid

    def to_track(self, events: list[tuple[int, int, mido.Message | mido.MetaMessage]]) -> mido.MidiTrack:
        track = mido.MidiTrack()
        now = 0
        for tick, _, msg in sorted(events, key=lambda e: (e[0], e[1])):
            if not 0 <= tick <= self.end:
                raise ValueError(f'event outside the loop: {tick} {msg}')
            track.append(msg.copy(time=tick - now))
            now = tick
        track.append(mido.MetaMessage('end_of_track', time=self.end - now))
        return track


def validate(mid: mido.MidiFile, end: int) -> None:
    for track in mid.tracks:
        now, held, pedal = 0, {}, 0
        for msg in track:
            now += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                key = (msg.channel, msg.note)
                if held.get(key):
                    raise ValueError(f'overlapping note {key} at {now} in {track.name}')
                held[key] = True
            elif msg.type in ('note_off', 'note_on'):
                held[(msg.channel, msg.note)] = False
            elif msg.type == 'control_change' and msg.control == 64:
                pedal = msg.value
        if now != end:
            raise ValueError(f'{track.name} ends at {now}, expected {end}')
        if any(held.values()) or pedal >= 64:
            raise ValueError(f'{track.name} still has notes or pedal down at the loop point')


def main() -> None:
    ap = argparse.ArgumentParser(description='Compose the lo-fi loop as a Type 1 MIDI file.')
    ap.add_argument('--lead', type=int, default=LEAD_PROGRAM, help='GM program for the lead (0-based)')
    ap.add_argument('--seed', type=int, default=SEED)
    ap.add_argument('--key', default=KEY)
    ap.add_argument('--tempo', type=float, default=TEMPO_BPM)
    ap.add_argument('--bars', type=int, default=BARS)
    ap.add_argument('--colour', default=COLOUR, choices=list(COLOURS))
    ap.add_argument('--out', type=Path, default=OUT)
    args = ap.parse_args()

    composer = Composer(args.tempo, args.key, args.bars, args.lead, args.seed, args.colour)
    mid = composer.compose()
    validate(mid, composer.end)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    mid.save(args.out)
    seconds = args.bars * 4 * 60 / args.tempo
    notes = sum(1 for t in mid.tracks for m in t if m.type == 'note_on')
    print(f'{args.out}: {args.bars} bars, {args.tempo:g} BPM, key {args.key}, lead program {args.lead}, '
          f'seed {args.seed}, colour {args.colour}, {notes} notes, {seconds:.3f} s')


if __name__ == '__main__':
    main()
