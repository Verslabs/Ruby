// Every visitor-visible string lives here so the copy can be reviewed in one
// pass. Written to the Humanizer standard: active voice, no em dashes, no
// hype words, no rule-of-three padding, no fake enthusiasm.

export const HERO = {
  eyebrow: 'Ruby · full-stack developer & founder',
  // `grad: true` marks the words that get the pink-to-cyan gradient
  headline: [
    { text: 'I build software', grad: false },
    { text: 'that squishes', grad: true },
    { text: 'when you poke it.', grad: false },
  ] as const,
  sub: 'CTO at ZenomoStudio, founder of VerineAI. Kotlin, Java, Python, JavaScript, TypeScript. I care about how the last five percent feels.',
  scrollHint: 'Scroll. Everything here moves when you do.',
  grabHint: 'Grab any shape and throw it. That is the whole interaction model.',
} as const

export const ABOUT = {
  label: 'About',
  heading: 'The short version',
  steps: [
    "I'm Ruby.",
    'I write the code people actually notice. The animation that lands. The transition that does not stutter on a mid-range phone.',
    'Then I write the rest of it. Half-finished work annoys me more than slow work.',
    'I started on the JVM. Kotlin and Java where things need to be fast and boring, Python when the job is data, TypeScript for anything a person touches.',
    'I work best with people who notice details. Agencies, founders, and whoever inherits the codebase six months later.',
  ],
  exit: "That's the short version. Here's what it's made of.",
} as const

export type StackEntry = {
  id: string
  name: string
  color: string
  note: string
}

export const STACK = {
  label: 'Stack',
  heading: 'What I actually write',
  entries: [
    {
      id: 'kotlin',
      name: 'Kotlin',
      color: '#6C63D8',
      note: 'Android, mostly. Also JVM services when the runtime is already there and starting a second one would be silly.',
    },
    {
      id: 'java',
      name: 'Java',
      color: '#F7A1C6',
      note: 'Spring and Quarkus. Gradle build tooling, which I have opinions about.',
    },
    {
      id: 'python',
      name: 'Python',
      color: '#90BFE6',
      note: 'Data work, scrapers, and the scripts that save twenty minutes every time I run them.',
    },
    {
      id: 'javascript',
      name: 'JavaScript',
      color: '#52D6F7',
      note: 'Where I learned that every fix is a trade. Still true.',
    },
    {
      id: 'typescript',
      name: 'TypeScript',
      color: '#C3A5D8',
      note: 'Default now. Every frontend I have shipped in the last few years is written in it.',
    },
  ] satisfies StackEntry[],
  note: 'Scroll faster and the ribbons react. Drag a badge if you want, they always come back.',
} as const

export type Role = {
  id: string
  org: string
  role: string
  body: string
  href?: string
  linkLabel?: string
}

export const EXPERIENCE = {
  label: 'Experience',
  heading: 'Running things',
  roles: [
    {
      id: 'zenomo',
      org: 'ZenomoStudio',
      role: 'CTO',
      body: 'I set the technical direction and keep the team unblocked. Architecture, code review, and hiring calls that need a real answer instead of a fast one.',
      href: 'https://github.com/ZenomoStudio',
      linkLabel: 'ZenomoStudio on GitHub',
    },
    {
      id: 'verine',
      org: 'VerineAI',
      role: 'Founder',
      body: 'I started it. Product, engineering, and the sales calls I did not want to make.',
    },
  ] satisfies Role[],
  reposLabel: 'Open source',
  repos: [
    {
      id: 'kitkats',
      handle: 'KitKatsDevelopment',
      href: 'https://github.com/KitKatsDevelopment',
      note: 'Kotlin and Android. Half tutorials, half things I actually ship.',
    },
    {
      id: 'collared',
      handle: 'CollaredKittyCat',
      href: 'https://github.com/CollaredKittyCat',
      note: 'Experiments. Most of them never go anywhere, which is fine.',
    },
  ],
} as const

export const BLOG = {
  label: 'Blog',
  heading: 'Latest writing',
  cta: 'View Blog',
  readCta: 'Read the post',
  empty: 'Nothing published yet. The first post is on its way.',
} as const

export const CONTACT = {
  label: 'Contact',
  heading: 'Say hello',
  body: 'Got something that needs building, or you just want to argue about type systems? Either one works.',
  prompt: 'Press the button. It throws confetti at the problem.',
  cta: 'Send it',
  email: 'tyler@verslabs.net',
  emailLabel: 'Email Ruby',
  linksLabel: 'GitHub',
  links: [
    { handle: 'KitKatsDevelopment', href: 'https://github.com/KitKatsDevelopment' },
    { handle: 'CollaredKittyCat', href: 'https://github.com/CollaredKittyCat' },
    { handle: 'ZenomoStudio', href: 'https://github.com/ZenomoStudio' },
  ],
} as const

export const NAV = {
  label: 'Main navigation',
  skip: 'Skip to content',
  items: [
    { id: 'about', label: ABOUT.label },
    { id: 'stack', label: STACK.label },
    { id: 'experience', label: EXPERIENCE.label },
    { id: 'blog', label: BLOG.label },
    { id: 'contact', label: CONTACT.label },
  ],
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
} as const

export const DRAWER = {
  title: 'Say hello',
  body: 'Tell me what you are building and what it has to do. I read everything and reply to most of it.',
  close: 'Close',
  emailLabel: 'Email',
  githubLabel: 'GitHub',
} as const

export const STAGE_LABELS = {
  hero: 'Intro',
  about: ABOUT.label,
  stack: STACK.label,
  experience: EXPERIENCE.label,
  blog: BLOG.label,
  contact: CONTACT.label,
} as const

export type StageId = keyof typeof STAGE_LABELS