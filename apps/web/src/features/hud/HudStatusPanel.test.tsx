import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HudStatusPanel } from './HudStatusPanel';

describe('HudStatusPanel', () => {
  it('renders status rows and metric cards', () => {
    render(
      <HudStatusPanel
        statusItems={[
          { id: 'stream', label: 'Stream', value: 'live', tone: 'live' },
          { id: 'selection', label: 'Selection', value: 'none', tone: 'neutral' }
        ]}
        metrics={[
          { id: 'layers', label: 'Active Layers', value: '3' },
          { id: 'entities', label: 'Tracked Entities', value: '27' }
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'System Status' })).toBeInTheDocument();
    expect(screen.getByText('Stream')).toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
    expect(screen.getByText('Active Layers')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
  });
});
