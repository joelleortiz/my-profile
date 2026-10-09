// Same model and constants as scripts/music/crackle.py, which bakes crackle into the previews.
const CRACKLE = {
	ticksPerSecond: 3.0,
	tickDb: [-55.0, -29.0],
	tickDecayMs: [0.06, 0.3],
	tickHighpassHz: 700.0,
	popsPerSecond: 0.16,
	popDb: [-45.0, -28.0],
	popHz: [180.0, 520.0],
	popDecayMs: [0.8, 2.4],
	hissDb: -47.0,
	hissHz: 3200.0,
	hissQ: 0.6,
	rumbleDb: -34.0,
	rumbleHz: 30.0,
	rpm: 100 / 3,
	rumbleSwell: 0.35,
	width: 0.35
} as const;

declare const sampleRate: number;
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;
declare abstract class AudioWorkletProcessor {
	abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

type Range = readonly [number, number];
type Filter = (x: number) => number;

interface CrackleEvent {
	age: number;
	life: number;
	tau: number;
	level: number;
	pan: readonly [number, number];
}

interface Pop extends CrackleEvent {
	omega: number;
}

const uniform = ([low, high]: Range): number => low + Math.random() * (high - low);
const quietSkewedLevel = ([low, high]: Range): number =>
	10 ** ((low + (high - low) * Math.random() ** 2) / 20);
const whiteNoise = (rmsDb: number): number =>
	(Math.random() * 2 - 1) * Math.sqrt(3) * 10 ** (rmsDb / 20);

function equalPowerPan(width: number): readonly [number, number] {
	const angle = ((Math.random() * 2 - 1) * width + 1) * (Math.PI / 4);
	return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}

function bandpass(frequency: number, q: number): Filter {
	const w0 = (2 * Math.PI * frequency) / sampleRate;
	const alpha = Math.sin(w0) / (2 * q);
	const a0 = 1 + alpha;
	const b0 = alpha / a0;
	const a1 = (-2 * Math.cos(w0)) / a0;
	const a2 = (1 - alpha) / a0;
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	return (x) => {
		const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
		return y;
	};
}

function onePoleLowpass(frequency: number): Filter {
	const a = Math.exp((-2 * Math.PI * frequency) / sampleRate);
	let y = 0;
	return (x) => (y = (1 - a) * x + a * y);
}

function onePoleHighpass(frequency: number): Filter {
	const a = Math.exp((-2 * Math.PI * frequency) / sampleRate);
	let x1 = 0;
	let y = 0;
	return (x) => {
		y = ((1 + a) / 2) * (x - x1) + a * y;
		x1 = x;
		return y;
	};
}

function newTick(): CrackleEvent {
	const tau = (uniform(CRACKLE.tickDecayMs) / 1000) * sampleRate;
	return {
		age: 0,
		life: 6 * tau + 2,
		tau,
		level: quietSkewedLevel(CRACKLE.tickDb),
		pan: equalPowerPan(CRACKLE.width)
	};
}

function newPop(): Pop {
	const tau = (uniform(CRACKLE.popDecayMs) / 1000) * sampleRate;
	const sign = Math.random() < 0.5 ? -1 : 1;
	return {
		age: 0,
		life: 6 * tau + 2,
		tau,
		omega: (2 * Math.PI * uniform(CRACKLE.popHz)) / sampleRate,
		level: sign * quietSkewedLevel(CRACKLE.popDb),
		pan: equalPowerPan(CRACKLE.width * 0.6)
	};
}

class VinylCrackle extends AudioWorkletProcessor {
	private readonly hiss = [
		bandpass(CRACKLE.hissHz, CRACKLE.hissQ),
		bandpass(CRACKLE.hissHz, CRACKLE.hissQ)
	];
	private readonly rumble = [onePoleLowpass(CRACKLE.rumbleHz), onePoleLowpass(CRACKLE.rumbleHz)];
	private readonly tickHighpass = [
		onePoleHighpass(CRACKLE.tickHighpassHz),
		onePoleHighpass(CRACKLE.tickHighpassHz)
	];
	private readonly turnStep = (2 * Math.PI * CRACKLE.rpm) / 60 / sampleRate;
	private turn = Math.random() * 2 * Math.PI;
	private ticks: CrackleEvent[] = [];
	private pops: Pop[] = [];
	private eventsLeft = 0;
	private eventsRight = 0;

	process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
		const [left, right] = outputs[0];
		for (let i = 0; i < left.length; i++) {
			const rumble = this.nextRumble();
			this.advanceEvents();
			left[i] = this.hiss[0](whiteNoise(CRACKLE.hissDb)) + rumble + this.eventsLeft;
			right[i] = this.hiss[1](whiteNoise(CRACKLE.hissDb)) + rumble + this.eventsRight;
		}
		this.ticks = this.ticks.filter((e) => e.age < e.life);
		this.pops = this.pops.filter((e) => e.age < e.life);
		return true;
	}

	private nextRumble(): number {
		this.turn += this.turnStep;
		const swell = 1 + CRACKLE.rumbleSwell * Math.sin(this.turn);
		return this.rumble[1](this.rumble[0](whiteNoise(CRACKLE.rumbleDb))) * swell;
	}

	private advanceEvents(): void {
		if (Math.random() < CRACKLE.ticksPerSecond / sampleRate) this.ticks.push(newTick());
		if (Math.random() < CRACKLE.popsPerSecond / sampleRate) this.pops.push(newPop());
		let tickLeft = 0;
		let tickRight = 0;
		let popLeft = 0;
		let popRight = 0;
		for (const tick of this.ticks) {
			if (tick.age >= tick.life) continue;
			const s = (Math.random() * 2 - 1) * Math.exp(-tick.age / tick.tau) * tick.level;
			tickLeft += s * tick.pan[0];
			tickRight += s * tick.pan[1];
			tick.age++;
		}
		for (const pop of this.pops) {
			if (pop.age >= pop.life) continue;
			const s = Math.sin(pop.omega * pop.age) * Math.exp(-pop.age / pop.tau) * pop.level;
			popLeft += s * pop.pan[0];
			popRight += s * pop.pan[1];
			pop.age++;
		}
		this.eventsLeft = this.tickHighpass[0](tickLeft) + popLeft;
		this.eventsRight = this.tickHighpass[1](tickRight) + popRight;
	}
}

registerProcessor('vinyl-crackle', VinylCrackle);

export {};
