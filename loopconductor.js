class LoopConductor {
  constructor(bars, bpm, notes, basePitch, lfoPitch, lfoPan, lfoVolume, masterVol, lineWidth, lineColor) {
    this.bars = bars;
    this.bpm = bpm;
    this.notes = notes.split(/[ ,\-]+/);
    this.basePitch = basePitch;
    this.lfoPitch = lfoPitch;
    this.lfoPan = lfoPan;
    this.lfoVolume = lfoVolume;
    this.masterVol = masterVol;
    this.lineWidth = lineWidth;
    this.lineColor = lineColor;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.masterVol;
    this.panner = this.audioCtx.createStereoPanner();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.masterGain.connect(this.panner).connect(this.analyser).connect(this.audioCtx.destination);
    this.isPlaying = false;
    this.intervalId = null;
    this.currentBeat = 0;

    this.setupOscilloscope();
  }

  noteToFreq(note) {
    const match = note.match(/^([A-Ga-g])(#|b)?(\d)$/);
    if (!match) return null;

    const [_, letter, accidental, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const noteBase = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let semitone = noteBase[letter.toUpperCase()];

    if (accidental === '#') semitone += 1;
    if (accidental === 'b') semitone -= 1;

    const midiNumber = (octave + 1) * 12 + semitone;
    const freq = this.basePitch * Math.pow(2, (midiNumber - 69) / 12);
    return freq;
  }

  getSecondsPerBeat() {
    return 60 / this.bpm;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const beats = parseInt(this.bars.split('/')[0]);
    const spb = this.getSecondsPerBeat();

    console.log(`▶ LoopConductor Pro started — ${this.bars} at ${this.bpm} BPM`);

    this.intervalId = setInterval(() => {
      const note = this.notes[this.currentBeat % this.notes.length];
      const freq = this.noteToFreq(note);

      if (!freq) {
        console.log(`Beat ${this.currentBeat + 1}: Rest or invalid note`);
      } else {
        console.log(`Beat ${this.currentBeat + 1}: ${note} (${freq.toFixed(2)} Hz)`);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const pan = this.audioCtx.createStereoPanner();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // LFO pitch modulation
        if (this.lfoPitch > 0) {
          const lfo = this.audioCtx.createOscillator();
          const lfoGain = this.audioCtx.createGain();
          lfoGain.gain.value = 5;
          lfo.frequency.value = this.lfoPitch;
          lfo.connect(lfoGain).connect(osc.frequency);
          lfo.start();
          lfo.stop(this.audioCtx.currentTime + spb);
        }

        // LFO volume modulation
        if (this.lfoVolume > 0) {
          const volLfo = this.audioCtx.createOscillator();
          const volLfoGain = this.audioCtx.createGain();
          volLfoGain.gain.value = 0.5;
          volLfo.frequency.value = this.lfoVolume;
          volLfo.connect(volLfoGain).connect(gain.gain);
          volLfo.start();
          volLfo.stop(this.audioCtx.currentTime + spb);
        }

        // LFO pan modulation
        if (this.lfoPan > 0) {
          const panLfo = this.audioCtx.createOscillator();
          const panLfoGain = this.audioCtx.createGain();
          panLfoGain.gain.value = 1;
          panLfo.frequency.value = this.lfoPan;
          panLfo.connect(panLfoGain).connect(pan.pan);
          panLfo.start();
          panLfo.stop(this.audioCtx.currentTime + spb);
        }

        // Envelope smoothing
        const now = this.audioCtx.currentTime;
        const duration = spb * 0.9;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.setValueAtTime(0.2, now + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain).connect(pan).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);
      }

      this.currentBeat = (this.currentBeat + 1) % beats;
    }, spb * 1000);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.currentBeat = 0;
    console.log('⏹ LoopConductor Pro stopped');
  }

  setupOscilloscope() {
    const canvas = document.getElementById('oscilloscope');
    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = this.lineWidth;
      ctx.strokeStyle = this.lineColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }
}

export default LoopConductor;