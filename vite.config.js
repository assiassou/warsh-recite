import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ترتيل ورش',
        short_name: 'ترتيل ورش',
        description: 'تطبيق لتسميع القرآن الكريم برواية ورش عن نافع',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#0f6b4f',
        background_color: '#f7f3ea',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Warsh text dataset is large-ish; cache it so verses are usable offline
        // after the first visit, which matters on older/slower phones.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})
