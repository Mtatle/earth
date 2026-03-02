import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HudStateNotice } from './HudStateNotice';

describe('HudStateNotice', () => {
  it('renders mode-specific copy', () => {
    render(<HudStateNotice mode="loading" />);
    expect(screen.getByText('Initializing tactical surface')).toBeInTheDocument();

    render(<HudStateNotice mode="empty" />);
    expect(screen.getByText('Awaiting operational data')).toBeInTheDocument();

    render(<HudStateNotice mode="error" />);
    expect(screen.getByText('HUD degraded mode')).toBeInTheDocument();
  });
});
