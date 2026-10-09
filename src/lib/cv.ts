export type CvDate = `${number}-${number}` | 'present';

export interface CvRole {
	title: string;
	start: CvDate;
	end: CvDate;
}

export interface CvItem {
	title: string;
	period: string;
	bullets: string[];
}

export type CvSection = { heading: string } & (
	{ bullets: string[]; items?: never } | { items: CvItem[]; bullets?: never }
);

export type CvJob = {
	company: string;
	start?: CvDate;
	end?: CvDate;
	roles: CvRole[];
} & ({ bullets: string[]; sections?: never } | { sections: CvSection[]; bullets?: never });

export interface Cv {
	basics: {
		name: string;
		title: string;
		location: string;
		email: string;
		website: string;
		linkedin: string;
		github: string;
	};
	summary: string;
	skills: { category: string; items: string[] }[];
	experience: CvJob[];
	earlierCareer: { company: string; title: string; period: string }[];
	education: { institution: string; degree: string; year: number }[];
}

// prompts/cv.json also has a phone number; it stays out because this file ships to the browser.
export const cv: Cv = {
	basics: {
		name: 'Joelle Ortiz',
		title: 'Staff Engineer',
		location: 'Melbourne, VIC',
		email: 'contact@joelleortiz.me',
		website: 'https://joelleortiz.me',
		linkedin: 'https://www.linkedin.com/in/joelle-ortiz/',
		github: 'https://github.com/joelleortiz'
	},
	summary:
		"I'm a full-stack engineer who deeply cares about UI/UX and building products people love using. I've been at Amber since it was small, starting new teams and launching products, including our UK and European expansion, and I'm now leading our vehicle-to-grid work. I'm the frontend go-to across engineering, good at connecting teams, and at my best untangling messy problems, whether it's a team that's stuck or a technical knot.",
	skills: [
		{
			category: 'Frontend and mobile',
			items: [
				'TypeScript',
				'JavaScript',
				'React',
				'React Native',
				'Expo',
				'Next.js',
				'Design systems',
				'CSS/SASS'
			]
		},
		{
			category: 'Backend and cloud',
			items: ['AWS (serverless)', 'Serverless Framework', 'Node.js']
		},
		{
			category: 'Practices',
			items: [
				'Technical leadership',
				'Architecture',
				'UI/UX and product engineering',
				'Cross-team delivery',
				'Product analytics',
				'Mentoring'
			]
		}
	],
	experience: [
		{
			company: 'Amber',
			start: '2021-12',
			end: 'present',
			roles: [
				{ title: 'Staff Engineer', start: '2025-01', end: 'present' },
				{ title: 'Senior Software Engineer', start: '2021-12', end: '2024-12' }
			],
			sections: [
				{
					heading: 'Leading new products',
					items: [
						{
							title: 'EV and V2G Automation',
							period: '2026 – present',
							bullets: [
								'Tech lead for a new vehicle-to-grid offering, leading cross-team delivery and representing the EV team. Team of 6 engineers.',
								'Led the launch of support for additional EV brands, extending smart charging beyond its original vehicle range, and improved the EV app experience.'
							]
						},
						{
							title: 'International expansion',
							period: '2024 – 2025',
							bullets: [
								'One of two founding engineers on the licensing work that took Amber beyond Australia. Kicked off in October 2024 and launched the UK MVP in January 2025, supporting the expansion into Europe.',
								'Became tech lead as the team grew from 2 to about 7 engineers.'
							]
						},
						{
							title: 'Growth',
							period: '2021 – 2024',
							bullets: [
								'Tech lead for the team responsible for engineering that drove customer acquisition.',
								"Delivered the public experience app showing non-customers their area's live renewables percentage, which contributed to sign-ups.",
								'Built the new get-a-quote flow and improved the sign-up form to support conversion and customer growth.',
								'Introduced a product analytics platform and drove its rollout across all teams in the product group.'
							]
						}
					]
				},
				{
					heading: 'Cross-team technical leadership',
					bullets: [
						'Seconded into teams that needed help getting started or delivering, including onboarding and upskilling new members of Growth so the team became productive quickly.',
						"Tech Enablement: Started Amber's design system. The foundations are now used by all teams, improving delivery speed and consistency across multiple apps, especially as International expanded.",
						'Frontend authority across engineering, connecting teams and driving cross-team collaboration.'
					]
				},
				{
					heading: 'Engineering and product leadership',
					bullets: [
						'Contribute to architecture decisions, engineering standards, and hiring and interviewing.',
						'Take part in product leadership discussions across the group.',
						'Mentor and coach engineers across teams, helping them grow as product-minded engineers.'
					]
				}
			]
		},
		{
			company: 'Nintex',
			roles: [{ title: 'Senior Software Engineer', start: '2019-03', end: '2021-12' }],
			bullets: [
				'Built front-end libraries and form designer/runtime features (Angular, TypeScript, Node.js), including the Data Source capability.',
				'Contributed to the React and web-components design system.',
				'Drove the Enablement initiative in the Forms Architecture Owners group and improved CI/CD pipelines.'
			]
		},
		{
			company: 'Kelly Services (Crédit Agricole CIB)',
			roles: [{ title: 'Senior Software Developer / Tech Lead', start: '2016-09', end: '2019-02' }],
			bullets: [
				'Led design and delivery of compliance web applications for the bank, with design and code reviews.',
				'Built a reusable audit engine and a reusable workflow engine used across applications.',
				"Introduced the team's first Angular 2+ project, unit testing and a documented engineering standards wiki."
			]
		}
	],
	earlierCareer: [
		{
			company: 'Willis Towers Watson',
			title: 'Software Developer / Module Owner / Sprint Lead',
			period: '2012 – 2016'
		},
		{ company: 'Macquarie Group', title: 'Graduate Program Associate', period: '2010 – 2012' }
	],
	education: [
		{
			institution: 'University of the Philippines',
			degree: "Bachelor's degree in Computer Science",
			year: 2010
		}
	]
};

export function cvHasContent(c: Cv = cv): boolean {
	return Boolean(c.summary.trim() || c.experience.length || c.skills.length);
}
