<script lang="ts">
	interface Props {
		words: string[];
		typeSpeed?: number;
		pause?: number;
	}

	let { words, typeSpeed = 90, pause = 1600 }: Props = $props();

	let text = $state('');

	function shuffle<T>(items: T[]): T[] {
		const copy = [...items];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	$effect(() => {
		let order = shuffle(words);
		let index = 0;
		let typed = '';
		let deleting = false;
		let timer: ReturnType<typeof setTimeout>;

		function tick() {
			const word = order[index];

			if (!deleting) {
				typed = word.slice(0, typed.length + 1);
				if (typed === word) deleting = true;
			} else {
				typed = word.slice(0, typed.length - 1);
				if (typed === '') {
					deleting = false;
					index = (index + 1) % order.length;
					if (index === 0) order = shuffle(words);
				}
			}

			text = typed;
			const delay = typed === word && deleting ? pause : deleting ? typeSpeed / 2 : typeSpeed;
			timer = setTimeout(tick, delay);
		}

		tick();
		return () => clearTimeout(timer);
	});
</script>

<span class="sr-only">{words.join(', ')}</span>
<span aria-hidden="true">{text}<span class="cursor">|</span></span>

<style>
	.cursor {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
