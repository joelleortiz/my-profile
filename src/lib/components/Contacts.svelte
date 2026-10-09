<script lang="ts">
	import PixelIcon from './PixelIcon.svelte';
</script>

<ul class="contacts" aria-label="Contact">
	<li>
		<span class="icon"><PixelIcon name="mail" /></span>
		<a href="mailto:contact@joelleortiz.me">contact@joelleortiz.me</a>
	</li>
	<li>
		<span class="icon"><PixelIcon name="globe" /></span>
		<a href="https://joelleortiz.me">joelleortiz.me</a>
	</li>
	<li>
		<span class="icon"><PixelIcon name="code" /></span>
		<a href="https://github.com/joelleortiz">GitHub</a>
	</li>
	<li>
		<span class="icon"><PixelIcon name="briefcase" /></span>
		<a href="https://www.linkedin.com/in/joelle-ortiz">LinkedIn</a>
	</li>
</ul>

<style>
	.contacts {
		display: grid;
		gap: 0.6rem 1.5rem;
		margin: 0;
		padding: 0.9rem 0.25rem;
		list-style: none;
		border-block: 2px dashed color-mix(in srgb, var(--ink) 45%, transparent);
	}

	@container (min-width: 440px) {
		.contacts {
			grid-template-columns: auto 1fr;
		}
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.icon {
		display: inline-flex;
		justify-content: center;
		width: 22px;
		flex: none;
		color: var(--accent);
	}

	a {
		color: var(--ink);
		font-size: 1.0625rem;
		overflow-wrap: anywhere;
		text-decoration-line: underline;
		text-decoration-color: color-mix(in srgb, var(--accent) 70%, transparent);
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
	}

	a:hover {
		text-decoration-color: var(--accent);
		text-decoration-thickness: 3px;
	}
</style>
