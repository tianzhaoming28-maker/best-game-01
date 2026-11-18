// Prism Harvest — the things that live in the arena, and the director that
// spawns them.
//
// Entities are plain objects; game.js owns the world state and calls these
// updates once per fixed step. Nothing here touches the DOM or the canvas:
// render.js draws whatever state these functions leave behind.

'use strict';

PRISM.entities = (function () {
  const cfg = () => PRISM.config;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function clampToArena(e, radius) {
    const a = cfg().arena;
    e.x = Math.max(a.wall + radius, Math.min(a.width - a.wall - radius, e.x));
    e.y = Math.max(a.wall + radius, Math.min(a.height - a.wall - radius, e.y));
  }

  // ---- the player: a wisp of light the player steers ---------------------

  function makePlayer() {
    const a = cfg().arena;
    return {
      kind: 'player',
      x: a.width / 2, y: a.height / 2,
      vx: 0, vy: 0,
      radius: cfg().player.radius,
      facing: -Math.PI / 2,
      dashTimeLeft: 0,
      dashCooldownLeft: 0,
      invulnTimeLeft: 0,
      alive: true,
    };
  }

  function updatePlayer(p, dt, input) {
    const pc = cfg().player;
    if (p.dashCooldownLeft > 0) p.dashCooldownLeft -= dt;
    if (p.invulnTimeLeft > 0) p.invulnTimeLeft -= dt;

    const move = input.moveVector(p);
    const dashing = p.dashTimeLeft > 0;

    if (dashing) {
      // A dash holds its line: full speed along the dash direction.
      p.dashTimeLeft -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (move.x !== 0 || move.y !== 0) {
      p.vx += move.x * pc.accel * dt;
      p.vy += move.y * pc.accel * dt;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > pc.maxSpeed) {
        p.vx = p.vx / speed * pc.maxSpeed;
        p.vy = p.vy / speed * pc.maxSpeed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.facing = Math.atan2(p.vy, p.vx);
    } else {
      const decay = Math.exp(-pc.friction * dt);
      p.vx *= decay;
      p.vy *= decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.hypot(p.vx, p.vy) > 4) p.facing = Math.atan2(p.vy, p.vx);
    }
    clampToArena(p, p.radius);
    return dashing;
  }

  // Start a dash along the current motion (or the facing, standing still).
  function tryDash(p, input) {
    const pc = cfg().player;
    if (p.dashCooldownLeft > 0 || p.dashTimeLeft > 0 || !p.alive) return false;
    const move = input.moveVector(p);
    let dx = move.x;
    let dy = move.y;
    if (dx === 0 && dy === 0) {
      if (Math.hypot(p.vx, p.vy) > 10) {
        const s = Math.hypot(p.vx, p.vy);
        dx = p.vx / s; dy = p.vy / s;
      } else {
        dx = Math.cos(p.facing); dy = Math.sin(p.facing);
      }
    }
    p.vx = dx * pc.dashSpeed;
    p.vy = dy * pc.dashSpeed;
    p.dashTimeLeft = pc.dashTime;
    p.dashCooldownLeft = pc.dashCooldown;
    p.facing = Math.atan2(dy, dx);
    return true;
  }

  // ---- motes: the light you harvest --------------------------------------

  function makeMote(golden) {
    const a = cfg().arena;
    const gc = cfg().golden;
    const mc = cfg().mote;
    return {
      kind: golden ? 'golden' : 'mote',
      x: rand(a.wall + 40, a.width - a.wall - 40),
      y: rand(a.wall + 40, a.height - a.wall - 40),
      radius: golden ? gc.radius : mc.radius,
      age: 0,
      lifetime: golden ? gc.lifetime : mc.lifetime,
      seed: Math.random() * Math.PI * 2,
    };
  }

  // ---- sentries: the shadows that hunt you --------------------------------

  function makeSentry(heat) {
    const a = cfg().arena;
    const sc = cfg().sentry;
    // Enter from a random point along the walls, away from the corners.
    const side = Math.floor(Math.random() * 4);
    const m = sc.spawnEdgeMargin;
    let x = a.wall;
    let y = a.wall;
    if (side === 0) { x = rand(m, a.width - m); y = a.wall + 6; }
    if (side === 1) { x = rand(m, a.width - m); y = a.height - a.wall - 6; }
    if (side === 2) { x = a.wall + 6; y = rand(m, a.height - m); }
    if (side === 3) { x = a.width - a.wall - 6; y = rand(m, a.height - m); }
    return {
      kind: 'sentry',
      x, y,
      vx: 0, vy: 0,
      radius: sc.radius,
      speed: sc.speedStart + (sc.speedEnd - sc.speedStart) * heat,
      wobbleSeed: Math.random() * Math.PI * 2,
      age: 0,
    };
  }

  // Sentries steer toward the player with a limited turn rate, plus a slow
  // sine wobble so their paths curve and feel hunted rather than robotic.
  function updateSentry(s, dt, player, time) {
    const sc = cfg().sentry;
    s.age += dt;
    const want = Math.atan2(player.y - s.y, player.x - s.x)
      + Math.sin(time * 1.7 + s.wobbleSeed) * 0.35;
    const now = Math.atan2(s.vy, s.vx);
    let diff = want - now;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = sc.turnRate * dt;
    const angle = Math.hypot(s.vx, s.vy) < 1
      ? want
      : now + Math.max(-maxTurn, Math.min(maxTurn, diff));
    s.vx = Math.cos(angle) * s.speed;
    s.vy = Math.sin(angle) * s.speed;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    clampToArena(s, s.radius);
  }

  // ---- particles and floating score text ----------------------------------

  function burst(list, x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.3, speed);
      list.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        life: rand(life * 0.5, life),
        size: rand(size * 0.5, size),
        color,
      });
    }
  }

  function updateParticles(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      p.vx *= Math.exp(-2.2 * dt);
      p.vy *= Math.exp(-2.2 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function floatText(list, x, y, text, color) {
    list.push({ x, y, text, color, age: 0, life: 0.9 });
  }

  function updateFloaters(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.age += dt;
      f.y -= 42 * dt;
      if (f.age >= f.life) list.splice(i, 1);
    }
  }

  // ---- the director: what spawns, and how the pressure grows --------------

  // Heat runs 0..1 across the run's heatTime; it tightens sentry spawns and
  // quickens their chase, so a long run keeps getting more dangerous.
  function heatAt(elapsed) {
    return Math.min(1, elapsed / cfg().sentry.heatTime);
  }

  function sentrySpawnInterval(heat) {
    const sc = cfg().sentry;
    return sc.spawnEveryStart + (sc.spawnEveryEnd - sc.spawnEveryStart) * heat;
  }

  function sentryCap(score) {
    const sc = cfg().sentry;
    return Math.min(sc.maxAliveCap, sc.maxAliveBase + Math.floor(score / sc.maxAlivePer));
  }

  return {
    rand, clampToArena,
    makePlayer, updatePlayer, tryDash,
    makeMote, makeSentry, updateSentry,
    burst, updateParticles, floatText, updateFloaters,
    heatAt, sentrySpawnInterval, sentryCap,
  };
})();
