import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/mini-store-pos/',
  
  plugins: [
    react(),
    VitePWA({
      manifest: {
        name: 'Mini-Store POS',
        short_name: 'Mini POS',
        description: 'Offline-first point-of-sale application for a family mini-store.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'landscape',
      },
    }),
  ],
})