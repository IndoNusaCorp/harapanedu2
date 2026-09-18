import { describe, it, expect } from 'vitest';
import * as Mod from './firebase';

describe('firebase.ts', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
