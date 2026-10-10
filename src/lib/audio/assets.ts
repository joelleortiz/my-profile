import { asset } from '$app/paths';
import { sfxFiles } from './sfx-manifest';

export type SfxId = keyof typeof sfxFiles;
export type LoadState = 'idle' | 'loading' | 'ready' | 'failed';
export type Format = 'ogg' | 'm4a';

const LOOP = 'audio/lofi-loop';
type AudioFile = typeof LOOP | (typeof sfxFiles)[SfxId][number];

export function preferredFormat(): Format {
	return document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a';
}

let loopBytes: Promise<ArrayBuffer> | undefined;

/** Downloads the loop without decoding it, since decoding needs an AudioContext and so a gesture. */
export function preloadLoop(): void {
	loopBytes ??= download(LOOP, preferredFormat(), 'low');
	loopBytes.catch(() => {
		loopBytes = undefined;
	});
}

export function loadLoop(context: BaseAudioContext, format: Format): Promise<AudioBuffer> {
	loopBytes ??= download(LOOP, format);
	return loadAudio(context, LOOP, format, loopBytes);
}

export class SoundBank {
	readonly states = new Map<SfxId, LoadState>(sfxIds().map((id) => [id, 'idle']));
	private readonly buffers = new Map<SfxId, AudioBuffer[]>();

	async load(context: BaseAudioContext, format: Format): Promise<void> {
		await Promise.all(sfxIds().map((id) => this.loadSound(context, id, format)));
	}

	pick(id: SfxId): AudioBuffer | undefined {
		return pickRandom(this.buffers.get(id) ?? []);
	}

	private async loadSound(context: BaseAudioContext, id: SfxId, format: Format): Promise<void> {
		this.states.set(id, 'loading');
		try {
			const buffers = await Promise.all(
				sfxFiles[id].map((file) => loadAudio(context, file, format))
			);
			this.buffers.set(id, buffers);
			this.states.set(id, 'ready');
		} catch (error) {
			this.states.set(id, 'failed');
			console.warn(`audio: could not load ${id}`, error);
		}
	}
}

export function pickRandom<T>(items: readonly T[]): T | undefined {
	return items[Math.floor(Math.random() * items.length)];
}

function sfxIds(): SfxId[] {
	return Object.keys(sfxFiles) as SfxId[];
}

async function loadAudio(
	context: BaseAudioContext,
	file: AudioFile,
	format: Format,
	bytes = download(file, format)
): Promise<AudioBuffer> {
	try {
		return await context.decodeAudioData(await bytes);
	} catch {
		return context.decodeAudioData(await download(file, format === 'ogg' ? 'm4a' : 'ogg'));
	}
}

async function download(
	file: AudioFile,
	format: Format,
	priority: RequestPriority = 'auto'
): Promise<ArrayBuffer> {
	const response = await fetch(asset(`${file}.${format}`), { priority });
	if (!response.ok) throw new Error(`${response.status} ${file}.${format}`);
	return response.arrayBuffer();
}
