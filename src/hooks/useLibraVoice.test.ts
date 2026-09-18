import { describe, it, expect } from 'vitest';
import * as Mod from './useLibraVoice';

describe('useLibraVoice.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
