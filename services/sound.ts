let audioCtx: AudioContext | null = null;

export const playStoneSound = () => {
  try {
    // Initialize AudioContext on first user interaction
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const t = audioCtx.currentTime;

    // 1. The "Snap" (High frequency impact click)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    
    osc1.type = 'square';
    // Start high, drop fast
    osc1.frequency.setValueAtTime(2000, t); 
    osc1.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start(t);
    osc1.stop(t + 0.06);

    // 2. The "Thud" (Board resonance)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(350, t);
    osc2.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    
    gain2.gain.setValueAtTime(0.5, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc2.start(t);
    osc2.stop(t + 0.16);

  } catch (e) {
    console.warn("Audio playback failed", e);
  }
};