<script lang="ts">
	import { cv } from '#lib/cv.ts';
	import Typed from './Typed.svelte';

	const roles = ['Programmer', 'Traveler', 'Foodie', 'Dreamer', 'Audiophile'];
	const bio = cv.summary.trim();
</script>

<header class="intro">
	<h1 id="intro-heading">Hi, I'm Joelle.</h1>
	<p class="roles"><Typed words={roles} /></p>
</header>

{#if bio}
	<p class="bio">{bio}</p>
{/if}

<style>
	.intro {
		display: grid;
		gap: 0.6rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-pixel);
		font-weight: 600;
		font-size: clamp(2.25rem, 1.75rem + 1.6vw, 3rem);
		line-height: 1;
		text-wrap: balance;
	}

	.roles {
		margin: 0;
		min-height: 1.3em;
		font-family: var(--font-pixel);
		font-size: 1.5rem;
		line-height: 1.3;
		color: var(--accent);
	}

	.bio {
		margin: 0;
		font-size: 1.0625rem;
		line-height: 1.6;
		text-wrap: pretty;
	}
</style>
