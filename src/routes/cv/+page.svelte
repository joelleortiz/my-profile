<script lang="ts">
	import { resolve } from '$app/paths';
	import PixelIcon, { type IconName } from '#lib/components/PixelIcon.svelte';
	import { cv, cvHasContent, type CvDate, type CvItem } from '#lib/cv.ts';

	const { basics } = cv;
	const hasContent = cvHasContent();

	// 'en', not 'en-AU', which shortens September to "Sept".
	const monthYear = new Intl.DateTimeFormat('en', {
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});

	/** "2021-12" as "Dec 2021", "present" as "Present". */
	const month = (date: CvDate) =>
		date === 'present' ? 'Present' : monthYear.format(new Date(date));

	/** "https://www.linkedin.com/in/joelle-ortiz/" as "linkedin.com/in/joelle-ortiz", or "". */
	function bare(url: string): string {
		const parsed = URL.parse(url);
		if (!parsed) return '';
		return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.replace(/\/$/, '');
	}

	const contact = (
		[
			{ icon: 'pin', text: basics.location },
			{ icon: 'mail', text: basics.email, href: `mailto:${basics.email}` },
			{ icon: 'globe', text: bare(basics.website), href: basics.website },
			{ icon: 'briefcase', text: bare(basics.linkedin), href: basics.linkedin },
			{ icon: 'code', text: bare(basics.github), href: basics.github }
		] satisfies { icon: IconName; text: string; href?: string }[]
	).filter(({ text }) => text);

	/** A bullet that opens with a short label ("Tech Enablement: …") shows the label in bold. */
	function labelled(bullet: string): { label?: string; text: string } {
		const m = /^([^:.,]{1,30}): (.+)$/s.exec(bullet);
		return m ? { label: m[1], text: m[2] } : { text: bullet };
	}

	/**
	 * An item's bullets run on after its title as one paragraph; with more than two, only the
	 * first does and the rest nest under it.
	 */
	function runIn(item: CvItem): { lead: string; nested: string[] } {
		const { bullets } = item;
		return bullets.length > 2
			? { lead: bullets[0], nested: bullets.slice(1) }
			: { lead: bullets.join(' '), nested: [] };
	}
</script>

<svelte:head>
	<!-- Reachable from the site but kept out of search results, as is the PDF (see _headers). -->
	<meta name="robots" content="noindex" />
	{#if hasContent}
		<title>{basics.name} — CV</title>
		<meta name="description" content="The CV of {basics.name}, {basics.title}." />
	{:else}
		<title>CV</title>
	{/if}
</svelte:head>

{#snippet swatches()}
	<div class="swatches" aria-hidden="true">
		<span></span><span></span><span></span><span></span>
	</div>
{/snippet}

{#snippet bullets(list: string[])}
	<ul class="bullets">
		{#each list.map(labelled) as { label, text } (text)}
			<li>
				{#if label}<b>{label}:</b>{/if}
				{text}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="cv-page">
	<div class="bar">
		<nav aria-label="Site">
			<a class="back" href={resolve('/')}>
				<PixelIcon name="back" />
				<span>Back to the room</span>
			</a>
		</nav>
		{#if __CV_PDF__ && hasContent}
			<!-- A static file, not an app route, so resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="download" href="/cv/joelle-ortiz-cv.pdf" download>
				<PixelIcon name="download" />
				<span>Download PDF</span>
			</a>
		{/if}
	</div>

	{#if !hasContent}
		<main class="cv">
			<header class="masthead">
				{@render swatches()}
				<h1>CV</h1>
				<p class="lead">My CV is getting a refresh. Check back soon!</p>
			</header>
		</main>
	{:else}
		<main class="cv">
			<header class="masthead">
				{@render swatches()}
				<h1>{basics.name}</h1>
				<p class="title">{basics.title}</p>
				{#if cv.summary}
					<p class="lead">
						{#each cv.summary.split('\n') as line, i (i)}
							{#if i}<br />{/if}{line}
						{/each}
					</p>
				{/if}
			</header>

			<div class="columns">
				<div class="main">
					{#if cv.experience.length}
						<section aria-labelledby="cv-experience">
							<h2 id="cv-experience">Experience</h2>
							{#each cv.experience as job (job.company)}
								<div class="job">
									<h3>{job.company}</h3>
									<div class="roles">
										{#each job.roles as role (role.title)}
											<p class="role">
												<strong>{role.title}</strong>
												<span class="dates">{month(role.start)} – {month(role.end)}</span>
											</p>
										{/each}
									</div>
									{#if job.sections}
										{#each job.sections as section (section.heading)}
											<h4>{section.heading}</h4>
											{#if section.items}
												<ul class="bullets">
													{#each section.items as item (item.title)}
														{@const { lead, nested } = runIn(item)}
														<li>
															<b>{item.title} ({item.period}):</b>
															{lead}
															{#if nested.length}
																<ul class="bullets">
																	{#each nested as bullet (bullet)}
																		<li>{bullet}</li>
																	{/each}
																</ul>
															{/if}
														</li>
													{/each}
												</ul>
											{:else}
												{@render bullets(section.bullets)}
											{/if}
										{/each}
									{:else}
										{@render bullets(job.bullets)}
									{/if}
								</div>
							{/each}
						</section>
					{/if}
				</div>

				<div class="side">
					{#if contact.length}
						<section aria-labelledby="cv-contact">
							<h2 id="cv-contact">Contact</h2>
							<ul class="contact">
								{#each contact as { icon, text, href } (text)}
									<li>
										<span class="icon"><PixelIcon name={icon} /></span>
										{#if href}
											<!-- Mail and profile links, not app routes, so resolve() does not apply. -->
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a {href}>{text}</a>
										{:else}
											{text}
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					{#if cv.skills.length}
						<section aria-labelledby="cv-skills">
							<h2 id="cv-skills">Skills</h2>
							<dl>
								{#each cv.skills as { category, items } (category)}
									<div class="entry">
										<dt>{category}</dt>
										<dd>{items.join(', ')}</dd>
									</div>
								{/each}
							</dl>
						</section>
					{/if}

					{#if cv.earlierCareer.length}
						<section aria-labelledby="cv-earlier">
							<h2 id="cv-earlier">Earlier career</h2>
							<ul>
								{#each cv.earlierCareer as job (job.company)}
									<li class="entry">
										<b>{job.title}</b>
										{job.company}
										<span class="dates">{job.period}</span>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					{#if cv.education.length}
						<section aria-labelledby="cv-education">
							<h2 id="cv-education">Education</h2>
							<ul>
								{#each cv.education as school (school.institution)}
									<li class="entry">
										<b>{school.degree}</b>
										{school.institution}
										<span class="dates">{school.year}</span>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			</div>
		</main>
	{/if}
</div>

<style>
	/* On <html>, so the page colour fills the window past the content too. */
	:global(html:has(.cv-page)) {
		background: light-dark(var(--surface), var(--bg));
	}

	.cv-page {
		/*
		 * Every colour on the page, from the visitor's palette and mode: the ui tokens for text
		 * and grounds, the room's swatch chips for the swatches, squares and bullets. In light
		 * mode the page is the palette's surface with a tinted panel (bg) and an ink band; in dark
		 * mode the panel (surface) and band (line) are lifted off the page (bg).
		 */
		--cv-text: var(--ink);
		--cv-heading: var(--ink);
		--cv-muted: var(--soft);
		--cv-sub: var(--accent);
		--cv-panel: light-dark(var(--bg), var(--surface));
		--cv-band: light-dark(var(--ink), var(--line));
		--cv-band-text: light-dark(var(--surface), var(--ink));
		--cv-title: var(--swatch-4);
		--cv-swatch-1: var(--swatch-1);
		--cv-swatch-2: var(--swatch-2);
		--cv-swatch-3: var(--swatch-3);
		--cv-swatch-4: var(--swatch-4);
		/* The chips are pale on a light page, so the small squares are a shade darker there. */
		--cv-mark: light-dark(oklch(from var(--swatch-3) calc(l - 0.15) c h), var(--swatch-3));
		--cv-bullet: light-dark(oklch(from var(--swatch-4) calc(l - 0.15) c h), var(--swatch-4));
		--cv-bullet-2: light-dark(oklch(from var(--swatch-2) calc(l - 0.15) c h), var(--swatch-2));

		padding: 0 var(--gutter) 3rem;
		color: var(--cv-text);
		line-height: 1.5;
	}

	.bar,
	.cv {
		max-width: 64rem;
		margin: 0 auto;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		padding: 1rem 0;
	}

	.back,
	.download {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		font-family: var(--font-pixel);
		font-size: 1.0625rem;
		line-height: 1.2;
	}

	.back {
		color: var(--cv-heading);
	}

	/* Dressed like the header band, with a pixel ledge in the squares' colour. */
	.download {
		padding: 0.375rem 0.875rem;
		color: var(--cv-band-text);
		background: var(--cv-band);
		border-radius: 4px;
		box-shadow: 0 3px 0 var(--cv-mark);
	}

	:is(.back, .download):hover span {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.masthead {
		position: relative;
		padding: 1.875rem 2.25rem 1.75rem;
		color: var(--cv-band-text);
		background: var(--cv-band);
		border-radius: 6px;
	}

	h1 {
		font-family: var(--font-pixel);
		font-weight: 600;
		font-size: 2.75rem;
		line-height: 1.05;
		letter-spacing: 0.02em;
	}

	.title {
		margin-top: 0.25rem;
		font-size: 1.25rem;
		color: var(--cv-title);
	}

	.lead {
		max-width: 50rem;
		margin-top: 0.75rem;
		font-size: 1.0625rem;
		line-height: 1.55;
	}

	.swatches {
		position: absolute;
		top: 2.375rem;
		right: 2.25rem;
		display: flex;
		gap: 6px;
	}

	.swatches span {
		width: 36px;
		height: 9px;
		background: var(--cv-swatch-1);
	}

	.swatches span:nth-child(2) {
		background: var(--cv-swatch-2);
	}

	.swatches span:nth-child(3) {
		background: var(--cv-swatch-3);
	}

	.swatches span:nth-child(4) {
		background: var(--cv-swatch-4);
	}

	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19.5rem;
		gap: 2.5rem;
		align-items: start;
		margin-top: 1.75rem;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-bottom: 0.75rem;
		font-family: var(--font-pixel);
		font-weight: 600;
		font-size: 1.25rem;
		line-height: 1.2;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--cv-heading);
	}

	h2::before {
		content: '';
		flex: none;
		width: 12px;
		height: 12px;
		background: var(--cv-mark);
	}

	.job + .job {
		margin-top: 1.5rem;
	}

	h3 {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.3;
		color: var(--cv-heading);
	}

	.roles {
		margin-bottom: 0.5rem;
		font-size: 0.9375rem;
	}

	.role {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 1rem;
	}

	.dates {
		color: var(--cv-muted);
		white-space: nowrap;
	}

	.role .dates {
		margin-left: auto;
	}

	h4 {
		margin: 1rem 0 0.375rem;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--cv-sub);
	}

	.roles + h4 {
		margin-top: 0.75rem;
	}

	.bullets > li {
		position: relative;
		padding-left: 1.25rem;
	}

	.bullets > li + li,
	.bullets .bullets {
		margin-top: 0.25rem;
	}

	.bullets > li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: calc(0.75em - 3px);
		width: 6px;
		height: 6px;
		background: var(--cv-bullet);
	}

	.bullets .bullets > li::before {
		background: var(--cv-bullet-2);
	}

	b,
	dt {
		font-weight: 700;
	}

	.side {
		padding: 1.5rem 1.5rem 0.25rem;
		font-size: 0.9375rem;
		background: var(--cv-panel);
		border-radius: 6px;
	}

	.side section {
		margin-bottom: 1.5rem;
	}

	.contact li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.contact li + li {
		margin-top: 0.375rem;
	}

	.icon {
		display: flex;
		flex: none;
		justify-content: center;
		width: 22px;
		color: var(--cv-mark);
	}

	.contact a:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.entry + .entry {
		margin-top: 0.75rem;
	}

	.entry :is(b, dt) {
		display: block;
		color: var(--cv-heading);
	}

	.entry .dates {
		display: block;
	}

	/* Phones; an A4 page is narrower than this but keeps the two columns. */
	@media screen and (width < 50rem) {
		/* Small enough for the back link and the download to share a row on most phones. */
		.bar {
			column-gap: 1rem;
		}

		.back,
		.download {
			gap: 0.5rem;
			font-size: 0.9375rem;
		}

		.download {
			padding-inline: 0.625rem;
		}

		.masthead {
			padding: 1.25rem 1.25rem 1.375rem;
		}

		.swatches {
			position: static;
			justify-content: flex-end;
			margin-bottom: 0.75rem;
		}

		.swatches span {
			width: 28px;
			height: 7px;
		}

		h1 {
			font-size: 2.25rem;
		}

		.columns {
			grid-template-columns: minmax(0, 1fr);
			gap: 2rem;
		}
	}

	@page {
		size: A4;
		margin: 10mm 12mm;
	}

	/* Printed, and the PDF: the design's own colours and sizes on one A4 page, in any palette. */
	@media print {
		:global(html:has(.cv-page)) {
			/* Over the theme's dark mode, which would also darken the page margins. */
			color-scheme: light !important;
			background: #fff;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.cv-page {
			--cv-text: #2a2b45;
			--cv-heading: #3b3c63;
			--cv-muted: #5d5e7e;
			--cv-sub: #6f78c9;
			--cv-panel: #f6f2ea;
			--cv-band: #3b3c63;
			--cv-band-text: #f6f2ea;
			--cv-title: #e3a65a;
			--cv-swatch-1: #6f78c9;
			--cv-swatch-2: #72d0c4;
			--cv-swatch-3: #e0679f;
			--cv-swatch-4: #e0b865;
			--cv-mark: #e0679f;
			--cv-bullet: #e3a65a;
			--cv-bullet-2: #72d0c4;

			padding: 0;
			font-size: 9pt;
			line-height: 1.31;
		}

		.bar {
			display: none;
		}

		.cv {
			max-width: none;
		}

		.masthead {
			padding: 4.5mm 7mm 3.5mm;
		}

		h1 {
			font-size: 22pt;
		}

		.title {
			margin-top: 0.5mm;
			font-size: 11.5pt;
		}

		.lead {
			max-width: none;
			margin-top: 2mm;
			font-size: 9.6pt;
			line-height: inherit;
		}

		.swatches {
			top: 6mm;
			right: 7mm;
			gap: 1.5mm;
		}

		.swatches span {
			width: 9mm;
			height: 2.2mm;
			border-radius: 1px;
		}

		.columns {
			grid-template-columns: minmax(0, 1fr) 50mm;
			gap: 6mm;
			margin-top: 3.5mm;
		}

		h2 {
			gap: 2mm;
			margin-bottom: 1.5mm;
			font-size: 11pt;
			letter-spacing: 1px;
		}

		h2::before {
			width: 2.6mm;
			height: 2.6mm;
		}

		.job + .job {
			margin-top: 2mm;
		}

		h3 {
			font-size: 10.8pt;
			line-height: inherit;
		}

		.roles {
			margin-bottom: 1mm;
			font-size: 8.6pt;
		}

		.role {
			column-gap: 4mm;
		}

		.role .dates {
			font-size: 9pt;
		}

		h4,
		.roles + h4 {
			margin: 1.6mm 0 0.8mm;
			font-size: 8.6pt;
			letter-spacing: 0.8px;
		}

		.bullets > li {
			padding-left: 4mm;
			break-inside: avoid;
		}

		.bullets > li + li {
			margin-top: 0.4mm;
		}

		.bullets .bullets {
			margin-top: 0.6mm;
		}

		.bullets > li::before {
			left: 0.3mm;
			top: 1.45mm;
			width: 1.5mm;
			height: 1.5mm;
		}

		.side {
			padding: 4mm 4mm 0.5mm;
			font-size: inherit;
		}

		.side section {
			margin-bottom: 3.5mm;
		}

		.contact li {
			gap: 1.4mm;
			margin-bottom: 0.9mm;
			font-size: 8.5pt;
		}

		.contact li + li {
			margin-top: 0;
		}

		.icon {
			width: 3.4mm;
		}

		/* 2 px per icon pixel on screen, 0.3 mm on paper. */
		.icon :global(svg) {
			zoom: 0.567;
		}

		.entry {
			margin-bottom: 2mm;
			break-inside: avoid;
		}

		.entry + .entry {
			margin-top: 0;
		}

		h2,
		h3,
		h4,
		.roles {
			break-after: avoid;
		}
	}
</style>
