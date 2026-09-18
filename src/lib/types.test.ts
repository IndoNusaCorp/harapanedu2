import { describe, it, expect } from 'vitest';
import * as Mod from './types';

describe('types.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
