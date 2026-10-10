import type { SceneEngine } from './engine.ts';

export type Target = 'myles' | 'margot' | 'coffee';

export interface DirectorOptions {
	reducedMotion: boolean;
	sound: (event: string) => void;
}

type Action = () => Promise<void>;

const FULL_CUP = 5;
const REFILL_MS = 60_000;
const REDUCED_POSE_MS = 2200;
const REDUCED_BLINK_MS = 150;
const REDUCED_SLOW_BLINK_MS = 700;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (p: number) => Math.random() < p;

class Actor {
	private current: Promise<void> | null = null;
	private readonly queue: { key: string; action: Action }[] = [];

	get busy(): boolean {
		return this.current !== null;
	}

	request(key: string, action: Action): void {
		if (!this.busy) this.start(action);
		else if (!this.queue.some((q) => q.key === key)) this.queue.push({ key, action });
	}

	runIfFree(action: Action): void {
		if (!this.busy) this.start(action);
	}

	private start(action: Action): void {
		this.current = action()
			.catch(() => {})
			.finally(() => {
				this.current = null;
				const next = this.queue.shift();
				if (next) this.start(next.action);
			});
	}
}

export class Director {
	private readonly engine: SceneEngine;
	private readonly sound: (event: string) => void;
	private readonly me = new Actor();
	private readonly myles = new Actor();
	private readonly margot = new Actor();
	private reduced: boolean;
	private alive = true;
	private mylesHeld = false;
	private coffeeLevel = FULL_CUP;
	private heartsToken = 0;
	/** While a sip carries the cup, the cup's level changes when it is put down, not before. */
	private sipping = false;

	constructor(engine: SceneEngine, options: DirectorOptions) {
		this.engine = engine;
		this.sound = options.sound;
		this.reduced = options.reducedMotion;
		this.settle();
		this.every([3000, 6000], () => this.me.runIfFree(() => this.blink()), { reduced: true });
		this.every([10_000, 20_000], () => this.me.runIfFree(() => this.pet()));
		this.every([15_000, 30_000], () => {
			if (this.coffeeLevel > 0) this.me.runIfFree(() => this.sip());
		});
		this.every([35_000, 70_000], () =>
			this.me.runIfFree(() => (chance(0.5) ? this.stretch() : this.glance()))
		);
		this.every(
			[4000, 9000],
			() => {
				if (!this.mylesHeld) this.myles.runIfFree(() => this.mylesIdle());
			},
			{ reduced: true }
		);
		this.every([6000, 14_000], () => this.margot.runIfFree(() => this.margotDream()));
	}

	click(target: Target): void {
		if (target === 'myles') this.me.request('pet', () => this.pet());
		else if (target === 'coffee') this.me.request('sip', () => this.sip());
		else this.margot.request('wake', () => this.wakeMargot());
	}

	handleEvent(event: string): void {
		this.sound(event);
		if (event === 'cup-down') this.drinkOneStep();
		// Myles leans into Joelle's hand the moment it lands, in step with the purr.
		if (event === 'pet-start') this.engine.play('myles', 'pet', { loop: true });
	}

	setReducedMotion(reduced: boolean): void {
		this.reduced = reduced;
		this.settle();
	}

	destroy(): void {
		this.alive = false;
	}

	private settle(): void {
		const show = (sprite: string, tag: string) =>
			this.reduced ? this.engine.pose(sprite, tag) : this.engine.play(sprite, tag, { loop: true });
		show('me', 'type');
		show('me-face', 'none');
		show('myles', 'idle');
		show('margot', 'sleep');
		show('zzz', 'float');
		this.showCoffee();
		this.engine.setFlag('asleep', true);
		this.engine.setFlag('hearts', false);
	}

	/** Runs an action at random intervals; only blinks also run with reduced motion. */
	private async every(
		[min, max]: [number, number],
		action: () => void,
		{ reduced = false } = {}
	): Promise<void> {
		while (this.alive) {
			await this.engine.wait(between(min, max));
			if (this.alive && (reduced || !this.reduced)) action();
		}
	}

	private async pet(): Promise<void> {
		if (this.reduced) {
			// Still frames: Joelle's hand on him, his eyes closed, and the hearts, while the purr plays.
			this.mylesHeld = true;
			this.engine.setFlag('hearts', true);
			this.engine.pose('hearts', 'float', 3);
			await this.holdPose(['me', 'pet-stroke'], ['myles', 'pet'], 'pet-start', 'pet-end');
			this.mylesHeld = false;
			return;
		}
		// No new idle starts, and the one playing gives way when the hand lands.
		this.mylesHeld = true;
		await this.engine.play('me', 'pet-reach');
		const strokes = chance(0.5) ? 3 : 2;
		for (let i = 0; i < strokes; i++) {
			this.floatHearts();
			await this.engine.play('me', 'pet-stroke');
		}
		await this.engine.play('me', 'pet-return');
		this.engine.play('myles', 'idle', { loop: true });
		this.mylesHeld = false;
		this.engine.play('me', 'type', { loop: true });
	}

	/** The cup's `sip<level>` tag carries it in step with Joelle's `sip` tag. */
	private async sip(): Promise<void> {
		const cup = `sip${this.coffeeLevel}`;
		if (this.reduced) {
			await this.holdPose(['me', 'sip', 3], ['coffee', cup, 3], 'sip', 'cup-down');
			return this.drinkOneStep();
		}
		this.sipping = true;
		this.engine.play('coffee', cup);
		await this.engine.play('me', 'sip');
		this.sipping = false;
		this.showCoffee();
		this.engine.play('me', 'type', { loop: true });
	}

	private async blink(): Promise<void> {
		if (this.reduced) {
			// Still frames, so a blink stays even with reduced motion.
			this.engine.pose('me-face', 'blink', 1);
			await this.engine.wait(REDUCED_BLINK_MS);
			return this.engine.pose('me-face', 'none');
		}
		await this.engine.play('me-face', 'blink');
		this.engine.play('me-face', 'none', { loop: true });
	}

	private async stretch(): Promise<void> {
		await this.engine.play('me', 'stretch');
		this.engine.play('me', 'type', { loop: true });
	}

	private async glance(): Promise<void> {
		await this.engine.play('me', 'glance');
		this.engine.play('me', 'type', { loop: true });
	}

	/**
	 * A swish, a slow blink or an ear turned out, and now and then a look toward the side the
	 * pointer is on (never on touch screens, where there is no pointer). With reduced motion,
	 * only a slow blink, as a still frame.
	 */
	private async mylesIdle(): Promise<void> {
		if (this.reduced) {
			this.engine.pose('myles', 'blink', 1);
			await this.engine.wait(REDUCED_SLOW_BLINK_MS);
			if (!this.mylesHeld) this.engine.pose('myles', 'idle');
			return;
		}
		const pointer = this.engine.pointerX();
		const myles = this.engine.hitArea('myles');
		const look =
			pointer !== null && myles && chance(0.35)
				? pointer < myles.x + myles.w / 2
					? 'look-left'
					: 'look-right'
				: null;
		const tag = look ?? (chance(0.4) ? 'swish' : chance(0.55) ? 'blink' : 'ear');
		await this.engine.play('myles', tag);
		if (!this.mylesHeld) this.engine.play('myles', 'idle', { loop: true });
	}

	private async margotDream(): Promise<void> {
		await this.engine.play('margot', chance(0.5) ? 'ear' : 'paw');
		this.engine.play('margot', 'sleep', { loop: true });
	}

	private async wakeMargot(): Promise<void> {
		if (this.reduced) {
			this.engine.setFlag('asleep', false);
			await this.holdPose(['margot', 'wake', 1], null, 'margot-wake', null);
			return this.engine.setFlag('asleep', true);
		}
		await this.engine.play('margot', 'ear-react');
		const reaction = chance(0.15) ? 'stretch' : chance(0.45) ? 'wake' : null;
		if (reaction) {
			this.engine.setFlag('asleep', false);
			await this.engine.play('margot', reaction);
			this.engine.setFlag('asleep', true);
		}
		this.engine.play('margot', 'sleep', { loop: true });
	}

	private async holdPose(
		main: [string, string, number?],
		partner: [string, string, number?] | null,
		startSound: string,
		endSound: string | null
	): Promise<void> {
		this.engine.pose(main[0], main[1], main[2] ?? 0);
		if (partner) this.engine.pose(partner[0], partner[1], partner[2] ?? 0);
		this.sound(startSound);
		await this.engine.wait(REDUCED_POSE_MS);
		if (endSound) this.sound(endSound);
		this.settle();
	}

	private floatHearts(): void {
		const token = ++this.heartsToken;
		this.engine.setFlag('hearts', true);
		this.engine.play('hearts', 'float').then(() => {
			if (token === this.heartsToken) this.engine.setFlag('hearts', false);
		});
	}

	private drinkOneStep(): void {
		if (this.coffeeLevel === 0) return;
		this.coffeeLevel--;
		if (!this.sipping) this.showCoffee();
		if (this.coffeeLevel === 0) this.refillLater();
	}

	private async refillLater(): Promise<void> {
		await this.engine.wait(REFILL_MS);
		this.coffeeLevel = FULL_CUP;
		this.showCoffee();
	}

	private showCoffee(): void {
		const tag = `level${this.coffeeLevel}`;
		if (this.reduced) this.engine.pose('coffee', tag);
		else this.engine.play('coffee', tag, { loop: true });
	}
}
