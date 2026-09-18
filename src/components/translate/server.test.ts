import { describe, it, expect } from 'vitest';
import * as Mod from './server';

describe('server.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
