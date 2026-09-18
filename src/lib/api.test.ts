import { describe, it, expect } from 'vitest';
import * as Mod from './api';

describe('api.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
