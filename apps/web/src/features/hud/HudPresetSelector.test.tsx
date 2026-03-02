import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HudPresetSelector } from './HudPresetSelector';

describe('HudPresetSelector', () => {
  it('renders preset options and marks active preset', () => {
    const onSelectPreset = vi.fn();

    render(<HudPresetSelector activePresetId="crt" onSelectPreset={onSelectPreset} />);

    const crtButton = screen.getByRole('button', { name: /crt tactical/i });
    const nvgButton = screen.getByRole('button', { name: /nvg recon/i });

    expect(crtButton).toHaveAttribute('aria-pressed', 'true');
    expect(nvgButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(nvgButton);
    expect(onSelectPreset).toHaveBeenCalledWith('nvg');
  });
});
