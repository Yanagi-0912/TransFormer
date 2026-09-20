import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/renderer/setup.ts'],
    include: ['tests/renderer/**/*.test.tsx'],
    css: true,
  },
})
