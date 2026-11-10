import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const cream = '#FFF3D6'

// Dependencies loaded at launch get their own chunk, so an ordinary deploy changes only the
// small app chunk: phones download less after a deploy and keep Chrome's compiled code for
// the libraries. Gemini and App Check stay out of it; they load on the first AI call.
function chunkFor(id: string) {
  if (!id.includes('/node_modules/')) return
  if (/\/node_modules\/(@firebase\/(ai|app-check)|firebase\/(ai|app-check))\//.test(id)) return
  return 'libraries'
}

export default defineConfig({
  // Claude Code's worktrees are whole copies of the repo, and their tests would run here too.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
  // The e2e stacks' dev servers run at once, each with its own (tests/e2e/stacks.mjs).
  cacheDir: process.env.VITE_CACHE_DIR,
  build: { rolldownOptions: { output: { manualChunks: chunkFor } } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Firebase Hosting serves the sign-in handler under /__/auth/; never answer it with index.html.
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
      manifest: {
        name: 'Kraft',
        short_name: 'Kraft',
        lang: 'nb',
        display: 'standalone',
        theme_color: cream,
        background_color: cream,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
