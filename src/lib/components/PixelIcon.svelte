<script lang="ts" module>
	// prettier-ignore
	const ICONS = {
		mail: [
			'###########',
			'##.......##',
			'#.#.....#.#',
			'#..#...#..#',
			'#...#.#...#',
			'#....#....#',
			'#.........#',
			'###########'
		],
		globe: [
			'..#####..',
			'.#..#..#.',
			'#..#.#..#',
			'#########',
			'#..#.#..#',
			'#########',
			'#..#.#..#',
			'.#..#..#.',
			'..#####..'
		],
		code: [
			'......#....',
			'..#...#.#..',
			'.#...#...#.',
			'#....#....#',
			'.#...#...#.',
			'..#.#...#..',
			'....#......'
		],
		briefcase: [
			'...#####...',
			'...#...#...',
			'###########',
			'#.........#',
			'#.........#',
			'#####.#####',
			'#.........#',
			'#.........#',
			'###########'
		]
	} satisfies Record<string, string[]>;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		scale?: number;
	}

	let { name, scale = 2 }: Props = $props();

	const rows = $derived(ICONS[name]);
	const w = $derived(rows[0].length);
	const h = $derived(rows.length);
	const d = $derived(
		rows
			.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')))
			.join('')
	);
</script>

<svg
	width={w * scale}
	height={h * scale}
	viewBox="0 0 {w} {h}"
	shape-rendering="crispEdges"
	aria-hidden="true"
	focusable="false"
>
	<path {d} fill="currentColor" />
</svg>
