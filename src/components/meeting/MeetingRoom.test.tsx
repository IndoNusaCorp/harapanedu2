import { describe, it, expect } from 'vitest';
import * as Mod from './MeetingRoom';

describe('MeetingRoom.tsx', () => {
  it('imports without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
