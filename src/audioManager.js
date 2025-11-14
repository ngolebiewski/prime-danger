// audioManager.js
export class AudioManager {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0; // start muted
        this.masterGain.connect(this.audioCtx.destination);

        // echo / delay loop (pseudo-reverb)
        this.delay = this.audioCtx.createDelay(5.0);
        this.delay.delayTime.value = 0.35;
        this.delayGain = this.audioCtx.createGain();
        this.delayGain.gain.value = 0.1;
        this.delay.connect(this.delayGain).connect(this.delay); // feedback
        this.delay.connect(this.masterGain);

        this.isPlaying = false;
        this.loopId = null;
    }

    // ---------------- Drums ----------------
    playDrum(time, type = 'low') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';

        if (type === 'low') {
            osc.frequency.setValueAtTime(60, time);
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        } else {
            osc.frequency.setValueAtTime(200, time);
            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        }

        osc.connect(gain).connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.3);
    }

    // ---------------- Metallic clang ----------------
    playClang(time) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        osc.connect(filter).connect(gain).connect(this.masterGain);
        osc.connect(filter).connect(gain).connect(this.delay);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    // ---------------- Dissonant arpeggio ----------------
    playArpeggio(time) {
        const notes = [110, 130, 155, 185, 220, 260];
        const note = notes[Math.floor(Math.random() * notes.length)];

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000 + Math.random() * 400;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note, time);
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        osc.connect(filter).connect(gain).connect(this.masterGain);
        osc.connect(filter).connect(gain).connect(this.delay);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    // ---------------- Synth Chord Hit ----------------
    playChordHit(time) {
        const chords = [
            [220, 261.63, 329.63], // A C E
            [261.63, 329.63, 440], // C E A
            [277.18, 329.63, 440], // C# E A
            [370, 440, 523.25],    // F# A C
        ];
        const chord = chords[Math.floor(Math.random() * chords.length)];

        const chordGain = this.audioCtx.createGain();
        chordGain.gain.setValueAtTime(0.001, time);
        chordGain.gain.linearRampToValueAtTime(0.1, time + 0.1);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, time + 3);
        chordGain.connect(this.masterGain);
        chordGain.connect(this.delay);

        chord.forEach(freq => {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq + (Math.random() * 2 - 1), time);
            osc.connect(chordGain);
            osc.start(time);
            osc.stop(time + 3.5);
        });
    }

    // ---------------- Sequencer ----------------
    schedule() {
        const now = this.audioCtx.currentTime;
        const bpm = 80;
        const interval = 60 / bpm;

        // 16 beats = 4 measures
        for (let i = 0; i < 16; i++) {
            const time = now + i * interval;

            if (i % 4 === 0) this.playDrum(time, 'low');
            if (i % 2 === 0) this.playDrum(time, 'high');
            if (Math.random() < 0.3) this.playClang(time);
            if (Math.random() < 0.6) this.playArpeggio(time);

            // every first beat of each 4-measure loop (~every 16 beats)
            if (i === 0) this.playChordHit(time);
        }

        // loop every 16 beats
        this.loopId = setTimeout(() => this.schedule(), interval * 16 * 1000);
    }

    // ---------------- Public controls ----------------
    start() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.fadeIn(2);
            this.schedule();
        }
    }

    stop() {
        this.fadeOut(2);
        clearTimeout(this.loopId);
        this.loopId = null;
        this.isPlaying = false;
    }

    fadeIn(duration = 2) {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.1, now + duration);
    }

    fadeOut(duration = 2) {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + duration);
    }
}
