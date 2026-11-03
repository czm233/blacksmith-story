class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // 铁锤敲击砧板声 (支持音高随机微调，产生错落有致的叮当节奏)
  public playHammerHit(isPerfect: boolean = false, randomize: boolean = true) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const pitchOffset = randomize ? (Math.random() * 0.4 - 0.2) : 0; // -20% ~ +20%
    const baseFreq = (isPerfect ? 1800 : 1300) * (1 + pitchOffset);

    // 1. 金属高频敲击声
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.22, t + 0.12);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    // 2. 金属共鸣长余韵 (Anvil ring)
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime((isPerfect ? 2400 : 1900) * (1 + pitchOffset * 0.5), t);

    ringGain.gain.setValueAtTime(isPerfect ? 0.35 : 0.22, t);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, t + (isPerfect ? 0.55 : 0.35));

    ringOsc.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ringOsc.start(t);
    ringOsc.stop(t + 0.55);

    // 3. 铁砧沉重低频敲击底音 (Bass thump)
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(140 * (1 + pitchOffset * 0.3), t);
    bassOsc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    bassGain.gain.setValueAtTime(0.55, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(t);
    bassOsc.stop(t + 0.14);
  }

  // 淬火入水蒸汽升腾音效 (Quench sizzle "呲————")
  public playQuenchSteam() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dur = 1.2;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.45));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + dur);
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + dur);
  }

  // 挥刀试斩木桩音效
  public playSlashHit(isCrit: boolean = false) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 挥剑风声 (Whoosh noise)
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.08);
    filter.Q.value = 3;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.linearRampToValueAtTime(0.001, t + 0.1);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // 命中木桩钝响 (Thud impact)
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(isCrit ? 160 : 120, t + 0.05);
    thud.frequency.exponentialRampToValueAtTime(30, t + 0.22);

    thudGain.gain.setValueAtTime(0.6, t + 0.05);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    thud.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thud.start(t + 0.05);
    thud.stop(t + 0.25);

    // 锋利切削声 (Slice high tone)
    if (isCrit) {
      const slice = this.ctx.createOscillator();
      const sliceGain = this.ctx.createGain();
      slice.type = 'sawtooth';
      slice.frequency.setValueAtTime(3200, t + 0.05);
      slice.frequency.exponentialRampToValueAtTime(800, t + 0.2);

      sliceGain.gain.setValueAtTime(0.25, t + 0.05);
      sliceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      slice.connect(sliceGain);
      sliceGain.connect(this.ctx.destination);
      slice.start(t + 0.05);
      slice.stop(t + 0.2);
    }
  }

  // 金币交割清脆声 (Twin coin chime)
  public playCoinSound() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [1318.51, 1567.98, 2093.0]; // E6, G6, C7
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // 灵光一闪神圣顿悟声 (Epiphany fanfare)
  public playEpiphanyFanfare() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // 绚烂大三和弦琶音
    const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    chords.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.07;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  // 云游商人造访铃声
  public playMerchantBell() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const bells = [880, 1174.66, 1760];
    bells.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    });
  }

  // 普通按钮轻敲声
  public playClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export const sound = new SoundManager();
