import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const cream = '#FFF3D6'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Firebase Hosting serves the sign-in handler under /__/auth/; never answer it with index.html.
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
      manifest: {
        name: 'Kraft',
        short_name: 'Kraft',
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
