const KEY_TAP_SECONDS = 0.12;
const KEY_TAP_VARIATIONS = 8;
const KEY_TAP_PEAK = 0.7;

const BLIP_NOTES = { on: [880, 1318.51], off: [1318.51, 880] } as const;
const BLIP_NOTE_SECONDS = 0.06;
const BLIP_LEVEL = 0.1;

export type BlipDirection = keyof typeof BLIP_NOTES;

export function keyTapBuffers(context: BaseAudioContext): AudioBuffer[] {
	return Array.from({ length: KEY_TAP_VARIATIONS }, (_, i) => {
		const samples = renderKeyTap(context.sampleRate, i + 1);
		const buffer = context.createBuffer(1, samples.length, context.sampleRate);
		buffer.copyToChannel(samples, 0);
		return buffer;
	});
}

export function renderKeyTap(sampleRate: number, seed: number): Float32Array<ArrayBuffer> {
	const random = mulberry32(seed);
	const out = new Float32Array(Math.round(KEY_TAP_SECONDS * sampleRate));
	const rustle = bandpass(sampleRate, 2200 + random() * 1600, 1.2);
	const rustleDecay = (0.006 + random() * 0.006) * sampleRate;
	const tickDecay = 0.0004 * sampleRate;
	const bodyHz = 180 + random() * 80;
	const bodyDecay = 0.006 * sampleRate;
	for (let i = 0; i < out.length; i++) {
		const noise = random() * 2 - 1;
		const tick = noise * Math.exp(-i / tickDecay);
		const body = Math.sin((2 * Math.PI * bodyHz * i) / sampleRate) * Math.exp(-i / bodyDecay);
		out[i] = rustle(noise * Math.exp(-i / rustleDecay)) + 0.4 * tick + 0.35 * body;
	}
	return withPeak(fadeEdges(out, sampleRate), KEY_TAP_PEAK);
}

export function playBlip(
	context: BaseAudioContext,
	destination: AudioNode,
	direction: BlipDirection,
	when = context.currentTime
): number {
	const [first, second] = BLIP_NOTES[direction];
	const end = when + 2 * BLIP_NOTE_SECONDS;
	const oscillator = new OscillatorNode(context, { type: 'square', frequency: first });
	const envelope = new GainNode(context, { gain: 0 });
	oscillator.frequency.setValueAtTime(second, when + BLIP_NOTE_SECONDS);
	envelope.gain.setValueAtTime(0, when);
	envelope.gain.linearRampToValueAtTime(BLIP_LEVEL, when + 0.003);
	envelope.gain.setValueAtTime(BLIP_LEVEL, end - 0.01);
	envelope.gain.linearRampToValueAtTime(0, end);
	oscillator.connect(envelope).connect(destination);
	oscillator.start(when);
	oscillator.stop(end + 0.01);
	return end;
}

function bandpass(sampleRate: number, frequency: number, q: number): (x: number) => number {
	const w0 = (2 * Math.PI * frequency) / sampleRate;
	const alpha = Math.sin(w0) / (2 * q);
	const a0 = 1 + alpha;
	const [b0, b2] = [alpha / a0, -alpha / a0];
	const [a1, a2] = [(-2 * Math.cos(w0)) / a0, (1 - alpha) / a0];
	let [x1, x2, y1, y2] = [0, 0, 0, 0];
	return (x) => {
		const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
		[x2, x1, y2, y1] = [x1, x, y1, y];
		return y;
	};
}

function fadeEdges(
	samples: Float32Array<ArrayBuffer>,
	sampleRate: number
): Float32Array<ArrayBuffer> {
	const fadeIn = Math.round(0.001 * sampleRate);
	const fadeOut = Math.round(0.005 * sampleRate);
	for (let i = 0; i < fadeIn; i++) samples[i] *= i / fadeIn;
	for (let i = 0; i < fadeOut; i++) samples[samples.length - 1 - i] *= i / fadeOut;
	return samples;
}

function withPeak(samples: Float32Array<ArrayBuffer>, peak: number): Float32Array<ArrayBuffer> {
	const max = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
	return samples.map((s) => (s / max) * peak);
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
