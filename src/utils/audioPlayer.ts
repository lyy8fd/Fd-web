/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type Listener = (isPlaying: boolean, volume: number) => void;

class MusicEngine {
  private isPlaying = false;
  private volume = 0.5;
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private synthInterval: number | null = null;
  private gainNode: GainNode | null = null;
  private listeners: Set<Listener> = new Set();
  public trackTitle = 'Michael Jackson - Chicago';
  private customAudioUrl: string | null = '/audio/chicago.mp3';

  constructor() {
    // Initialized on user interaction or mount
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.isPlaying, this.volume));
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.isPlaying, this.volume);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume * 0.25, this.audioCtx.currentTime);
    }
    this.notify();
  }

  public async start(): Promise<void> {
    if (this.isPlaying) return;

    if (this.customAudioUrl) {
      this.playHtmlAudio(this.customAudioUrl);
      return;
    }

    // Default: Start Ambient Lo-Fi Synth ("Those Eyes" harmonic progression)
    this.startSynth();
  }

  public toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.start();
    }
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.audioEl) {
      this.audioEl.pause();
    }

    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }

    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }

    this.notify();
  }

  public setCustomAudio(url: string | null, title?: string) {
    if (url) {
      this.customAudioUrl = url;
      this.trackTitle = title || 'Custom Track';
    } else {
      this.customAudioUrl = '/audio/chicago.mp3';
      this.trackTitle = 'Michael Jackson - Chicago';
    }

    if (this.isPlaying) {
      this.pause();
      this.playHtmlAudio(this.customAudioUrl);
    }
    this.notify();
  }

  private playHtmlAudio(url: string) {
    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.audioCtx) {
      this.audioCtx.suspend();
    }

    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.crossOrigin = 'anonymous';
    }

    this.audioEl.src = url;
    this.audioEl.volume = this.volume;
    this.audioEl
      .play()
      .then(() => {
        this.isPlaying = true;
        this.notify();
      })
      .catch(() => {
        this.isPlaying = false;
        this.notify();
      });
  }

  private initAudioCtx() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume * 0.25, this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);
    } else if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playNote(freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', decay = 1.2) {
    if (!this.audioCtx || !this.gainNode) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const noteGain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * decay);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);

      osc.start(startTime);
      osc.stop(startTime + duration * decay + 0.1);
    } catch {
      // AudioContext state guard
    }
  }

  private startSynth() {
    this.initAudioCtx();
    if (!this.audioCtx) return;

    this.isPlaying = true;
    this.notify();

    // Harmonic progression inspired by "Those Eyes" - soft, dreamy, nostalgic chords
    // Key of E Major / C# minor: E -> G#m -> A -> B / C#m
    const chordProgressions = [
      // Chord 1: E Maj (E3, G#3, B3, E4)
      [164.81, 207.65, 246.94, 329.63],
      // Chord 2: G# min (D#3, G#3, B3, D#4)
      [155.56, 207.65, 246.94, 311.13],
      // Chord 3: A Maj (A2, C#3, E3, A3, C#4)
      [110.00, 138.59, 164.81, 220.00, 277.18],
      // Chord 4: B Maj (B2, D#3, F#3, B3, D#4)
      [123.47, 155.56, 185.00, 246.94, 311.13],
      // Chord 5: C# min (C#3, E3, G#3, C#4, E4)
      [138.59, 164.81, 207.65, 277.18, 329.63],
      // Chord 6: B Maj (B2, F#3, B3, D#4)
      [123.47, 185.00, 246.94, 311.13],
      // Chord 7: A Maj9 (A2, E3, G#3, B3, C#4)
      [110.00, 164.81, 207.65, 246.94, 277.18],
      // Chord 8: E add9 (E2, B2, E3, F#3, G#3)
      [82.41, 123.47, 164.81, 185.00, 207.65],
    ];

    let chordIndex = 0;
    const playChordStep = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const chord = chordProgressions[chordIndex % chordProgressions.length];

      // Arpeggiate chord notes with warm sine and triangle waves
      chord.forEach((freq, i) => {
        this.playNote(freq, now + i * 0.12, 3.2, i === 0 ? 'triangle' : 'sine', 1.4);
      });

      // Add gentle bell melody tone on top
      const melodyFreqs = [440, 493.88, 554.37, 659.25, 493.88, 440];
      const melodyNote = melodyFreqs[chordIndex % melodyFreqs.length];
      this.playNote(melodyNote, now + 0.36, 1.8, 'sine', 1.8);

      chordIndex++;
    };

    playChordStep();
    this.synthInterval = window.setInterval(playChordStep, 2800);
  }
}

export const musicEngine = new MusicEngine();
