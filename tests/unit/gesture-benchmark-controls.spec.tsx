import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GestureBenchmarkControls } from '@/gesture/GestureBenchmarkControls';
import type { GestureBenchmarkFrameTiming } from '@/gesture/gesture-benchmark';

const frame: GestureBenchmarkFrameTiming = {
  sampledAtMs: 100,
  resultReadyAtMs: 130,
  inferenceMs: 12,
  rttMs: 24,
  trackerMs: 2,
};

describe('GestureBenchmarkControls', () => {
  it('counts a sample after a paint opportunity and clears it on reset', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const { rerender } = render(
      <GestureBenchmarkControls frame={null} requestFrame={requestFrame} />,
    );

    rerender(<GestureBenchmarkControls frame={frame} requestFrame={requestFrame} />);
    expect(screen.getByText('0 amostras')).toBeInTheDocument();

    act(() => callbacks.shift()?.(135));
    act(() => callbacks.shift()?.(140));

    expect(screen.getByText('1 amostra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zerar' }));
    expect(screen.getByText('0 amostras')).toBeInTheDocument();
  });

  it('does not schedule the same frame again after updating the count', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      });

    render(<GestureBenchmarkControls frame={frame} />);
    act(() => callbacks.shift()?.(135));
    act(() => callbacks.shift()?.(140));

    expect(requestFrame).toHaveBeenCalledTimes(2);
  });

  it('exports only the aggregated JSON after at least one sample', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const download = vi.fn();
    render(
      <GestureBenchmarkControls
        frame={frame}
        requestFrame={requestFrame}
        download={download}
      />,
    );
    const exportButton = screen.getByRole('button', { name: 'Exportar JSON' });
    expect(exportButton).toBeDisabled();

    act(() => callbacks.shift()?.(135));
    act(() => callbacks.shift()?.(140));
    fireEvent.click(exportButton);

    expect(download).toHaveBeenCalledOnce();
    expect(JSON.parse(download.mock.calls[0][0])).toEqual({
      sampleCount: 1,
      metricsMs: {
        captureToResponse: { p50: 30, p95: 30 },
        inference: { p50: 12, p95: 12 },
        rtt: { p50: 24, p95: 24 },
        tracker: { p50: 2, p95: 2 },
        presentation: { p50: 8, p95: 8 },
        endToEnd: { p50: 40, p95: 40 },
      },
    });
  });

  it('records one sample through the development Strict Mode lifecycle', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    render(
      <StrictMode>
        <GestureBenchmarkControls frame={frame} requestFrame={requestFrame} />
      </StrictMode>,
    );
    while (callbacks.length > 0) {
      act(() => callbacks.shift()?.(140));
    }

    expect(screen.getByText('1 amostra')).toBeInTheDocument();
  });
});
