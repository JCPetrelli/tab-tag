import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TabColor } from '../types'
import {
  isLinkOnly,
  lastSegment,
  pickColor,
  titleFromCommand,
  titleFromLink,
  titleFromWords,
  toTitle,
} from './words'

const title = atom({ plugin: 'tab-tag', key: 'title' } as const, '')
const color = atom({ plugin: 'tab-tag', key: 'color' } as const, null)
const isNamed = atom({ plugin: 'tab-tag', key: 'isNamed' } as const, false)
const isLinkWaiting = atom({ plugin: 'tab-tag', key: 'isLinkWaiting' } as const, false)

const SYSTEM =
  'You label terminal tabs. Reply with ONE or TWO words, uppercase, naming the project or topic of the request. No punctuation, no explanation.'
const MAX_SAVED = 300

type Saved = { title: string; color: TabColor; isNamed: boolean }

async function tab($: EngineInterface, args: readonly string[]) {
  const script = `${$.plugin.root}/bin/tab.sh`
  await $.process.run(['sh', script, ...args], { timeoutMs: 5000 }).catch(() => undefined)
}

// Claude Code writes its own title as a turn starts and ends, so the tab's is
// written again at those moments.
async function paint($: EngineInterface) {
  const text = await read($, title)

  if (text !== '') {
    await tab($, ['title', text])
  }
}

async function save($: EngineInterface) {
  const tint = await read($, color)

  if (tint === null) {
    return
  }

  const saved: Saved = {
    title: await read($, title),
    color: tint,
    isNamed: await read($, isNamed),
  }
  await $.store.set(`tab:${await $.session.id()}`, saved)
  const keys = (await $.store.keys()).filter(key => key.startsWith('tab:'))

  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SAVED))) {
    await $.store.delete(key)
  }
}

async function rename($: EngineInterface, text: string) {
  if (text === '') {
    return
  }

  await update($, title, () => text)
  await update($, isNamed, () => true)
  await paint($)
  await save($)
}

// The last messages of the conversation, as text for a title.
async function conversation($: EngineInterface, roles: readonly string[]) {
  return (await $.session.messages())
    .filter(message => roles.includes(message.role) && message.text !== '' && !message.text.startsWith('/'))
    .slice(-6)
    .map(message => message.text.slice(0, 300))
    .join('\n')
}

// `words` is the text the fallback reads when no model answers.
async function summarize($: EngineInterface, prompt: string, model: string, words = prompt) {
  let text = ''

  if (model !== '') {
    const reply = await $.model.complete({
      model,
      system: SYSTEM,
      prompt: prompt.slice(0, 1500),
      maxTokens: 16,
    })
    text = reply.isAnswered ? toTitle(reply.text) : ''
  }

  await rename($, text === '' ? titleFromWords(words) : text)
}

export const register: Register = (on, options) => {
  const model = String(options.model ?? '')

  on('session.start', async ($, e, next) => {
    if (!e.isInteractive) {
      return next(e)
    }

    await $.command.register({
      name: 'tab',
      description: 'Rename this iTerm2 tab: /tab TWO WORDS, or /tab alone to name it again from the conversation',
      argumentHint: '[words]',
    })
    const found = (await $.store.get(`tab:${await $.session.id()}`)) as Saved | undefined
    const tint = found?.color ?? pickColor(Math.random())
    const text = found?.title ?? toTitle(lastSegment(e.cwd))
    await update($, color, () => tint)
    await update($, title, () => text)
    await update($, isNamed, () => found?.isNamed ?? false)
    await tab($, ['color', String(tint.red), String(tint.green), String(tint.blue)])
    await paint($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const entered = await next(e)
    const isPerson = e.origin.kind === 'composer'

    if (isPerson && !(await read($, isNamed))) {
      const fromCommand = titleFromCommand(e.text)

      if (fromCommand === null && isLinkOnly(e.text)) {
        // A link alone: GitHub's address names the repository. Any other link
        // is named when the turn ends, from what Claude read behind it.
        const fromLink = titleFromLink(e.text)
        await update($, isLinkWaiting, () => fromLink === '')
        await rename($, fromLink)
      } else if (fromCommand === null) {
        $.clock.after(0, () => summarize($, e.text, model))
      } else {
        await rename($, fromCommand)
      }
    }

    $.clock.after(1500, () => paint($))

    return entered
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    if (e.agentId === undefined) {
      if ((await read($, isLinkWaiting)) && !(await read($, isNamed))) {
        await summarize($, await conversation($, ['user', 'assistant']), model, await conversation($, ['user']))
      }

      await update($, isLinkWaiting, () => false)
      await paint($)
      $.clock.after(1500, () => paint($))
    }

    return done
  })

  on('command.run', { command: 'tab' }, async ($, e) => {
    const asked = toTitle(e.args)

    if (asked !== '') {
      await rename($, asked)

      return { text: `Tab named ${asked}.` }
    }

    await summarize($, await conversation($, ['user']), model)

    return { text: `Tab named ${await read($, title)}.` }
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, isNamed, () => false)
    } else {
      await tab($, ['reset'])
    }

    return next(e)
  })
}
