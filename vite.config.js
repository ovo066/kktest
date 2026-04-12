import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || String(Date.now())

function resolveManualChunk(id) {
  if (!id.includes('node_modules')) return null
  if (id.includes('gpt-tokenizer/model/gpt-3.5-turbo')) return 'vendor-tokenizer-gpt35'
  if (id.includes('gpt-tokenizer/model/gpt-4.1')) return 'vendor-tokenizer-gpt41'
  if (id.includes('gpt-tokenizer/model/gpt-4o')) return 'vendor-tokenizer-gpt4o'
  if (id.includes('gpt-tokenizer/model/gpt-4')) return 'vendor-tokenizer-gpt4'
  if (id.includes('gpt-tokenizer/model/gpt-5')) return 'vendor-tokenizer-gpt5'
  if (id.includes('gpt-tokenizer/model/o4-mini')) return 'vendor-tokenizer-o4mini'
  if (id.includes('gpt-tokenizer/model/o3')) return 'vendor-tokenizer-o3'
  if (id.includes('gpt-tokenizer/model/o1')) return 'vendor-tokenizer-o1'
  if (id.includes('gpt-tokenizer')) return 'vendor-tokenizer-openai-base'
  if (id.includes('jszip')) return 'vendor-jszip'
  if (id.includes('howler')) return 'vendor-howler'
  return null
}

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return resolveManualChunk(id)
        }
      }
    }
  },
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
