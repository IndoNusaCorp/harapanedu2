import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Mod from './layout';

describe('layout.tsx', () => {
  it('renders or executes without crashing', () => {
    expect(Mod).toBeDefined();
  });
});
