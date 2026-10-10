<script lang="ts">
	import { placeVars, SCENE } from '#lib/scene/layout.ts';
	import PixelIcon, { type IconName } from './PixelIcon.svelte';

	// The cork, the paper notes and their pins are pixel art; these are the links written on them.
	const style = placeVars('cork');

	const LINKS: { icon: IconName; href: string; label: string; rot: number }[] = [
		{
			icon: 'mail',
			href: 'mailto:contact@joelleortiz.me',
			label: 'contact@joelleortiz.me',
			rot: -0.8
		},
		{ icon: 'globe', href: 'https://joelleortiz.me', label: 'joelleortiz.me', rot: 1 },
		{ icon: 'code', href: 'https://github.com/joelleortiz', label: 'GitHub', rot: -1.1 },
		{
			icon: 'briefcase',
			href: 'https://www.linkedin.com/in/joelle-ortiz',
			label: 'LinkedIn',
			rot: 0.7
		}
	];

	const notes = LINKS.map((link, i) => {
		const n = SCENE.insets.notes[i];
		return {
			...link,
			style: `--nx:${n.x};--ny:${n.y};--nw:${n.w};--nh:${n.h};rotate:${link.rot}deg`
		};
	});
</script>

<nav class="corkboard in-room" aria-label="Contact" {style}>
	<ul>
		{#each notes as note (note.href)}
			<li class="note" style={note.style}>
				<!-- Profile links and mail, not app routes, so resolve() does not apply. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={note.href}>
					<PixelIcon name={note.icon} />
					<span>{note.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	:global(:root[data-layout]) .note {
		position: absolute;
		left: calc(var(--nx) * var(--sp));
		top: calc(var(--ny) * var(--sp));
		width: calc(var(--nw) * var(--sp));
		height: calc(var(--nh) * var(--sp));
	}

	a {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: calc(var(--tu) * 2.5);
		height: 100%;
		padding: 0 calc(var(--tu) * 3);
		color: var(--paper-ink);
		font-size: calc(var(--tu) * 7);
		line-height: 1;
		white-space: nowrap;
		text-decoration-line: underline;
		text-decoration-thickness: max(1px, calc(var(--tu) * 0.5));
		text-underline-offset: calc(var(--tu) * 1.4);
		text-decoration-color: color-mix(in srgb, var(--paper-ink) 45%, transparent);
	}

	a :global(svg) {
		flex: none;
		width: calc(var(--tu) * 5.5);
		height: auto;
		color: color-mix(in srgb, var(--paper-ink) 80%, var(--accent));
	}

	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
