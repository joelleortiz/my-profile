import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	DEFAULT_LEVELS,
	GAIN_SPREAD_DB,
	PITCH_SPREAD,
	dbToGain
} from '../../src/lib/audio/levels.ts';
import {
	ONSET_JITTER_MS,
	POOL_SIZES,
	type Stroke,
	Typist,
	renderPool
} from '../../src/lib/audio/typing.ts';

const SAMPLE_RATE = 48000;
const SECONDS = 10;
const LEAD_IN_SECONDS = 0.3;
const SHEET = 'src/lib/scene/art/me.json';
const TAG = 'type';

interface Sheet {
	frames: { duration: number }[] | Record<string, { duration: number }>;
	meta: { frameTags: { name: string; from: number; to: number; data?: string }[] };
}

type Pools = Record<Stroke, Float32Array[]>;

interface Note {
	stroke: Stroke;
	pick: number;
	rate: number;
	gain: number;
	onset: number;
}

const out = process.argv[2];
mkdirSync(out, { recursive: true });

const site = DEFAULT_LEVELS.sfxBus + DEFAULT_LEVELS.typing;
const performance = perform(eventTimes());
const pools = renderPools();
const keys = pools.key.map((samples) => samples.map((x) => x * dbToGain(site)));
writeSamples('typing.f32', typingTrack(pools));
writeSamples('keys.f32', concat(keys));

console.log(
	JSON.stringify({
		seconds: SECONDS,
		musicGain: dbToGain(DEFAULT_LEVELS.music),
		crackleGain: dbToGain(DEFAULT_LEVELS.crackle),
		typingDb: site,
		strokes: count(performance.map((n) => n.stroke)),
		keyLengths: keys.map((k) => k.length)
	})
);

function perform(times: number[]): Note[] {
	const random = seeded(7);
	const strokes = strokesWithAnEnter(times.length);
	return times.map((time, i) => ({
		stroke: strokes[i],
		pick: Math.floor(random() * POOL_SIZES[strokes[i]]),
		rate: 1 + (random() * 2 - 1) * PITCH_SPREAD,
		gain: dbToGain(site + (random() * 2 - 1) * GAIN_SPREAD_DB),
		onset: time + (random() * ONSET_JITTER_MS) / 1000
	}));
}

function renderPools(): Pools {
	return {
		key: renderPool('key', SAMPLE_RATE),
		space: renderPool('space', SAMPLE_RATE),
		enter: renderPool('enter', SAMPLE_RATE)
	};
}

function typingTrack(pools: Pools): Float32Array {
	const track = new Float32Array(SECONDS * SAMPLE_RATE);
	for (const note of performance) {
		const samples = pools[note.stroke][note.pick];
		mix(track, resample(samples, note.rate), Math.round(note.onset * SAMPLE_RATE), note.gain);
	}
	return track;
}

function writeSamples(name: string, samples: Float32Array): void {
	writeFileSync(
		join(out, name),
		Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
	);
}

function eventTimes(): number[] {
	const sheet: Sheet = JSON.parse(readFileSync(SHEET, 'utf8'));
	const frames = Array.isArray(sheet.frames) ? sheet.frames : Object.values(sheet.frames);
	const tag = sheet.meta.frameTags.find((t) => t.name === TAG);
	if (!tag) throw new Error(`no ${TAG} tag in ${SHEET}`);
	const starts: number[] = [];
	let at = 0;
	for (let f = tag.from; f <= tag.to; f++) {
		starts.push(at);
		at += frames[f].duration / 1000;
	}
	const offsets = (tag.data ?? '')
		.split(/\s+/)
		.filter((pair) => pair.endsWith(`:${TAG}`))
		.map((pair) => starts[Number(pair.split(':')[0])]);
	const times: number[] = [];
	for (let loop = LEAD_IN_SECONDS; loop < SECONDS - 0.5; loop += at) {
		for (const offset of offsets) if (loop + offset < SECONDS - 0.5) times.push(loop + offset);
	}
	return times;
}

function strokesWithAnEnter(n: number): Stroke[] {
	for (let seed = 1; ; seed++) {
		const typist = new Typist(seeded(seed));
		const strokes = Array.from({ length: n }, () => typist.next());
		const enter = strokes.indexOf('enter');
		if (enter > n * 0.4 && enter < n * 0.8) return strokes;
	}
}

function resample(samples: Float32Array, rate: number): Float32Array {
	const outLength = Math.floor((samples.length - 1) / rate);
	const result = new Float32Array(outLength);
	for (let i = 0; i < outLength; i++) {
		const position = i * rate;
		const index = Math.floor(position);
		const fraction = position - index;
		result[i] = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
	}
	return result;
}

function mix(track: Float32Array, samples: Float32Array, at: number, gain: number): void {
	for (let i = 0; i < samples.length && at + i < track.length; i++)
		track[at + i] += samples[i] * gain;
}

function concat(parts: Float32Array[]): Float32Array {
	const result = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		result.set(part, at);
		at += part.length;
	}
	return result;
}

function count(strokes: Stroke[]): Record<Stroke, number> {
	return {
		key: strokes.filter((s) => s === 'key').length,
		space: strokes.filter((s) => s === 'space').length,
		enter: strokes.filter((s) => s === 'enter').length
	};
}

function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
