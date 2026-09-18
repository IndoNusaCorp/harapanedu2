import { describe, it, expect } from 'vitest';
import * as Mod from './client';

describe('client.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
