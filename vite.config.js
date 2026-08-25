import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
    'import.meta.env.VITE_NVIDIA_API_KEY': JSON.stringify(process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY)
  },
  server: {
    proxy: {
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com/v1/chat/completions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, '')
      }
    }
  }
})
