import workletUrl from './crackle-worklet.ts?worker&url';

export async function createCrackle(context: AudioContext): Promise<AudioWorkletNode> {
	await context.audioWorklet.addModule(workletUrl);
	return new AudioWorkletNode(context, 'vinyl-crackle', {
		numberOfInputs: 0,
		outputChannelCount: [2]
	});
}
