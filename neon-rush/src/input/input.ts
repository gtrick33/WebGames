export interface InputHandlers {
  steer: (dir: -1 | 1) => void;
  pause: () => void;
  confirm: () => void;
  /** First user gesture (used to unlock audio). */
  gesture: () => void;
}

/**
 * Keyboard + pointer (mouse and touch) controls.
 * Tap/click the left or right half of the play area to change lanes; arrows/A/D on keyboard.
 */
export class Input {
  enabled = false;
  private readonly onKey = (e: KeyboardEvent): void => {
    this.handlers.gesture();
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    const typing = target?.closest('input, select, textarea');
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (this.enabled) {
          e.preventDefault();
          this.handlers.steer(-1);
        }
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (this.enabled) {
          e.preventDefault();
          this.handlers.steer(1);
        }
        break;
      case 'Escape':
      case 'KeyP':
        this.handlers.pause();
        break;
      case 'Space':
      case 'Enter':
        if (!typing && !target?.closest('button')) {
          e.preventDefault();
          this.handlers.confirm();
        }
        break;
    }
  };

  private readonly onPointer = (e: PointerEvent): void => {
    this.handlers.gesture();
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = this.area.getBoundingClientRect();
    e.preventDefault();
    this.handlers.steer(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  };

  private readonly onAnyGesture = (): void => this.handlers.gesture();

  constructor(private readonly area: HTMLElement, private readonly handlers: InputHandlers) {
    window.addEventListener('keydown', this.onKey);
    area.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('pointerdown', this.onAnyGesture, { capture: true });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.area.removeEventListener('pointerdown', this.onPointer);
    window.removeEventListener('pointerdown', this.onAnyGesture, { capture: true });
  }
}
