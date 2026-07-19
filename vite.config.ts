import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cosmic-clicker/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
