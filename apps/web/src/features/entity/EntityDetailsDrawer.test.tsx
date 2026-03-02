import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityDetailsDrawer } from './EntityDetailsDrawer';
import { SAMPLE_FLIGHT_ENTITY, SAMPLE_QUAKE_ENTITY } from './fixtures';

describe('EntityDetailsDrawer', () => {
  it('renders empty state when no entity is selected', () => {
    render(<EntityDetailsDrawer entity={null} followMode="off" />);

    expect(screen.getByRole('heading', { name: 'Entity Details' })).toBeInTheDocument();
    expect(screen.getByText('No entity selected.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
  });

  it('renders selected entity details and metadata', () => {
    render(
      <EntityDetailsDrawer
        entity={SAMPLE_FLIGHT_ENTITY}
        followMode="off"
        nowMs={Date.parse('2026-03-02T00:01:00.000Z')}
      />
    );

    expect(screen.getByText('FLIGHT · flight-AAL123')).toBeInTheDocument();
    expect(screen.getByText('Source opensky')).toBeInTheDocument();
    expect(screen.getByText('40.641° N, 73.778° W')).toBeInTheDocument();
    expect(screen.getByText('10,668 m')).toBeInTheDocument();
    expect(screen.getByText('78.0°')).toBeInTheDocument();
    expect(screen.getByText('238 m/s (463 kt)')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('AAL123')).toBeInTheDocument();
  });

  it('invokes follow/clear handlers and follow button label switches', () => {
    const onToggleFollow = vi.fn();
    const onClearSelection = vi.fn();

    const { rerender } = render(
      <EntityDetailsDrawer
        entity={SAMPLE_QUAKE_ENTITY}
        followMode="off"
        onToggleFollow={onToggleFollow}
        onClearSelection={onClearSelection}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Follow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));

    expect(onToggleFollow).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    rerender(
      <EntityDetailsDrawer
        entity={SAMPLE_QUAKE_ENTITY}
        followMode="follow"
        onToggleFollow={onToggleFollow}
        onClearSelection={onClearSelection}
      />
    );

    expect(screen.getByRole('button', { name: 'Stop Follow' })).toBeInTheDocument();
  });
});
