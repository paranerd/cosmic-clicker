import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/cosmic-clicker/' : '/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
