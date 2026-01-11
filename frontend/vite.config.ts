import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:3001'
  
  // Escape special regex characters in the API URL
  const escapedApiUrl = apiUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false // Disable in development to avoid caching issues
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              // Cache API calls with network-first strategy (works in dev and production)
              urlPattern: new RegExp(`^${escapedApiUrl}/.*`),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                networkTimeoutSeconds: 10
              }
            },
          {
            // Cache Firebase requests with stale-while-revalidate
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            // Cache Firestore requests with stale-while-revalidate
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            // Cache images with cache-first strategy
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Lists',
        short_name: 'Lists',
        description: 'Save and organize your recipes',
        theme_color: '#F4A460',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true, // Fail if port is already in use
    hmr: {
      overlay: true, // Show errors in browser overlay
    },
    watch: {
      usePolling: true, // Better file watching on some systems
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '0.0.0.0', // Allow external connections (for mobile testing)
  },
  clearScreen: false, // Keep terminal output visible
  }
})
