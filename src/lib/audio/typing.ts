import { dbToGain } from './levels.ts';

export type Stroke = 'key' | 'space' | 'enter';

interface Peak {
	hz: number;
	q: number;
	gainDb: number;
}

interface Voicing {
	highpassHz: number;
	lowpassHz: number;
	peaks: readonly Peak[];
	snapMs: number;
	tail: number;
	tailMs: number;
	thump: number;
}

interface Shape {
	pitch: number;
	tail: number;
	thump: number;
	seconds: number;
	releaseMs: Range;
	stabiliserMs?: Range;
}

interface Impact {
	at: number;
	level: number;
	snapMs: number;
	tail: number;
	tailMs: number;
}

interface Biquad {
	b: readonly [number, number, number];
	a: readonly [number, number];
}

type Range = readonly [number, number];

export const ONSET_JITTER_MS = 15;

const CRISP: Voicing = {
	highpassHz: 110,
	lowpassHz: 9500,
	peaks: [
		{ hz: 2450, q: 2.8, gainDb: 15 },
		{ hz: 1400, q: 4, gainDb: 7 },
		{ hz: 6400, q: 0.5, gainDb: -3 }
	],
	snapMs: 0.5,
	tail: 0.15,
	tailMs: 4,
	thump: 0.1
};

const SHAPES: Record<Stroke, Shape> = {
	key: { pitch: 1, tail: 1, thump: 1, seconds: 0.15, releaseMs: [55, 100] },
	space: {
		pitch: 0.72,
		tail: 2,
		thump: 2.4,
		seconds: 0.24,
		releaseMs: [85, 130],
		stabiliserMs: [3, 7]
	},
	enter: {
		pitch: 0.85,
		tail: 1.6,
		thump: 1.8,
		seconds: 0.21,
		releaseMs: [75, 115],
		stabiliserMs: [2, 5]
	}
};

export const POOL_SIZES: Record<Stroke, number> = { key: 16, space: 5, enter: 3 };

const WORD_KEYS: Range = [2, 8];
const SENTENCE_WORDS: Range = [6, 12];

const ATTACK_MS = 0.6;
const PEAK_PITCH_SPREAD = 0.07;
const PEAK_GAIN_SPREAD_DB = 2;
const PEAK_Q_SPREAD = 0.15;
const LOWPASS_SPREAD = 0.1;
const SNAP_SPREAD = 0.25;
const TAIL_SPREAD = 0.3;
const SECOND_HIT_CHANCE = 0.3;
const SECOND_HIT_MS: Range = [4, 35];
const SECOND_HIT_LEVEL: Range = [0.2, 0.6];
const ROOM = 0.03;
const ROOM_MS = 12;
const STABILISER_LEVEL: Range = [0.35, 0.6];
const RELEASE_LEVEL: Range = [0.25, 0.5];
const THUMP_HZ = 140;
const THUMP_MS = 8;
const STROKE_LEVEL_SPREAD_DB = 1.5;
const OUTPUT_PEAK = 0.5;
const FADE_OUT_MS = 6;
const SILENT = 1e-3;

export class Typist {
	private readonly random: () => number;
	private keysLeft: number;
	private wordsLeft: number;

	constructor(random: () => number = Math.random) {
		this.random = random;
		this.keysLeft = between(random, WORD_KEYS);
		this.wordsLeft = between(random, SENTENCE_WORDS);
	}

	next(): Stroke {
		if (this.keysLeft > 0) {
			this.keysLeft -= 1;
			return 'key';
		}
		this.keysLeft = between(this.random, WORD_KEYS);
		this.wordsLeft -= 1;
		if (this.wordsLeft > 0) return 'space';
		this.wordsLeft = between(this.random, SENTENCE_WORDS);
		return 'enter';
	}
}

export function renderPool(stroke: Stroke, sampleRate: number): Float32Array<ArrayBuffer>[] {
	const base = seedOf(stroke);
	return Array.from({ length: POOL_SIZES[stroke] }, (_, i) =>
		renderStroke(stroke, sampleRate, base + i)
	);
}

function renderStroke(stroke: Stroke, sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
	const random = mulberry32(seed);
	const voicing = CRISP;
	const shape = SHAPES[stroke];
	const out = new Float32Array(Math.round(shape.seconds * sampleRate));
	for (const impact of impacts(voicing, shape, random)) addBurst(out, sampleRate, impact, random);
	colour(out, sampleRate, voicing, shape, random);
	const thump = voicing.thump * shape.thump * spread(random, TAIL_SPREAD);
	addThump(out, sampleRate, THUMP_HZ * shape.pitch * spread(random, PEAK_PITCH_SPREAD), thump);
	const level = OUTPUT_PEAK * dbToGain((random() * 2 - 1) * STROKE_LEVEL_SPREAD_DB);
	return fadeOut(normalise(out, level), sampleRate);
}

function impacts(voicing: Voicing, shape: Shape, random: () => number): Impact[] {
	const down: Impact = {
		at: 0,
		level: 1,
		snapMs: voicing.snapMs * spread(random, SNAP_SPREAD),
		tail: voicing.tail * shape.tail * spread(random, TAIL_SPREAD),
		tailMs: voicing.tailMs * shape.tail * spread(random, TAIL_SPREAD)
	};
	const hits = [down];
	if (shape.stabiliserMs) {
		hits.push({
			...down,
			at: within(random, shape.stabiliserMs),
			level: within(random, STABILISER_LEVEL)
		});
	} else if (random() < SECOND_HIT_CHANCE) {
		hits.push({
			...down,
			at: within(random, SECOND_HIT_MS),
			level: within(random, SECOND_HIT_LEVEL),
			tail: 0
		});
	}
	hits.push({ ...down, at: within(random, shape.releaseMs), level: within(random, RELEASE_LEVEL) });
	return hits;
}

function addBurst(
	out: Float32Array,
	sampleRate: number,
	impact: Impact,
	random: () => number
): void {
	const start = Math.round((impact.at / 1000) * sampleRate);
	const attack = Math.max(1, Math.round((ATTACK_MS / 1000) * sampleRate));
	const snapFall = Math.exp(-1000 / (impact.snapMs * sampleRate));
	const tailFall = Math.exp(-1000 / (impact.tailMs * sampleRate));
	const roomFall = Math.exp(-1000 / (ROOM_MS * sampleRate));
	let [snap, tail, room] = [impact.level, impact.level * impact.tail, impact.level * ROOM];
	for (let i = 0; start + i < out.length && snap + tail + room > SILENT; i++) {
		out[start + i] += (snap + tail + room) * rise(i, attack) * (random() * 2 - 1);
		snap *= snapFall;
		tail *= tailFall;
		room *= roomFall;
	}
}

function colour(
	out: Float32Array,
	sampleRate: number,
	voicing: Voicing,
	shape: Shape,
	random: () => number
): void {
	filter(out, highpass(voicing.highpassHz * shape.pitch, sampleRate));
	for (const peak of voicing.peaks) {
		const hz = peak.hz * shape.pitch * spread(random, PEAK_PITCH_SPREAD);
		const q = peak.q * spread(random, PEAK_Q_SPREAD);
		const gainDb = peak.gainDb + (random() * 2 - 1) * PEAK_GAIN_SPREAD_DB;
		filter(out, peaking(hz, q, gainDb, sampleRate));
	}
	filter(out, lowpass(voicing.lowpassHz * spread(random, LOWPASS_SPREAD), sampleRate));
}

function addThump(out: Float32Array, sampleRate: number, hz: number, level: number): void {
	const fall = Math.exp(-1000 / (THUMP_MS * sampleRate));
	const attack = Math.round((ATTACK_MS / 1000) * sampleRate * 4);
	const peak = out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
	let envelope = level * peak;
	for (let i = 0; i < out.length && envelope > SILENT * peak; i++) {
		out[i] += envelope * rise(i, attack) * Math.sin((2 * Math.PI * hz * i) / sampleRate);
		envelope *= fall;
	}
}

function rise(i: number, samples: number): number {
	return i >= samples ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * i) / samples);
}

function peaking(hz: number, q: number, gainDb: number, sampleRate: number): Biquad {
	const a = 10 ** (gainDb / 40);
	const w0 = (2 * Math.PI * hz) / sampleRate;
	const alpha = Math.sin(w0) / (2 * q);
	const cos = Math.cos(w0);
	const a0 = 1 + alpha / a;
	return {
		b: [(1 + alpha * a) / a0, (-2 * cos) / a0, (1 - alpha * a) / a0],
		a: [(-2 * cos) / a0, (1 - alpha / a) / a0]
	};
}

function lowpass(hz: number, sampleRate: number): Biquad {
	const w0 = (2 * Math.PI * hz) / sampleRate;
	const alpha = Math.sin(w0) / Math.SQRT2;
	const cos = Math.cos(w0);
	const a0 = 1 + alpha;
	return {
		b: [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0],
		a: [(-2 * cos) / a0, (1 - alpha) / a0]
	};
}

function highpass(hz: number, sampleRate: number): Biquad {
	const w0 = (2 * Math.PI * hz) / sampleRate;
	const alpha = Math.sin(w0) / Math.SQRT2;
	const cos = Math.cos(w0);
	const a0 = 1 + alpha;
	return {
		b: [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0],
		a: [(-2 * cos) / a0, (1 - alpha) / a0]
	};
}

function filter(x: Float32Array, { b: [b0, b1, b2], a: [a1, a2] }: Biquad): void {
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	for (let i = 0; i < x.length; i++) {
		const input = x[i];
		const output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1;
		x1 = input;
		y2 = y1;
		y1 = output;
		x[i] = output;
	}
}

function normalise(x: Float32Array<ArrayBuffer>, peak: number): Float32Array<ArrayBuffer> {
	const max = x.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
	for (let i = 0; i < x.length; i++) x[i] *= peak / max;
	return x;
}

function fadeOut(x: Float32Array<ArrayBuffer>, sampleRate: number): Float32Array<ArrayBuffer> {
	const fade = Math.round((FADE_OUT_MS / 1000) * sampleRate);
	for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
	return x;
}

function seedOf(stroke: Stroke): number {
	return [...`crisp:${stroke}`].reduce(
		(h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
		2166136261
	);
}

function between(random: () => number, [low, high]: Range): number {
	return low + Math.floor(random() * (high - low + 1));
}

function within(random: () => number, [low, high]: Range): number {
	return low + random() * (high - low);
}

function spread(random: () => number, amount: number): number {
	return 1 + (random() * 2 - 1) * amount;
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
