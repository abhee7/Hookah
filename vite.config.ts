import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The AR engine is lazy-loaded; it is expected to be the one large chunk
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Keep the big libraries in their own files so browsers cache them across deploys
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'mediapipe', test: /node_modules[\\/]@mediapipe[\\/]/ }
          ]
        }
      }
    }
  }
})
