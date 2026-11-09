import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo-name>/.
export default defineConfig({
  base: '/magic-lamp/',
  plugins: [react()],
  // The Hand model is a binary glTF asset.
  assetsInclude: ['**/*.glb'],
  test: {
    // Agent worktrees live under .claude/; never collect their tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
