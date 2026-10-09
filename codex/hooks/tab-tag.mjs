#!/usr/bin/env node
// tab-tag for Codex: one command for every hook event. Codex gives the event as
// JSON on stdin. Nothing is printed: Codex adds a hook's stdout to the context.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { isLinkOnly, lastSegment, pickColor, titleFromLink, titleFromWords, toTitle } from './words.mjs'

const MAX_SAVED = 300
const DATA = process.env.PLUGIN_DATA ?? join(homedir(), '.codex', 'tab-tag')

// The hook has no controlling terminal: walk up to the first ancestor that has one.
const findTerminal = () => {
  if (process.env.TAB_TAG_TTY) {
    return process.env.TAB_TAG_TTY
  }

  let pid = String(process.pid)

  while (pid !== '' && pid !== '0' && pid !== '1') {
    const [name = '', parent = ''] = execFileSync('ps', ['-o', 'tty=,ppid=', '-p', pid], { encoding: 'utf8' })
      .trim()
      .split(/\s+/)

    if (name !== '' && name !== '??') {
      return `/dev/${name}`
    }

    pid = parent
  }

  return null
}

const write = (terminal, text) => writeFileSync(terminal, text, { flag: 'a' })

const paintTitle = (terminal, title) => {
  if (title !== '') {
    write(terminal, `\u001b]1;${title}\u0007`)
  }
}

const paintColor = (terminal, { red, green, blue }) =>
  write(
    terminal,
    `\u001b]6;1;bg;red;brightness;${red}\u0007` +
      `\u001b]6;1;bg;green;brightness;${green}\u0007` +
      `\u001b]6;1;bg;blue;brightness;${blue}\u0007`,
  )

const reset = terminal => write(terminal, '\u001b]6;1;bg;*;default\u0007\u001b]1;\u0007')

const fileOf = id => join(DATA, `${id.replace(/[^\w-]/g, '_')}.json`)

const load = id => {
  try {
    return JSON.parse(readFileSync(fileOf(id), 'utf8'))
  } catch {
    return null
  }
}

const save = (id, saved) => {
  mkdirSync(DATA, { recursive: true })
  writeFileSync(fileOf(id), JSON.stringify(saved))
  const files = readdirSync(DATA)
    .filter(name => name.endsWith('.json'))
    .map(name => ({ path: join(DATA, name), time: statSync(join(DATA, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time)

  for (const { path } of files.slice(MAX_SAVED)) {
    rmSync(path, { force: true })
  }
}

// A session the hook did not see start (the plugin was installed mid-session).
const open = (id, cwd) =>
  load(id) ?? { title: toTitle(lastSegment(cwd)), color: pickColor(Math.random()), isNamed: false }

const titleOf = prompt => (isLinkOnly(prompt) ? titleFromLink(prompt) : titleFromWords(prompt))

const run = (event, terminal) => {
  const id = String(event.session_id ?? '')
  const kind = event.hook_event_name

  if (id === '') {
    return
  }

  if (kind === 'SessionEnd') {
    reset(terminal)

    return
  }

  const saved = open(id, String(event.cwd ?? ''))

  if (kind === 'SessionStart') {
    paintColor(terminal, saved.color)
  }

  // Named once. A prompt that gives no title (a link to somewhere unknown, a
  // lone "hi") leaves the name to the next prompt.
  if (kind === 'UserPromptSubmit' && !saved.isNamed) {
    const title = titleOf(String(event.prompt ?? ''))

    if (title !== '') {
      saved.title = title
      saved.isNamed = true
    }
  }

  // Codex writes its own title while it works, so the tab's is written again
  // at every event.
  paintTitle(terminal, saved.title)
  save(id, saved)
}

try {
  if (process.env.TERM_PROGRAM === 'iTerm.app' || process.env.TAB_TAG_TTY) {
    const terminal = findTerminal()

    if (terminal !== null) {
      run(JSON.parse(readFileSync(0, 'utf8')), terminal)
    }
  }
} catch {
  // A tab that stays unnamed is better than a hook error in the session.
}
