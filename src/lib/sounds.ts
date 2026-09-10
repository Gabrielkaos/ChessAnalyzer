'use client';

class SoundManager {
  private enabled: boolean = true;
  private audioCtx: AudioContext | null = null;
  private audioCache: Record<string, HTMLAudioElement[]> = {};

  private soundMap: Record<string, string> = {
    move: '/sounds/moves_sound.mp3',
    capture: '/sounds/captured_sound.mp3',
    castle: '/sounds/castle_sound.mp3',
    gameStart: '/sounds/game_start_chess.mp3.mp3',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chess_sound_enabled');
      if (saved !== null) {
        this.enabled = saved !== 'false';
      }
      this.initUnlockListeners();
      this.preloadSounds();
    }
  }

  private preloadSounds() {
    if (typeof window === 'undefined') return;
    Object.values(this.soundMap).forEach((src) => {
      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.load();
      } catch {}
    });
  }

  private initUnlockListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  public unlock() {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('chess_sound_enabled', String(this.enabled));
    }
    if (this.enabled) {
      this.play('move');
    }
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('chess_sound_enabled', String(this.enabled));
    }
  }

  public play(type: 'move' | 'capture' | 'castle' | 'check' | 'gameStart' | 'brilliant') {
    if (!this.enabled || typeof window === 'undefined') return;

    this.unlock();

    if (type === 'brilliant') {
      this.playSynthBrilliant();
      return;
    }

    if (type === 'check') {
      this.playSynthCheck();
      return;
    }

    const src = this.soundMap[type];
    if (src) {
      try {
        const audio = new Audio(src);
        audio.volume = 0.85;
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {
            // If browser blocks audio file playback, fall back to Web Audio synth
            this.playSynth(type);
          });
        }
      } catch {
        this.playSynth(type);
      }
    } else {
      this.playSynth(type);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private playSynth(type: 'move' | 'capture' | 'castle' | 'gameStart') {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'gameStart') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      // castle
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  private playSynthCheck() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.22);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  private playSynthBrilliant() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Harmonious chord chime
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);

      const startTime = now + idx * 0.05;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }
}

export const soundManager = new SoundManager();

