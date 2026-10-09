import type { TabColor } from '../types'

const MAX_WORDS = 2
const MAX_LENGTH = 24

// Commands that say nothing about what the session is for.
const SILENT_COMMANDS = new Set([
  'clear', 'compact', 'model', 'config', 'help', 'resume', 'tab', 'fast',
  'loop', 'status', 'usage', 'context', 'cost', 'init', 'login', 'doctor',
])

const STOP_WORDS = new Set([
  'THE', 'AND', 'FOR', 'WITH', 'THAT', 'THIS', 'FROM', 'INTO', 'HAVE', 'WANT',
  'WOULD', 'COULD', 'SHOULD', 'PLEASE', 'MAKE', 'LETS', 'WHAT', 'WHEN', 'WHERE',
  'ABOUT', 'SOME', 'YOUR', 'JUST', 'LIKE', 'NEED', 'CAN', 'YOU', 'HOW', 'ARE',
  'USE', 'ALSO', 'THEN', 'THERE', 'WILL', 'ONLINE', 'FIND', 'CHECK', 'SEARCH',
])

const URL = /https?:\/\/\S+/i
const GITHUB = /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/([\w.-]+)(?:\/(?:issues|pull|discussions)\/(\d+))?/i

export const PALETTE: readonly TabColor[] = [
  { red: 231, green: 76, blue: 60 },
  { red: 230, green: 126, blue: 34 },
  { red: 241, green: 196, blue: 15 },
  { red: 46, green: 204, blue: 113 },
  { red: 26, green: 188, blue: 156 },
  { red: 52, green: 152, blue: 219 },
  { red: 91, green: 110, blue: 225 },
  { red: 155, green: 89, blue: 182 },
  { red: 232, green: 67, blue: 147 },
  { red: 149, green: 165, blue: 166 },
  { red: 0, green: 184, blue: 212 },
  { red: 139, green: 195, blue: 74 },
]

export const pickColor = (random: number): TabColor =>
  PALETTE[Math.floor(random * PALETTE.length) % PALETTE.length] ?? { red: 52, green: 152, blue: 219 }

// One or two uppercase words of letters and digits: nothing that could carry
// an escape sequence into the terminal.
export const toTitle = (text: string): string => {
  const words = text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_WORDS)
  let title = words.join(' ')

  if (title.length > MAX_LENGTH) {
    title = (words[0] ?? '').slice(0, MAX_LENGTH)
  }

  return title
}

// The slash command a prompt runs, when it names what the session is for.
export const titleFromCommand = (prompt: string): string | null => {
  const found = /^\s*\/([\w:-]+)/.exec(prompt)

  if (found === null) {
    return null
  }

  const name = (found[1] ?? '').split(':').at(-1) ?? ''

  return SILENT_COMMANDS.has(name) ? '' : toTitle(name)
}

// The fallback when no model answers: the prompt's first two telling words.
export const titleFromWords = (prompt: string): string => {
  const words = prompt
    .toUpperCase()
    .replace(/HTTPS?:\S+/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))

  return toTitle(words.slice(0, MAX_WORDS).join(' '))
}

// A prompt that is a link and no telling word: the link's address says little
// about the subject, so the tab is named later.
export const isLinkOnly = (prompt: string): boolean => URL.test(prompt) && titleFromWords(prompt) === ''

// A GitHub link names its repository, and its issue or pull request when the
// repository's name leaves room for the number.
export const titleFromLink = (prompt: string): string => {
  const found = GITHUB.exec(prompt)

  if (found === null) {
    return ''
  }

  const repo = toTitle((found[1] ?? '').replace(/\.git$/, ''))
  const number = found[2] ?? ''

  return number !== '' && !repo.includes(' ') ? toTitle(`${repo} ${number}`) : repo
}

export const lastSegment = (path: string): string =>
  path.split('/').filter(Boolean).at(-1) ?? path
