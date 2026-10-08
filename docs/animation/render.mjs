// Renders index.html to ../demo.mp4 and ../demo.gif.
//   npm install && node render.mjs
// Needs Google Chrome and ffmpeg. CHROME_PATH overrides where Chrome is.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import puppeteer from 'puppeteer-core'

const FPS = 30
const SECONDS = 10
const here = dirname(fileURLToPath(import.meta.url))
const frames = join(here, 'frames')
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

rmSync(frames, { recursive: true, force: true })
mkdirSync(frames)

const browser = await puppeteer.launch({ executablePath: chrome, headless: true })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 })
  await page.goto(`${pathToFileURL(join(here, 'index.html'))}?capture`)
  await page.waitForFunction('typeof window.renderAt === "function"')

  for (let frame = 0; frame < FPS * SECONDS; frame++) {
    await page.evaluate(time => window.renderAt(time), frame / FPS)
    await page.screenshot({ path: join(frames, `${String(frame).padStart(4, '0')}.png`) })
  }
} finally {
  await browser.close()
}

const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%04d.png')]
execFileSync('ffmpeg', [
  ...input,
  '-vf', 'scale=1920:1080:flags=lanczos',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
  join(here, '..', 'demo.mp4'),
])
execFileSync('ffmpeg', [
  ...input,
  '-vf', 'fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
  join(here, '..', 'demo.gif'),
])
rmSync(frames, { recursive: true, force: true })
console.log('wrote demo.mp4 and demo.gif')
