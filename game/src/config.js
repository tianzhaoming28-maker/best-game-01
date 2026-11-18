// Prism Harvest — tuning and palette.
//
// Every number that shapes how the game feels lives here, so the rest of the
// code reads as rules rather than magic constants. The arena is a fixed
// logical field of 960 x 600; render.js scales it to the canvas.

'use strict';

window.PRISM = window.PRISM || {};

PRISM.config = {
  // The field of play, in logical pixels.
  arena: { width: 960, height: 600, wall: 26 },

  // The harvest: reach the goal score to win the run.
  goalScore: 1500,
  startLives: 3,

  player: {
    radius: 14,
    accel: 2700,          // px per second^2 when a direction is held
    maxSpeed: 335,        // px per second, gliding
    friction: 5.2,        // velocity decay rate when no direction is held
    dashSpeed: 940,       // px per second during a dash
    dashTime: 0.16,       // seconds a dash lasts
    dashCooldown: 1.5,    // seconds before the next dash
    hurtInvulnTime: 2.0,  // seconds of grace after losing a life
  },

  mote: {
    radius: 9,
    value: 10,
    spawnEvery: 0.55,     // seconds between spawn attempts
    maxOnField: 7,
    lifetime: 12,         // seconds before a mote fades away
    comboWindow: 2.6,     // seconds to keep a combo alive
    comboStep: 4,         // motes per multiplier step
    maxMultiplier: 8,
  },

  golden: {
    radius: 12,
    value: 150,
    everyMin: 15,         // a golden mote appears every 15..22 seconds
    everyMax: 22,
    lifetime: 7,
    blastRadius: 150,     // its shockwave banishes sentries inside this ring
    blastValue: 25,       // points per banished sentry
  },

  sentry: {
    radius: 15,
    spawnFirst: 1.4,      // seconds into the run before the first sentry
    spawnEveryStart: 2.7, // spawn interval at the start of a run
    spawnEveryEnd: 0.95,  // spawn interval once the run is fully heated
    heatTime: 95,         // seconds for the spawn interval to tighten fully
    speedStart: 96,       // chase speed at the start of a run
    speedEnd: 172,        // chase speed once fully heated
    turnRate: 3.4,        // radians per second a sentry can steer
    maxAliveBase: 4,      // sentries allowed before score adds more
    maxAlivePer: 260,     // +1 allowed sentry per this many points
    maxAliveCap: 10,
    spawnEdgeMargin: 44,  // sentries enter at the walls, this far from corners
  },

  // The palette: deep indigo night, cyan light, magenta shadow, gold prize.
  colors: {
    nightTop: '#171233',
    nightBottom: '#080614',
    gridLine: 'rgba(126, 110, 255, 0.07)',
    star: 'rgba(220, 214, 255, 0.5)',
    player: '#59f2d6',
    playerCore: '#eafffa',
    mote: '#8be9ff',
    moteCore: '#ffffff',
    golden: '#ffd257',
    goldenCore: '#fff6d8',
    sentry: '#ff4d7e',
    sentryCore: '#2a0a18',
    sentryEye: '#ffb3c8',
    ink: '#efeaff',
    dimInk: '#9a92c4',
    danger: '#ff5d5d',
    panel: 'rgba(10, 8, 26, 0.72)',
    panelEdge: 'rgba(137, 124, 255, 0.45)',
  },
};
