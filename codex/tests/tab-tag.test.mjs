import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { isLinkOnly, titleFromLink, titleFromWords, toTitle } from '../hooks/words.mjs'

const SCRIPT = fileURLToPath(new URL('../hooks/tab-tag.mjs', import.meta.url))
const ESC = '\u001b'

// Runs the hook as Codex does, with a file in place of the terminal.
const session = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tab-tag-'))
  const terminal = join(dir, 'tty')
  writeFileSync(terminal, '')

  return {
    send: event => {
      writeFileSync(terminal, '')
      const stdout = execFileSync('node', [SCRIPT], {
        input: JSON.stringify({ session_id: 's1', cwd: '/Users/me/projects/shop-api', ...event }),
        env: { ...process.env, TAB_TAG_TTY: terminal, PLUGIN_DATA: join(dir, 'data') },
        encoding: 'utf8',
      })
      assert.equal(stdout, '')

      return readFileSync(terminal, 'utf8')
    },
  }
}
const titled = text => `${ESC}]1;${text}\u0007`

test('titles are one or two uppercase words and nothing else', () => {
  assert.equal(toTitle('Checkout tests, second run'), 'CHECKOUT TESTS')
  assert.equal(toTitle(`${ESC}]1;evil\u0007`), '1 EVIL')
  assert.equal(titleFromWords('i want to find slow queries in the search page'), 'SLOW QUERIES')
})

test('a link alone is named from GitHub, or left for the next prompt', () => {
  assert.equal(isLinkOnly('https://acme.slack.com/archives/C01ABCD/p1712345678'), true)
  assert.equal(isLinkOnly('check this https://acme.slack.com/archives/C01ABCD/p1712345678'), true)
  assert.equal(isLinkOnly('why does https://example.com/checkout time out'), false)
  assert.equal(titleFromLink('https://acme.slack.com/archives/C01ABCD/p1712345678'), '')
  assert.equal(titleFromLink('https://github.com/JCPetrelli/brickwise/issues/42'), 'BRICKWISE 42')
  assert.equal(titleFromLink('https://github.com/JCPetrelli/tab-tag/pull/7'), 'TAB TAG')
  assert.equal(titleFromLink('https://github.com/JCPetrelli/brickwise.git'), 'BRICKWISE')
})

test('a session colours the tab, names it after the folder, then the first prompt', () => {
  const { send } = session()

  const started = send({ hook_event_name: 'SessionStart', source: 'startup' })
  assert.match(started, /\]6;1;bg;red;brightness;\d+/)
  assert.ok(started.endsWith(titled('SHOP API')))

  assert.equal(
    send({ hook_event_name: 'UserPromptSubmit', prompt: 'https://acme.slack.com/archives/C01/p17' }),
    titled('SHOP API'),
  )
  assert.equal(
    send({ hook_event_name: 'UserPromptSubmit', prompt: 'the checkout tests fail on the second run' }),
    titled('CHECKOUT TESTS'),
  )

  // Named once: a later prompt does not rename it.
  assert.equal(send({ hook_event_name: 'UserPromptSubmit', prompt: 'what about the payment page' }), titled('CHECKOUT TESTS'))
  assert.equal(send({ hook_event_name: 'Stop' }), titled('CHECKOUT TESTS'))

  // A resumed session gets its colour and name back.
  const resumed = send({ hook_event_name: 'SessionStart', source: 'resume' })
  assert.ok(resumed.endsWith(titled('CHECKOUT TESTS')))

  assert.equal(send({ hook_event_name: 'SessionEnd' }), `${ESC}]6;1;bg;*;default\u0007${ESC}]1;\u0007`)
})
