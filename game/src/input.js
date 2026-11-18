// Prism Harvest — input: keyboard state, one-frame presses, and the pointer.
//
// The game loop asks three questions: which directions are held (movement),
// which keys went down this frame (dash, pause, restart), and where the
// pointer is and whether it is held (glide-to-pointer control). Everything
// DOM-shaped stays in this file.

'use strict';

PRISM.input = (function () {
  const held = new Set();       // key codes currently down
  const pressed = new Set();    // key codes that went down since last frame
  const pointer = { x: 0, y: 0, down: false, active: false };

  const tracked = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'Space', 'ShiftLeft', 'ShiftRight',
    'Enter', 'KeyR', 'KeyP', 'KeyM', 'Escape',
  ]);

  function attach(canvas) {
    window.addEventListener('keydown', (event) => {
      if (tracked.has(event.code)) {
        if (!event.repeat) pressed.add(event.code);
        held.add(event.code);
        // Keep the page from scrolling away from the game.
        if (event.code.startsWith('Arrow') || event.code === 'Space') {
          event.preventDefault();
        }
      }
      PRISM.audio.unlock();
    });
    window.addEventListener('keyup', (event) => { held.delete(event.code); });
    window.addEventListener('blur', () => { held.clear(); pointer.down = false; });

    const toArena = (event) => {
      const rect = canvas.getBoundingClientRect();
      const cfg = PRISM.config.arena;
      pointer.x = (event.clientX - rect.left) / rect.width * cfg.width;
      pointer.y = (event.clientY - rect.top) / rect.height * cfg.height;
      pointer.active = true;
    };
    canvas.addEventListener('pointermove', toArena);
    canvas.addEventListener('pointerdown', (event) => {
      toArena(event);
      pointer.down = true;
      pressed.add('PointerDown');
      PRISM.audio.unlock();
      canvas.setPointerCapture(event.pointerId);
    });
    window.addEventListener('pointerup', () => { pointer.down = false; });
  }

  // The movement direction the player is asking for, as a unit vector (or
  // the zero vector). Pointer glide wins while the mouse is held: steer
  // toward the pointer when it is more than a step away from the player.
  function moveVector(player) {
    let x = 0;
    let y = 0;
    if (held.has('ArrowLeft') || held.has('KeyA')) x -= 1;
    if (held.has('ArrowRight') || held.has('KeyD')) x += 1;
    if (held.has('ArrowUp') || held.has('KeyW')) y -= 1;
    if (held.has('ArrowDown') || held.has('KeyS')) y += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    if (pointer.down && player) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) return { x: dx / dist, y: dy / dist };
    }
    return { x: 0, y: 0 };
  }

  function wasPressed(code) { return pressed.has(code); }

  function anyStartPressed() {
    return pressed.has('Enter') || pressed.has('Space') || pressed.has('PointerDown');
  }

  function dashPressed() {
    return pressed.has('Space') || pressed.has('ShiftLeft') || pressed.has('ShiftRight');
  }

  // Called by the game loop at the end of every frame.
  function endFrame() { pressed.clear(); }

  return { attach, moveVector, wasPressed, anyStartPressed, dashPressed, endFrame, pointer };
})();
