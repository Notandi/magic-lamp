import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite config', () => {
  it('serves from the GitHub Pages repo path', () => {
    expect(config.base).toBe('/magic-lamp/');
  });
});
