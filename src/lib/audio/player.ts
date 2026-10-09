import {
	type Format,
	type LoadState,
	type SfxId,
	SoundBank,
	loadLoop,
	pickRandom,
	preferredFormat
} from './assets';
import { createCrackle } from './crackle';
import type { SceneSound, SceneTime } from './index';
import { PurrLoop } from './purr';
import { type BlipDirection, keyTapBuffers, playBlip } from './synth';

const MUSIC_GAIN = 0.35;
const CRACKLE_GAIN = MUSIC_GAIN;
const SFX_GAIN = 0.6;
const LOOP_END_SECONDS = 128;
const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 0.5;
const LOWPASS_HZ: Record<SceneTime, number> = {
	morning: 20000,
	day: 20000,
	dusk: 10000,
	night: 6000
};
const KEY_TAP_GAIN_DB = -22;
const PITCH_SPREAD = 0.03;
const GAIN_SPREAD_DB = 2;

type OneShotEvent = Exclude<SceneSound, 'type' | 'pet-start' | 'pet-end' | 'palette-change'>;

const ONE_SHOTS: Record<OneShotEvent, readonly [SfxId, number]> = {
	'margot-wake': ['sleepy-chirp', 0],
	'margot-stretch': ['stretch-yawn', 0],
	sip: ['sip', -2],
	'cup-down': ['cup-down', 0],
	'sticker-hover': ['sticker', -14],
	'sticker-click': ['sticker', 0],
	'palette-open': ['meow-soft', -4]
};

export interface PlayerStatus {
	context: AudioContextState;
	format: Format;
	music: LoadState;
	crackle: LoadState;
	sfx: Record<SfxId, LoadState>;
	purring: boolean;
	lowpassHz: number;
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
	private readonly musicLevel = new GainNode(this.context, { gain: MUSIC_GAIN });
	private readonly crackleLevel = new GainNode(this.context, { gain: CRACKLE_GAIN });
	private readonly sfx = new GainNode(this.context, { gain: SFX_GAIN });
	private readonly bank = new SoundBank();
	private readonly keyTaps = keyTapBuffers(this.context);
	private readonly purr = new PurrLoop(this.context, this.sfx);
	private on = false;
	private loading?: Promise<void>;
	private musicState: LoadState = 'idle';
	private crackleState: LoadState = 'idle';

	constructor() {
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
		await resumed;
		await (this.loading ??= this.loadAll());
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
				return this.playBuffer(pickRandom(this.keyTaps), KEY_TAP_GAIN_DB);
			case 'pet-start':
				this.playSfx('pet-trill', 0);
				return this.purr.start(this.bank.pick('purr'));
			case 'pet-end':
				return this.purr.stop();
			case 'palette-change':
				this.blip('on');
				return;
			default:
				return this.playSfx(...ONE_SHOTS[sound]);
		}
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
		if (document.hidden) {
			this.purr.stop(0);
			void this.context.suspend();
		} else if (this.on) {
			void this.context.resume();
		}
	}

	private playSfx(id: SfxId, gainDb: number): void {
		this.playBuffer(this.bank.pick(id), gainDb);
	}

	private playBuffer(buffer: AudioBuffer | undefined, gainDb: number): void {
		if (!buffer) return;
		const source = new AudioBufferSourceNode(this.context, {
			buffer,
			playbackRate: 1 + spread(PITCH_SPREAD)
		});
		const level = new GainNode(this.context, { gain: dbToGain(gainDb + spread(GAIN_SPREAD_DB)) });
		source.connect(level).connect(this.sfx);
		source.start();
	}

	private blip(direction: BlipDirection): number {
		return playBlip(this.context, this.sfx, direction);
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

function dbToGain(db: number): number {
	return 10 ** (db / 20);
}

function gainToDb(gain: number): number {
	return 20 * Math.log10(Math.max(gain, 1e-6));
}

function secondsPass(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, Math.max(seconds, 0) * 1000));
}
