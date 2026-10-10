<script lang="ts">
	import { intro } from '#lib/content.ts';
	import { placeVars, SCENE } from '#lib/scene/layout.ts';

	// The painted board and its picture light are pixel art; this is the lettering on it.
	const style = placeVars('sign', SCENE.insets.signText);
</script>

<section class="sign in-room" aria-labelledby="intro-heading" {style}>
	<h1 id="intro-heading">{intro.heading}</h1>
	<p>{intro.bio}</p>
</section>

<style>
	.sign {
		box-sizing: border-box;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: calc(var(--tu) * 4);
		margin: 0;
		text-align: center;
		color: var(--paper-ink);
	}

	h1 {
		margin: 0;
		font-family: var(--font-pixel);
		font-weight: 600;
		font-size: calc(var(--tu) * 14);
		line-height: 1;
		letter-spacing: 0.02em;
	}

	p {
		margin: 0;
		max-width: calc(var(--tu) * 158);
		font-size: calc(var(--tu) * 7.5);
		line-height: 1.3;
		text-wrap: balance;
	}
</style>
