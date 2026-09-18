import { describe, it, expect } from 'vitest';
import * as Mod from './AiChat';

describe('AiChat.tsx', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
