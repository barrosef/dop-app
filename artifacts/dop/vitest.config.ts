import { defineConfig } from 'vitest/config';

// Node environment on purpose: what is tested here is pure decision logic, not
// rendering. A jsdom environment would invite tests that mount screens, which is
// not what this runner was added for.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
