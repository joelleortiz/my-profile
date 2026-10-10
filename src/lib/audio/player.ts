import {
	type Format,
	type LoadState,
	type SfxId,
	SoundBank,
	loadLoop,
	preferredFormat
} from './assets';
import { createCrackle } from './crackle';
import type { SceneSound, SceneTime } from './index';
import { Keyboard } from './keyboard.ts';
import {
	GAIN_SPREAD_DB,
	type LevelName,
	type Levels,
	PITCH_SPREAD,
	type SoundGroup,
	dbToGain
} from './levels';
import { PurrLoop } from './purr';
import { type BlipDirection, playBlip } from './synth';
import { ONSET_JITTER_MS } from './typing.ts';

const LOOP_END_SECONDS = 128;
const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 0.5;
const LOWPASS_HZ: Record<SceneTime, number> = {
	morning: 20000,
	day: 20000,
	dusk: 10000,
	night: 6000
};

type OneShotEvent = Exclude<SceneSound, 'type' | 'pet-start' | 'pet-end' | 'palette-change'>;

const ONE_SHOTS: Record<OneShotEvent, readonly [SfxId, SoundGroup]> = {
	'margot-wake': ['sleepy-chirp', 'cats'],
	'margot-stretch': ['stretch-yawn', 'cats'],
	sip: ['sip', 'foley'],
	'cup-down': ['cup-down', 'foley'],
	'sticker-hover': ['sticker', 'stickerHover'],
	'sticker-click': ['sticker', 'stickerClick']
};

export interface PlayerStatus {
	context: AudioContextState;
	format: Format;
	music: LoadState;
	crackle: LoadState;
	sfx: Record<SfxId, LoadState>;
	purring: boolean;
	lowpassHz: number;
	busDb: { music: number; crackle: number; sfx: number };
	levelDb: { rms: number; peak: number };
}

export class Player {
	private readonly context = new AudioContext({ latencyHint: 'interactive' });
	private readonly format = preferredFormat();
	private readonly master = new GainNode(this.context);
	private readonly analyser = new AnalyserNode(this.context, { fftSize: 2048 });
	private readonly bed = new GainNode(this.context, { gain: 0 });
	private readonly musicLowpass = new BiquadFilterNode(this.context, {
		type: 'lowpass',
		frequency: 20000
	});
	private readonly musicLevel = new GainNode(this.context);
	private readonly crackleLevel = new GainNode(this.context);
	private readonly sfx = new GainNode(this.context);
	private readonly bank = new SoundBank();
	private readonly keyboard = new Keyboard(this.context);
	private readonly purr = new PurrLoop(this.context, this.sfx);
	readonly unlocked = whenRunning(this.context);
	private on = false;
	private loading?: Promise<void>;
	private musicState: LoadState = 'idle';
	private crackleState: LoadState = 'idle';
	private readonly levels: Levels;

	constructor(levels: Levels) {
		this.levels = levels;
		this.applyLevels();
		this.musicLowpass.connect(this.musicLevel).connect(this.bed);
		this.crackleLevel.connect(this.bed);
		this.bed.connect(this.master);
		this.sfx.connect(this.master);
		this.master.connect(this.analyser).connect(this.context.destination);
		document.addEventListener('visibilitychange', () => this.followVisibility());
	}

	async start(time: SceneTime): Promise<void> {
		this.on = true;
		const resumed = this.context.resume();
		this.setTimeOfDay(time, 0);
		this.blip('on');
		this.fadeBed(1, FADE_IN_SECONDS, this.context.currentTime);
		this.loading ??= this.loadAll();
		await Promise.all([resumed, this.loading]);
	}

	/** Retries a start that the browser held back until a gesture it accepts. */
	unlock(): Promise<void> {
		return this.context.resume();
	}

	async stop(): Promise<void> {
		this.on = false;
		const blipEnd = this.blip('off');
		this.purr.stop();
		const fadeEnd = this.fadeBed(0, FADE_OUT_SECONDS, blipEnd);
		await secondsPass(fadeEnd - this.context.currentTime + 0.05);
		if (!this.on) await this.context.suspend();
	}

	play(sound: SceneSound): void {
		if (document.hidden) return;
		switch (sound) {
			case 'type':
				return this.playBuffer(this.keyboard.next(), 'typing', spreadOnset());
			case 'pet-start':
				this.playSfx('pet-trill', 'cats');
				return this.purr.start(this.bank.pick('purr'), this.gain('purr'));
			case 'pet-end':
				return this.purr.stop();
			case 'palette-change':
				this.blip('on');
				return;
			default:
				return this.playSfx(...ONE_SHOTS[sound]);
		}
	}

	applyLevels(): void {
		this.musicLevel.gain.value = this.gain('music');
		this.crackleLevel.gain.value = this.gain('crackle');
		this.sfx.gain.value = this.gain('sfxBus');
		this.purr.setGain(this.gain('purr'));
	}

	setTimeOfDay(time: SceneTime, seconds: number): void {
		const frequency = this.musicLowpass.frequency;
		const now = this.context.currentTime;
		frequency.cancelScheduledValues(now);
		frequency.setValueAtTime(frequency.value, now);
		frequency.exponentialRampToValueAtTime(LOWPASS_HZ[time], now + Math.max(seconds, 0.01));
	}

	status(): PlayerStatus {
		return {
			context: this.context.state,
			format: this.format,
			music: this.musicState,
			crackle: this.crackleState,
			sfx: Object.fromEntries(this.bank.states) as Record<SfxId, LoadState>,
			purring: this.purr.playing,
			lowpassHz: this.musicLowpass.frequency.value,
			busDb: {
				music: gainToDb(this.musicLevel.gain.value),
				crackle: gainToDb(this.crackleLevel.gain.value),
				sfx: gainToDb(this.sfx.gain.value)
			},
			levelDb: this.level()
		};
	}

	private async loadAll(): Promise<void> {
		await Promise.all([
			this.loadMusic(),
			this.loadCrackle(),
			this.bank.load(this.context, this.format)
		]);
	}

	private async loadMusic(): Promise<void> {
		this.musicState = 'loading';
		try {
			const buffer = await loadLoop(this.context, this.format);
			const source = new AudioBufferSourceNode(this.context, {
				buffer,
				loop: true,
				loopEnd: LOOP_END_SECONDS
			});
			source.connect(this.musicLowpass);
			source.start();
			this.musicState = 'ready';
		} catch (error) {
			this.musicState = 'failed';
			console.warn('audio: could not load the music loop', error);
		}
	}

	private async loadCrackle(): Promise<void> {
		this.crackleState = 'loading';
		try {
			(await createCrackle(this.context)).connect(this.crackleLevel);
			this.crackleState = 'ready';
		} catch (error) {
			this.crackleState = 'failed';
			console.warn('audio: no live crackle', error);
		}
	}

	private followVisibility(): void {
		if (document.hidden) this.purr.stop(0);
		else if (this.on) void this.context.resume();
	}

	private playSfx(id: SfxId, group: SoundGroup): void {
		this.playBuffer(this.bank.pick(id), group);
	}

	private playBuffer(buffer: AudioBuffer | undefined, group: SoundGroup, delaySeconds = 0): void {
		if (!buffer) return;
		const source = new AudioBufferSourceNode(this.context, {
			buffer,
			playbackRate: 1 + spread(PITCH_SPREAD)
		});
		const level = new GainNode(this.context, {
			gain: dbToGain(this.levels[group] + spread(GAIN_SPREAD_DB))
		});
		source.connect(level).connect(this.sfx);
		source.start(this.context.currentTime + delaySeconds);
	}

	private blip(direction: BlipDirection): number {
		return playBlip(this.context, this.sfx, direction, this.gain('blips'));
	}

	private gain(name: LevelName): number {
		return dbToGain(this.levels[name]);
	}

	private fadeBed(value: number, seconds: number, from: number): number {
		const gain = this.bed.gain;
		gain.cancelScheduledValues(this.context.currentTime);
		gain.setValueAtTime(gain.value, this.context.currentTime);
		gain.setValueAtTime(gain.value, from);
		gain.linearRampToValueAtTime(value, from + seconds);
		return from + seconds;
	}

	private level(): { rms: number; peak: number } {
		const samples = new Float32Array(this.analyser.fftSize);
		this.analyser.getFloatTimeDomainData(samples);
		const peak = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
		const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
		return { rms: gainToDb(rms), peak: gainToDb(peak) };
	}
}

function spread(amount: number): number {
	return (Math.random() * 2 - 1) * amount;
}

function spreadOnset(): number {
	return (Math.random() * ONSET_JITTER_MS) / 1000;
}

function gainToDb(gain: number): number {
	return 20 * Math.log10(Math.max(gain, 1e-6));
}

function whenRunning(context: AudioContext): Promise<void> {
	return new Promise((resolve) => {
		const check = () => {
			if (context.state !== 'running') return;
			context.removeEventListener('statechange', check);
			resolve();
		};
		context.addEventListener('statechange', check);
		check();
	});
}

function secondsPass(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, Math.max(seconds, 0) * 1000));
}
