import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-wisi.png', 'logo-wisiverse.png'],
      manifest: {
        name: 'WisiShift',
        short_name: 'WisiShift',
        description: 'Track your work shifts — part of the WiSiVERSE ecosystem',
        theme_color: '#E8352A',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'logo-wisi.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo-wisi.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo-wisi.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
})
