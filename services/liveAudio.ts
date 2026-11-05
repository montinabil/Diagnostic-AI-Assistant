// Audio encoding & decoding helpers for Gemini Live API
// Input: 16kHz 1-channel 16-bit PCM
// Output: 24kHz 1-channel 16-bit PCM

export function pcmToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToFloat32Array(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32Array;
}

export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    // 24kHz audio output required by Gemini Live
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
    } catch (e) {
      console.warn('Could not initialize 24kHz AudioContext', e);
    }
  }

  public playChunk(base64Pcm: string) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const float32 = base64ToFloat32Array(base64Pcm);
    if (float32.length === 0) return;

    const buffer = this.ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.05; // slight buffer for smooth playback
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
    };
  }

  public interrupt() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // ignore
      }
    });
    this.activeSources = [];
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    }
  }

  public close() {
    this.interrupt();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.ctx = null;
  }
}

export class LiveAudioRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioCallback: (base64Pcm: string) => void;

  constructor(onAudio: (base64Pcm: string) => void) {
    this.onAudioCallback = onAudio;
  }

  public async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx({ sampleRate: 16000 });

    const source = this.ctx.createMediaStreamSource(this.stream);
    // Buffer size 4096 gives ~256ms latency chunks at 16kHz
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      const base64 = pcmToBase64(channelData);
      this.onAudioCallback(base64);
    };

    source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  public stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
