// Prism Harvest — everything the player sees.
//
// One draw() per animation frame: the night arena with its starfield and
// grid, the motes and sentries and the wisp, particles and floating score
// text, then the HUD, then whichever screen the state machine is showing
// (title, pause, harvest complete, game over). All of it is canvas vector
// work in the game's palette — no image assets anywhere.

'use strict';

PRISM.render = (function () {
  const C = () => PRISM.config.colors;
  const A = () => PRISM.config.arena;

  // A fixed starfield, rolled once, so the night sky does not shimmer.
  const stars = [];
  (function rollStars() {
    let seed = 1234567;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 110; i++) {
      stars.push({ x: next(), y: next(), r: 0.6 + next() * 1.4, tw: next() * Math.PI * 2 });
    }
  })();

  function drawBackground(ctx, time) {
    const a = A();
    const c = C();
    const grad = ctx.createLinearGradient(0, 0, 0, a.height);
    grad.addColorStop(0, c.nightTop);
    grad.addColorStop(1, c.nightBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, a.width, a.height);

    // Stars, gently twinkling.
    ctx.fillStyle = c.star;
    for (const s of stars) {
      const alpha = 0.35 + 0.3 * Math.sin(time * 0.8 + s.tw);
      ctx.globalAlpha = Math.max(0.08, alpha);
      ctx.beginPath();
      ctx.arc(s.x * a.width, s.y * a.height, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The arena floor: a soft grid inside glowing walls.
    ctx.strokeStyle = c.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = a.wall + 40; x < a.width - a.wall; x += 40) {
      ctx.moveTo(x, a.wall);
      ctx.lineTo(x, a.height - a.wall);
    }
    for (let y = a.wall + 40; y < a.height - a.wall; y += 40) {
      ctx.moveTo(a.wall, y);
      ctx.lineTo(a.width - a.wall, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(137, 124, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(137, 124, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.strokeRect(a.wall, a.wall, a.width - a.wall * 2, a.height - a.wall * 2);
    ctx.shadowBlur = 0;
  }

  function drawMote(ctx, m, time) {
    const c = C();
    const golden = m.kind === 'golden';
    const pulse = 1 + 0.16 * Math.sin(time * 4 + m.seed);
    const fading = m.age > m.lifetime - 2.5;
    if (fading && Math.sin(time * 14) > 0.2) return; // blink before fading
    const r = m.radius * pulse;
    ctx.save();
    ctx.shadowColor = golden ? c.golden : c.mote;
    ctx.shadowBlur = golden ? 26 : 16;
    ctx.fillStyle = golden ? c.golden : c.mote;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = golden ? c.goldenCore : c.moteCore;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (golden) {
      // A slow halo ring marks the prize apart from ordinary motes.
      ctx.strokeStyle = 'rgba(255, 210, 87, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r + 6 + 2 * Math.sin(time * 3 + m.seed), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSentry(ctx, s, time) {
    const c = C();
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.atan2(s.vy, s.vx));
    // A jagged shard of shadow with a single watching eye.
    ctx.shadowColor = c.sentry;
    ctx.shadowBlur = 16;
    ctx.fillStyle = c.sentry;
    ctx.beginPath();
    const r = s.radius;
    const wob = 1 + 0.06 * Math.sin(time * 6 + s.wobbleSeed);
    ctx.moveTo(r * 1.25 * wob, 0);
    ctx.lineTo(-r * 0.4, r * 0.95);
    ctx.lineTo(-r * 1.05, r * 0.3);
    ctx.lineTo(-r * 0.75, 0);
    ctx.lineTo(-r * 1.05, -r * 0.3);
    ctx.lineTo(-r * 0.4, -r * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = c.sentryCore;
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.sentryEye;
    ctx.beginPath();
    ctx.arc(r * 0.28, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(ctx, p, time) {
    const c = C();
    // Blinking while invulnerable tells the player they are safe — for now.
    if (p.invulnTimeLeft > 0 && p.dashTimeLeft <= 0 && Math.sin(time * 18) > 0.3) {
      // draw faint only
      ctx.globalAlpha = 0.35;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.shadowColor = c.player;
    ctx.shadowBlur = 22;
    ctx.fillStyle = c.player;
    ctx.beginPath();
    // A teardrop wisp, nose along the facing.
    const r = p.radius;
    ctx.moveTo(r * 1.35, 0);
    ctx.quadraticCurveTo(r * 0.2, r * 0.95, -r * 0.9, r * 0.55);
    ctx.quadraticCurveTo(-r * 1.25, 0, -r * 0.9, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.2, -r * 0.95, r * 1.35, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = c.playerCore;
    ctx.beginPath();
    ctx.arc(r * 0.25, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles(ctx, list) {
    for (const p of list) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(ctx, list) {
    ctx.textAlign = 'center';
    ctx.font = '600 17px "Avenir Next", "Segoe UI", sans-serif';
    for (const f of list) {
      const t = 1 - f.age / f.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the HUD -------------------------------------------------------------

  function drawHeart(ctx, x, y, size, filled) {
    const c = C();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 10, size / 10);
    ctx.beginPath();
    ctx.moveTo(0, 3.2);
    ctx.bezierCurveTo(-6.5, -2.4, -3.4, -7.6, 0, -3.6);
    ctx.bezierCurveTo(3.4, -7.6, 6.5, -2.4, 0, 3.2);
    ctx.closePath();
    if (filled) {
      ctx.shadowColor = c.sentry;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff6d94';
    } else {
      ctx.fillStyle = 'rgba(255, 109, 148, 0.18)';
    }
    ctx.fill();
    ctx.restore();
  }

  function drawHud(ctx, w) {
    const c = C();
    const cfg = PRISM.config;
    ctx.save();
    ctx.textBaseline = 'middle';

    // Score, top left, with the harvest goal as a progress bar under it.
    ctx.textAlign = 'left';
    ctx.font = '700 25px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = c.ink;
    ctx.fillText(String(w.score), 44, 52);
    ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = c.dimInk;
    ctx.fillText('SCORE', 44, 32);
    const goalW = 170;
    ctx.fillStyle = 'rgba(137, 124, 255, 0.25)';
    ctx.fillRect(44, 68, goalW, 5);
    ctx.fillStyle = c.player;
    ctx.fillRect(44, 68, goalW * Math.min(1, w.score / cfg.goalScore), 5);
    ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('GOAL ' + cfg.goalScore, 44 + goalW + 10, 71);

    // Combo, top centre: the multiplier and its draining window.
    if (w.multiplier > 1 || w.combo > 0) {
      ctx.textAlign = 'center';
      ctx.font = '700 24px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = w.multiplier >= 4 ? c.golden : c.mote;
      ctx.fillText('x' + w.multiplier, A().width / 2, 46);
      const cw = 120;
      ctx.fillStyle = 'rgba(139, 233, 255, 0.22)';
      ctx.fillRect(A().width / 2 - cw / 2, 62, cw, 4);
      ctx.fillStyle = c.mote;
      ctx.fillRect(A().width / 2 - cw / 2, 62, cw * Math.max(0, w.comboTimeLeft / cfg.mote.comboWindow), 4);
      ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = c.dimInk;
      ctx.fillText('COMBO ' + w.combo, A().width / 2, 78);
    }

    // Lives, top right, as hearts; the dash pip sits under them.
    for (let i = 0; i < cfg.startLives; i++) {
      drawHeart(ctx, A().width - 52 - i * 30, 44, 19, i < w.lives);
    }
    const pc = cfg.player;
    const ready = w.player.dashCooldownLeft <= 0;
    ctx.textAlign = 'right';
    ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = ready ? c.player : c.dimInk;
    const label = ready ? 'DASH READY' : 'DASH ' + Math.ceil(w.player.dashCooldownLeft * 10) / 10 + 's';
    ctx.fillText(label, A().width - 44, 71);
    if (!ready) {
      const dw = 74;
      ctx.fillStyle = 'rgba(89, 242, 214, 0.2)';
      ctx.fillRect(A().width - 44 - dw, 80, dw, 3);
      ctx.fillStyle = c.player;
      ctx.fillRect(A().width - 44 - dw, 80, dw * (1 - w.player.dashCooldownLeft / pc.dashCooldown), 3);
    }
    ctx.restore();
  }

  // ---- screens ---------------------------------------------------------------

  function panel(ctx, title, titleColor, lines, footer) {
    const a = A();
    const c = C();
    ctx.save();
    ctx.fillStyle = c.panel;
    ctx.strokeStyle = c.panelEdge;
    ctx.lineWidth = 1.5;
    const pw = 560;
    const ph = 330;
    const px = (a.width - pw) / 2;
    const py = (a.height - ph) / 2;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 24;
    ctx.fillStyle = titleColor;
    ctx.font = '800 52px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(title, a.width / 2, py + 78);
    ctx.shadowBlur = 0;

    ctx.font = '400 17px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = c.ink;
    lines.forEach((line, i) => {
      ctx.fillText(line, a.width / 2, py + 128 + i * 27);
    });

    if (footer) {
      ctx.font = '600 15px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = c.player;
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 280);
      ctx.globalAlpha = pulse;
      ctx.fillText(footer, a.width / 2, py + ph - 34);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawTitle(ctx, w) {
    const c = C();
    panel(ctx, 'PRISM HARVEST', c.player, [
      'Gather the falling light. Dodge the shade sentries.',
      'Chain motes to raise your multiplier — reach ' + PRISM.config.goalScore + ' to win.',
      '',
      'Move  WASD / arrows / hold mouse      Dash  SPACE',
      'A golden mote blasts every sentry near it.',
      w.best > 0 ? 'Best harvest so far: ' + w.best : '',
    ], 'Press ENTER or click to begin');
  }

  function drawPaused(ctx) {
    panel(ctx, 'PAUSED', C().ink, ['The light waits for you.'], 'Press P to resume');
  }

  function drawEnd(ctx, w) {
    const c = C();
    const won = w.state === 'won';
    const lines = [
      won ? 'The grove is lit. You gathered enough light.' : 'The shadows kept the grove dark this time.',
      '',
      'Score  ' + w.score + '      Best  ' + w.best,
      'Motes gathered  ' + w.stats.collected + '      Sentries banished  ' + w.stats.banished,
      'Time  ' + Math.floor(w.elapsed / 60) + ':' + String(Math.floor(w.elapsed % 60)).padStart(2, '0'),
    ];
    panel(ctx, won ? 'HARVEST COMPLETE' : 'GAME OVER', won ? c.golden : c.danger, lines, 'Press ENTER to play again');
  }

  // The frame: world first (shifted by any screen shake), then HUD, then
  // whichever screen the state calls for.
  function draw(ctx, w, time) {
    ctx.save();
    if (w.shake > 0) {
      ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
    }
    drawBackground(ctx, time);
    for (const m of w.motes) drawMote(ctx, m, time);
    if (w.goldenMote) drawMote(ctx, w.goldenMote, time);
    for (const s of w.sentries) drawSentry(ctx, s, time);
    drawParticles(ctx, w.particles);
    if (w.player.alive) drawPlayer(ctx, w.player, time);
    drawFloaters(ctx, w.floaters);
    ctx.restore();

    if (w.state !== 'title') drawHud(ctx, w);
    if (w.state === 'title') drawTitle(ctx, w);
    if (w.state === 'paused') drawPaused(ctx);
    if (w.state === 'won' || w.state === 'lost') drawEnd(ctx, w);
  }

  return { draw };
})();
