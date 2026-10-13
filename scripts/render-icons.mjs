// Renders the app icons in public/icons/ from the Noto 🙈 SVG. Re-run after changing the SVG or colours.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BACKGROUND = '#FFF3D6'
const svg = readFileSync('public/icons/emoji_u1f648.svg', 'utf8')

// emoji = share of the icon's width taken by the emoji. Maskable icons keep it inside
// Android's central safe zone (a circle of 80% diameter).
const icons = [
  { file: 'icon-192.png', size: 192, emoji: 0.8 },
  { file: 'icon-512.png', size: 512, emoji: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, emoji: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, emoji: 0.75 },
]

const browser = await chromium.launch()
for (const { file, size, emoji } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const inner = Math.round(size * emoji)
  await page.setContent(`
    <body style="margin:0;width:${size}px;height:${size}px;background:${BACKGROUND};
                 display:flex;align-items:center;justify-content:center">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div>
    </body>`)
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false })
  await page.close()
}
await browser.close()
console.log(`Rendered ${icons.map((i) => i.file).join(', ')}`)
