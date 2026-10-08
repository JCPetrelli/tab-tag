import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PALETTE, titleFromCommand, titleFromWords, toTitle } from '../hooks/words'

const world = (on: On, reply: string) => {
  const tabs: string[][] = []
  mock.store(on)
  on('session.id', () => ({ value: 's1' }))
  on('command.register', () => ({ value: { command: 'tab' } }))
  on('process.run', (_, e) => {
    tabs.push(e.argv.slice(2))

    return {
      value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: reply,
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  return tabs
}
const START = { cwd: '/Users/me/projects/shop-api', surface: 'terminal', isInteractive: true } as const

test('titles are one or two uppercase words and nothing else', () => {
  expect(toTitle('Checkout tests, second run')).toBe('CHECKOUT TESTS')
  expect(toTitle('\u001b]1;evil\u0007')).toBe('1 EVIL')
  expect(titleFromCommand('/release-notes-draft')).toBe('RELEASE NOTES')
  expect(titleFromCommand('/compact')).toBe('')
  expect(titleFromCommand('fix the build')).toBeNull()
  expect(titleFromWords('i want to find slow queries in the search page')).toBe('SLOW QUERIES')
})

test('a new session colours the tab and names it after the folder, then the first prompt', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const tabs = world(on, 'Checkout Tests.')

  await $.session.start(START)
  const [color, first] = tabs
  expect(color?.[0]).toBe('color')
  expect(PALETTE.some(c => [c.red, c.green, c.blue].map(String).join() === color?.slice(1).join())).toBe(true)
  expect(first).toEqual(['title', 'SHOP API'])

  await $.prompt.submit({ text: '/compact', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({
    text: 'the checkout tests fail on the second run',
    wait: false,
    origin: { kind: 'composer' },
  })
  await clock.advance(10)
  expect(tabs.at(-1)).toEqual(['title', 'CHECKOUT TESTS'])

  // Named once: a later prompt does not rename it.
  await $.prompt.submit({ text: 'what about the payment page', wait: false, origin: { kind: 'composer' } })
  await clock.advance(5000)
  expect(tabs.at(-1)).toEqual(['title', 'CHECKOUT TESTS'])
})

test('a headless session leaves the terminal alone', async ($, on) => {
  const tabs = world(on, 'x')

  await $.session.start({ ...START, surface: null, isInteractive: false })
  expect(tabs).toEqual([])
})
