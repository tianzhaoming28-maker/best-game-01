// Prism Harvest — sound, synthesized live with WebAudio.
//
// There are no audio files: every sound is a small oscillator phrase shaped
// by an envelope, so the game stays a handful of static files and still
// answers every action with a voice. The context is created lazily on the
// first user gesture, as browsers require, and M toggles a master mute.

'use strict';

PRISM.audio = (function () {
  let ctx = null;
  let master = null;
  let muted = false;

  // Create the context on the first gesture that reaches us (a key press or
  // a click on the canvas); until then every call is a silent no-op.
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  // One shaped tone: a frequency glide with an attack/decay envelope.
  function tone(freqFrom, freqTo, seconds, type, volume, when) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(Math.max(30, freqFrom), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume || 0.2, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  // A short noise burst through a bandpass, for dashes and impacts.
  function noise(seconds, filterFreq, volume, when) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock: ensure,

    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    isMuted() { return muted; },

    // Collecting a mote: a bright pluck that climbs with the combo, so a
    // long chain literally sounds higher and happier.
    collect(combo) {
      const step = Math.min(combo, 16);
      const base = 520 * Math.pow(2, step / 12);
      tone(base, base * 1.5, 0.11, 'triangle', 0.22);
      tone(base * 2, base * 2.4, 0.07, 'sine', 0.08, 0.015);
    },

    golden() {
      tone(880, 880, 0.09, 'triangle', 0.2);
      tone(1174, 1174, 0.09, 'triangle', 0.2, 0.07);
      tone(1568, 1760, 0.16, 'triangle', 0.22, 0.14);
      noise(0.25, 2400, 0.1, 0.05);
    },

    dash() { noise(0.16, 1500, 0.16); tone(300, 720, 0.14, 'sawtooth', 0.05); },

    banish() { tone(1200, 240, 0.18, 'square', 0.1); noise(0.12, 900, 0.12); },

    hurt() {
      tone(220, 55, 0.32, 'sawtooth', 0.26);
      noise(0.28, 300, 0.24);
    },

    uiStart() {
      tone(523, 523, 0.08, 'triangle', 0.16);
      tone(784, 784, 0.12, 'triangle', 0.16, 0.07);
    },

    win() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.2, i * 0.11));
    },

    lose() {
      const notes = [392, 330, 262, 196];
      notes.forEach((f, i) => tone(f, f * 0.94, 0.26, 'triangle', 0.18, i * 0.13));
    },
  };
})();
