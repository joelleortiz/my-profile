<script lang="ts">
	import bg from '#lib/assets/sayagata-400px.png';
	import Typed from '#lib/components/Typed.svelte';

	const roles = ['Programmer', 'Traveler', 'Foodie', 'Dreamer', 'Audiophile'];
</script>

<svelte:head>
	<title>Joelle Ortiz</title>
	<meta
		name="description"
		content="Joelle Ortiz — programmer, traveler, foodie, dreamer, audiophile."
	/>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col justify-center gap-12 bg-white bg-repeat p-6 text-gray-900 sm:p-12"
	style="background-image: url('{bg}')"
>
	<header class="container mx-auto max-w-screen-md">
		<h1 class="text-5xl sm:text-6xl">Hi, I'm Joelle.</h1>
		<p class="mt-10 ml-2 h-20 text-2xl">
			<Typed words={roles} />
		</p>
	</header>

	<section class="sm:absolute sm:right-0 sm:bottom-0 sm:p-12">
		<ul class="space-y-1 border-y border-dashed border-gray-900/50 p-4">
			<li class="flex items-center gap-2">
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
					/>
				</svg>
				<a href="mailto:contact@joelleortiz.me">contact@joelleortiz.me</a>
			</li>
			<li class="flex items-center gap-2">
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
					/>
				</svg>
				<a href="https://joelleortiz.me">joelleortiz.me</a>
			</li>
		</ul>
	</section>
</div>
