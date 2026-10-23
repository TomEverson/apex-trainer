import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so unit tests don't boot the Workers/Start plugins.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
