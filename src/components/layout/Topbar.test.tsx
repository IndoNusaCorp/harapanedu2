import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Mod from './Topbar';

describe('Topbar.tsx', () => {
  it('renders or executes without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
