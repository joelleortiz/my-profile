const BLIP_NOTES = { on: [880, 1318.51], off: [1318.51, 880] } as const;
const BLIP_NOTE_SECONDS = 0.06;
const BLIP_LEVEL = 0.1;

export type BlipDirection = keyof typeof BLIP_NOTES;

export function playBlip(
	context: BaseAudioContext,
	destination: AudioNode,
	direction: BlipDirection,
	gain: number,
	when = context.currentTime
): number {
	const [first, second] = BLIP_NOTES[direction];
	const end = when + 2 * BLIP_NOTE_SECONDS;
	const level = BLIP_LEVEL * gain;
	const oscillator = new OscillatorNode(context, { type: 'square', frequency: first });
	const envelope = new GainNode(context, { gain: 0 });
	oscillator.frequency.setValueAtTime(second, when + BLIP_NOTE_SECONDS);
	envelope.gain.setValueAtTime(0, when);
	envelope.gain.linearRampToValueAtTime(level, when + 0.003);
	envelope.gain.setValueAtTime(level, end - 0.01);
	envelope.gain.linearRampToValueAtTime(0, end);
	oscillator.connect(envelope).connect(destination);
	oscillator.start(when);
	oscillator.stop(end + 0.01);
	return end;
}
