export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  jumpJustReleased: boolean;
  attack: boolean;
  attackPressed: boolean;
  useItem: boolean;
  useItemPressed: boolean;
}

/**
 * Unified keyboard + virtual touch pad state.
 * Scenes feed keyboard/touch into this adapter each frame.
 */
export class InputAdapter {
  left = false;
  right = false;
  jumpHeld = false;
  attackHeld = false;
  useItemHeld = false;

  private prevJump = false;
  private prevAttack = false;
  private prevUse = false;

  jumpPressed = false;
  jumpJustReleased = false;
  attackPressed = false;
  useItemPressed = false;

  setTouchMove(dir: -1 | 0 | 1): void {
    this.left = dir < 0;
    this.right = dir > 0;
  }

  setTouchJump(down: boolean): void {
    this.jumpHeld = down;
  }

  setTouchAttack(down: boolean): void {
    this.attackHeld = down;
  }

  setTouchUseItem(down: boolean): void {
    this.useItemHeld = down;
  }

  applyKeyboard(keys: {
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
    useItem: boolean;
  }): void {
    // Keyboard OR with touch
    this.left = this.left || keys.left;
    this.right = this.right || keys.right;
    this.jumpHeld = this.jumpHeld || keys.jump;
    this.attackHeld = this.attackHeld || keys.attack;
    this.useItemHeld = this.useItemHeld || keys.useItem;
  }

  beginFrame(): void {
    // Touch state is sticky until released; keyboard reapplied each frame from scene
  }

  /** Call after merging all sources for the frame. */
  finalize(): void {
    this.jumpPressed = this.jumpHeld && !this.prevJump;
    this.jumpJustReleased = !this.jumpHeld && this.prevJump;
    this.attackPressed = this.attackHeld && !this.prevAttack;
    this.useItemPressed = this.useItemHeld && !this.prevUse;
    this.prevJump = this.jumpHeld;
    this.prevAttack = this.attackHeld;
    this.prevUse = this.useItemHeld;
  }

  /** Reset ephemeral keyboard merge; keep touch held state. */
  clearKeyboardMerge(): void {
    // touch fields remain; keyboard flags cleared by reassignment in scene
  }

  snapshot(): InputState {
    return {
      left: this.left,
      right: this.right,
      jump: this.jumpHeld,
      jumpPressed: this.jumpPressed,
      jumpJustReleased: this.jumpJustReleased,
      attack: this.attackHeld,
      attackPressed: this.attackPressed,
      useItem: this.useItemHeld,
      useItemPressed: this.useItemPressed,
    };
  }

  /** Before reading keyboard, clear movement unless touch is holding. */
  resetTransient(fromTouch: { left: boolean; right: boolean; jump: boolean; attack: boolean; useItem: boolean }): void {
    this.left = fromTouch.left;
    this.right = fromTouch.right;
    this.jumpHeld = fromTouch.jump;
    this.attackHeld = fromTouch.attack;
    this.useItemHeld = fromTouch.useItem;
  }
}
