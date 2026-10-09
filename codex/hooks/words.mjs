// The title rules of ../../hooks/words.ts, for the Codex hook script.
const MAX_WORDS = 2
const MAX_LENGTH = 24

const STOP_WORDS = new Set([
  'THE', 'AND', 'FOR', 'WITH', 'THAT', 'THIS', 'FROM', 'INTO', 'HAVE', 'WANT',
  'WOULD', 'COULD', 'SHOULD', 'PLEASE', 'MAKE', 'LETS', 'WHAT', 'WHEN', 'WHERE',
  'ABOUT', 'SOME', 'YOUR', 'JUST', 'LIKE', 'NEED', 'CAN', 'YOU', 'HOW', 'ARE',
  'USE', 'ALSO', 'THEN', 'THERE', 'WILL', 'ONLINE', 'FIND', 'CHECK', 'SEARCH',
])

const URL = /https?:\/\/\S+/i
const GITHUB = /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/([\w.-]+)(?:\/(?:issues|pull|discussions)\/(\d+))?/i

export const PALETTE = [
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

export const pickColor = random =>
  PALETTE[Math.floor(random * PALETTE.length) % PALETTE.length] ?? { red: 52, green: 152, blue: 219 }

// One or two uppercase words of letters and digits: nothing that could carry
// an escape sequence into the terminal.
export const toTitle = text => {
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

// The prompt's first two telling words.
export const titleFromWords = prompt => {
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
export const isLinkOnly = prompt => URL.test(prompt) && titleFromWords(prompt) === ''

// A GitHub link names its repository, and its issue or pull request when the
// repository's name leaves room for the number.
export const titleFromLink = prompt => {
  const found = GITHUB.exec(prompt)

  if (found === null) {
    return ''
  }

  const repo = toTitle((found[1] ?? '').replace(/\.git$/, ''))
  const number = found[2] ?? ''

  return number !== '' && !repo.includes(' ') ? toTitle(`${repo} ${number}`) : repo
}

export const lastSegment = path => path.split('/').filter(Boolean).at(-1) ?? path
