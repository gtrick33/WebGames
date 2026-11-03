import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePreviewCanvas, type PreviewScene } from '../src/platform/previewLoop';

describe('preview loop', () => {
  it('disposes the scene when the preview unmounts (LC-12: a tile mounts one on every hover)', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
    const dispose = vi.fn();
    const make = vi.fn((): PreviewScene => ({ frame: () => undefined, dispose }));
    function Tile() {
      const ref = usePreviewCanvas(false, make);
      return <canvas ref={ref} />;
    }
    const { unmount } = render(<Tile />);
    expect(make).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
