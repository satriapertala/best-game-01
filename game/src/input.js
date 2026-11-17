// input.js — keyboard and mouse state. Keys are tracked by code so layout
// never matters, and pause is a consumed edge so one press toggles once.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.pauseQueued = false;
    this.muteQueued = false;
    addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyP' || e.code === 'Escape') this.pauseQueued = true;
      if (e.code === 'KeyM') this.muteQueued = true;
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  takePause() { const v = this.pauseQueued; this.pauseQueued = false; return v; }
  takeMute() { const v = this.muteQueued; this.muteQueued = false; return v; }
  takeClick() { const v = this.mouse.clicked; this.mouse.clicked = false; return v; }
  key(code) { return this.keys.has(code); }
  axis() {
    let x = 0, y = 0;
    if (this.key('KeyA') || this.key('ArrowLeft')) x -= 1;
    if (this.key('KeyD') || this.key('ArrowRight')) x += 1;
    if (this.key('KeyW') || this.key('ArrowUp')) y -= 1;
    if (this.key('KeyS') || this.key('ArrowDown')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }
  wantsDash() { return this.key('Space') || this.key('ShiftLeft') || this.key('ShiftRight'); }
  firing() { return this.mouse.down || this.key('KeyJ'); }
}
