import { pickRandom } from './assets.ts';
import { type Stroke, Typist, renderPool } from './typing.ts';

export class Keyboard {
	private readonly context: BaseAudioContext;
	private readonly typist = new Typist();
	private readonly pools = new Map<Stroke, AudioBuffer[]>();

	constructor(context: BaseAudioContext) {
		this.context = context;
	}

	next(): AudioBuffer | undefined {
		return pickRandom(this.pool(this.typist.next()));
	}

	private pool(stroke: Stroke): AudioBuffer[] {
		let pool = this.pools.get(stroke);
		if (!pool) {
			pool = renderPool(stroke, this.context.sampleRate).map((s) => this.buffer(s));
			this.pools.set(stroke, pool);
		}
		return pool;
	}

	private buffer(samples: Float32Array<ArrayBuffer>): AudioBuffer {
		const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
		buffer.copyToChannel(samples, 0);
		return buffer;
	}
}
