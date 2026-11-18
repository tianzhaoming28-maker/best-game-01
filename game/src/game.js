// Prism Harvest — the game itself: state machine, rules, and the main loop.
//
// States: title -> playing <-> paused -> won | lost -> (restart) -> playing.
// The loop runs the simulation in fixed steps so play feels the same on any
// display, and render.js draws whatever the last step left behind.

'use strict';

(function () {
  const E = PRISM.entities;
  const cfg = PRISM.config;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Crisp lines on retina displays without paying for more than 1.5x.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = cfg.arena.width * dpr;
  canvas.height = cfg.arena.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  PRISM.input.attach(canvas);

  function loadBest() {
    try { return Number(localStorage.getItem('prism-harvest-best')) || 0; }
    catch (err) { return 0; }
  }

  function saveBest(value) {
    try { localStorage.setItem('prism-harvest-best', String(value)); }
    catch (err) { /* private mode: the best score just lives for the visit */ }
  }

  const world = {
    state: 'title',
    player: E.makePlayer(),
    motes: [],
    goldenMote: null,
    sentries: [],
    particles: [],
    floaters: [],
    score: 0,
    lives: cfg.startLives,
    combo: 0,
    comboTimeLeft: 0,
    multiplier: 1,
    elapsed: 0,
    best: loadBest(),
    shake: 0,
    stats: { collected: 0, banished: 0 },
    timers: { mote: 0, sentry: cfg.sentry.spawnFirst, golden: E.rand(cfg.golden.everyMin, cfg.golden.everyMax) },
  };

  function resetRun() {
    world.player = E.makePlayer();
    world.motes = [];
    world.goldenMote = null;
    world.sentries = [];
    world.particles = [];
    world.floaters = [];
    world.score = 0;
    world.lives = cfg.startLives;
    world.combo = 0;
    world.comboTimeLeft = 0;
    world.multiplier = 1;
    world.elapsed = 0;
    world.shake = 0;
    world.stats = { collected: 0, banished: 0 };
    world.timers = {
      mote: 0.2,
      sentry: cfg.sentry.spawnFirst,
      golden: E.rand(cfg.golden.everyMin, cfg.golden.everyMax),
    };
    // Two motes on the field from the first second: something to chase.
    world.motes.push(E.makeMote(false), E.makeMote(false));
  }

  function addScore(base, x, y, color) {
    const gained = base * world.multiplier;
    world.score += gained;
    E.floatText(world.floaters, x, y - 14, '+' + gained, color);
    if (world.score >= cfg.goalScore && world.state === 'playing') {
      finishRun(true);
    }
  }

  function finishRun(won) {
    world.state = won ? 'won' : 'lost';
    world.best = Math.max(world.best, world.score);
    saveBest(world.best);
    if (won) PRISM.audio.win(); else PRISM.audio.lose();
  }

  // ---- what happens in the arena -------------------------------------------

  function collectMote(mote, index) {
    world.motes.splice(index, 1);
    world.combo += 1;
    world.comboTimeLeft = cfg.mote.comboWindow;
    world.multiplier = 1 + Math.min(
      cfg.mote.maxMultiplier - 1,
      Math.floor(world.combo / cfg.mote.comboStep),
    );
    world.stats.collected += 1;
    E.burst(world.particles, mote.x, mote.y, cfg.colors.mote, 12, 190, 0.5, 3.2);
    addScore(cfg.mote.value, mote.x, mote.y, cfg.colors.mote);
    PRISM.audio.collect(world.combo);
  }

  function collectGolden(mote) {
    world.goldenMote = null;
    world.stats.collected += 1;
    E.burst(world.particles, mote.x, mote.y, cfg.colors.golden, 26, 260, 0.7, 3.6);
    addScore(cfg.golden.value, mote.x, mote.y, cfg.colors.golden);
    PRISM.audio.golden();
    // The shockwave: every sentry inside the ring is banished for points.
    const kept = [];
    for (const s of world.sentries) {
      const d = Math.hypot(s.x - mote.x, s.y - mote.y);
      if (d <= cfg.golden.blastRadius) {
        world.stats.banished += 1;
        E.burst(world.particles, s.x, s.y, cfg.colors.sentry, 14, 230, 0.55, 3.4);
        addScore(cfg.golden.blastValue, s.x, s.y, cfg.colors.golden);
        PRISM.audio.banish();
      } else {
        kept.push(s);
      }
    }
    world.sentries = kept;
    world.shake = Math.max(world.shake, 5);
  }

  function hurtPlayer() {
    const p = world.player;
    world.lives -= 1;
    world.combo = 0;
    world.comboTimeLeft = 0;
    world.multiplier = 1;
    world.shake = 15;
    E.burst(world.particles, p.x, p.y, cfg.colors.sentry, 30, 300, 0.8, 4);
    PRISM.audio.hurt();
    if (world.lives <= 0) {
      p.alive = false;
      finishRun(false);
      return;
    }
    p.invulnTimeLeft = cfg.player.hurtInvulnTime;
    // Give the player room to breathe: nearby sentries scatter to the walls.
    world.sentries = world.sentries.filter(
      (s) => Math.hypot(s.x - p.x, s.y - p.y) > 170,
    );
  }

  function overlaps(a, b, pad) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return d < a.radius + b.radius + (pad || 0);
  }

  function stepPlaying(dt) {
    const input = PRISM.input;
    const p = world.player;
    world.elapsed += dt;

    if (input.dashPressed() && E.tryDash(p, input)) {
      PRISM.audio.dash();
    }
    const dashing = E.updatePlayer(p, dt, input);
    if (dashing) {
      // A comet trail while the dash lasts.
      E.burst(world.particles, p.x, p.y, cfg.colors.player, 2, 40, 0.3, 3);
    }

    // Combo decay: let the window run out and the chain is gone.
    if (world.comboTimeLeft > 0) {
      world.comboTimeLeft -= dt;
      if (world.comboTimeLeft <= 0) {
        world.combo = 0;
        world.multiplier = 1;
      }
    }

    // Spawning, on the director's schedule.
    const heat = E.heatAt(world.elapsed);
    world.timers.mote -= dt;
    if (world.timers.mote <= 0) {
      world.timers.mote = cfg.mote.spawnEvery;
      if (world.motes.length < cfg.mote.maxOnField) world.motes.push(E.makeMote(false));
    }
    world.timers.golden -= dt;
    if (world.timers.golden <= 0) {
      world.timers.golden = E.rand(cfg.golden.everyMin, cfg.golden.everyMax);
      if (!world.goldenMote) world.goldenMote = E.makeMote(true);
    }
    world.timers.sentry -= dt;
    if (world.timers.sentry <= 0) {
      world.timers.sentry = E.sentrySpawnInterval(heat);
      if (world.sentries.length < E.sentryCap(world.score)) {
        world.sentries.push(E.makeSentry(heat));
      }
    }

    // Motes age out; the golden prize too.
    for (let i = world.motes.length - 1; i >= 0; i--) {
      world.motes[i].age += dt;
      if (world.motes[i].age >= world.motes[i].lifetime) world.motes.splice(i, 1);
    }
    if (world.goldenMote) {
      world.goldenMote.age += dt;
      if (world.goldenMote.age >= world.goldenMote.lifetime) world.goldenMote = null;
    }

    for (const s of world.sentries) E.updateSentry(s, dt, p, world.elapsed);
    E.updateParticles(world.particles, dt);
    E.updateFloaters(world.floaters, dt);
    if (world.shake > 0) world.shake = Math.max(0, world.shake - 60 * dt);

    // Collisions.
    for (let i = world.motes.length - 1; i >= 0; i--) {
      if (overlaps(p, world.motes[i], 2)) { collectMote(world.motes[i], i); break; }
    }
    if (world.goldenMote && overlaps(p, world.goldenMote, 2)) collectGolden(world.goldenMote);
    if (p.alive && p.invulnTimeLeft <= 0 && p.dashTimeLeft <= 0) {
      for (const s of world.sentries) {
        if (overlaps(p, s, -2)) { hurtPlayer(); break; }
      }
    }
  }

  // ---- the state machine ------------------------------------------------------

  function step(dt) {
    const input = PRISM.input;

    if (input.wasPressed('KeyM')) PRISM.audio.toggleMute();

    if (world.state === 'title') {
      // The arena idles behind the title: motes drift, nothing hunts.
      E.updateParticles(world.particles, dt);
      if (input.anyStartPressed()) {
        PRISM.audio.unlock();
        PRISM.audio.uiStart();
        resetRun();
        world.state = 'playing';
      }
    } else if (world.state === 'playing') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        world.state = 'paused';
      } else {
        stepPlaying(dt);
      }
    } else if (world.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.anyStartPressed()) {
        world.state = 'playing';
      }
    } else if (world.state === 'won' || world.state === 'lost') {
      E.updateParticles(world.particles, dt);
      E.updateFloaters(world.floaters, dt);
      if (input.wasPressed('Enter') || input.wasPressed('KeyR') || input.wasPressed('PointerDown')) {
        PRISM.audio.uiStart();
        resetRun();
        world.state = 'playing';
      }
    }

    input.endFrame();
  }

  // Fixed-step loop: simulate in 1/240 slices so motion is smooth and the
  // same on a 60 Hz or a 144 Hz display, then draw once per frame.
  let last = performance.now();
  let carry = 0;
  const STEP = 1 / 240;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // a stalled tab must not teleport the world
    carry += dt;
    while (carry >= STEP) {
      step(STEP);
      carry -= STEP;
    }
    PRISM.render.draw(ctx, world, now / 1000);
    requestAnimationFrame(frame);
  }

  // The world, reachable for debugging (and for the screenshot driver that
  // captures the game's own screens for the entry).
  PRISM.world = world;

  // A few motes behind the title screen, so the first thing a player sees
  // is already the game, lit and waiting.
  world.motes.push(E.makeMote(false), E.makeMote(false), E.makeMote(false));
  requestAnimationFrame(frame);
})();
