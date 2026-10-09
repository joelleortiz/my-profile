const ATTACK_SECONDS = 0.4;
const RELEASE_SECONDS = 0.8;

interface Voice {
	source: AudioBufferSourceNode;
	level: GainNode;
}

export class PurrLoop {
	private readonly context: BaseAudioContext;
	private readonly destination: AudioNode;
	private voice?: Voice;

	constructor(context: BaseAudioContext, destination: AudioNode) {
		this.context = context;
		this.destination = destination;
	}

	get playing(): boolean {
		return this.voice !== undefined;
	}

	start(buffer: AudioBuffer | undefined): void {
		if (this.voice || !buffer) return;
		const source = new AudioBufferSourceNode(this.context, { buffer, loop: true });
		const level = new GainNode(this.context, { gain: 0 });
		source.connect(level).connect(this.destination);
		source.start();
		this.ramp(level, 1, ATTACK_SECONDS);
		this.voice = { source, level };
	}

	stop(releaseSeconds = RELEASE_SECONDS): void {
		if (!this.voice) return;
		const { source, level } = this.voice;
		source.stop(this.ramp(level, 0, releaseSeconds));
		this.voice = undefined;
	}

	private ramp(level: GainNode, value: number, seconds: number): number {
		const now = this.context.currentTime;
		level.gain.cancelScheduledValues(now);
		level.gain.setValueAtTime(level.gain.value, now);
		level.gain.linearRampToValueAtTime(value, now + seconds);
		return now + seconds;
	}
}
