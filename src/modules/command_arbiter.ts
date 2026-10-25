import type { LandmarkPoint } from './one_euro_filter';

/**
 * Dual Command Engine & Interaction Arbiter
 * Coordinates Voice Commands (Primary) and Hand Gestures (Secondary)
 * Eliminates race conditions with temporal debounce and 2-second suppression locks.
 */

export interface CommandArbiterOptions {
  onStateChange?: (newState: 'IDLE' | 'PIANO_MODE', source: string) => void;
  onProgressUpdate?: (progressPercent: number) => void;
  onVoiceTranscript?: (phrase: string) => void;
  onListeningStatus?: (isListening: boolean) => void;
}

export class CommandArbiter {
  onStateChange: (newState: 'IDLE' | 'PIANO_MODE', source: string) => void;
  onProgressUpdate: (progressPercent: number) => void;
  onVoiceTranscript: (phrase: string) => void;
  onListeningStatus: (isListening: boolean) => void;

  state: 'IDLE' | 'PIANO_MODE';
  gestureHoldStart: number | null;
  requiredHoldTimeMs: number;
  cooldownUntil: number;
  speechRecognition: any | null;
  isListening: boolean;
  destroyed: boolean;

  constructor(options: CommandArbiterOptions = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onProgressUpdate = options.onProgressUpdate || (() => {});
    this.onVoiceTranscript = options.onVoiceTranscript || (() => {});
    this.onListeningStatus = options.onListeningStatus || (() => {});

    this.state = 'IDLE';
    this.gestureHoldStart = null;
    this.requiredHoldTimeMs = 1000;
    this.cooldownUntil = 0;
    this.speechRecognition = null;
    this.isListening = false;
    this.destroyed = false;

    this.initSpeech();
  }

  initSpeech() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.onListeningStatus(false);
      return;
    }

    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event: any) => {
        if (this.destroyed) return;
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const transcript = lastResult[0].transcript.trim().toLowerCase();
          this.onVoiceTranscript(transcript);
          this.handleVoiceCommand(transcript);
        }
      };

      this.speechRecognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          this.isListening = false;
          this.onListeningStatus(false);
        }
      };

      this.speechRecognition.onend = () => {
        if (this.isListening && !this.destroyed) {
          try {
            this.speechRecognition.start();
          } catch (err) {}
        } else {
          this.onListeningStatus(false);
        }
      };

      this.startListening();
    } catch (e) {
      this.onListeningStatus(false);
    }
  }

  startListening() {
    if (this.speechRecognition && !this.isListening && !this.destroyed) {
      try {
        this.speechRecognition.start();
        this.isListening = true;
        this.onListeningStatus(true);
      } catch (err) {}
    }
  }

  stopListening() {
    if (this.speechRecognition && this.isListening) {
      this.isListening = false;
      try {
        this.speechRecognition.stop();
      } catch (err) {}
      this.onListeningStatus(false);
    }
  }

  handleVoiceCommand(transcript: string) {
    const isPianoStart = [
      'piano mode',
      'start piano',
      'activate piano',
      'play piano',
      'piano',
      'deschide pianul',
      'porneste pianul',
      'mod pian',
      'pian'
    ].some((k) => transcript.includes(k));

    const isPianoStop = [
      'stop piano',
      'exit piano',
      'close piano',
      'stop',
      'exit',
      'opreste pianul',
      'inchide pianul',
      'gata',
      'opreste'
    ].some((k) => transcript.includes(k));

    const isReset = ['reset', 'calibrate', 'recenter', 'reseteaza', 'calibreaza'].some((k) =>
      transcript.includes(k)
    );

    if (isPianoStart && !isPianoStop) {
      this.setSystemState('PIANO_MODE', 'VOICE');
      this.engageCooldown(2000);
    } else if (isPianoStop) {
      this.setSystemState('IDLE', 'VOICE');
      this.engageCooldown(2000);
    } else if (isReset) {
      this.setSystemState('IDLE', 'VOICE RESET');
      this.engageCooldown(1500);
    }
  }

  engageCooldown(durationMs = 2000) {
    this.cooldownUntil = Date.now() + durationMs;
    this.gestureHoldStart = null;
    this.onProgressUpdate(0);
  }

  setSystemState(newState: 'IDLE' | 'PIANO_MODE', source = 'SYSTEM') {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange(this.state, source);
    }
  }

  evaluateGesture(handLandmarks: LandmarkPoint[] | null | undefined) {
    const now = Date.now();

    if (now < this.cooldownUntil) {
      this.gestureHoldStart = null;
      this.onProgressUpdate(0);
      return;
    }

    if (!handLandmarks || handLandmarks.length < 21) {
      this.gestureHoldStart = null;
      this.onProgressUpdate(0);
      return;
    }

    const indexExtended = handLandmarks[8].y < handLandmarks[6].y;
    const middleExtended = handLandmarks[12].y < handLandmarks[10].y;
    const ringCurled = handLandmarks[16].y > handLandmarks[14].y;
    const pinkyCurled = handLandmarks[20].y > handLandmarks[18].y;

    const isTwoFingerPose = indexExtended && middleExtended && ringCurled && pinkyCurled;

    if (isTwoFingerPose) {
      if (!this.gestureHoldStart) {
        this.gestureHoldStart = now;
      }
      const elapsed = now - this.gestureHoldStart;
      const progress = Math.min((elapsed / this.requiredHoldTimeMs) * 100, 100);
      this.onProgressUpdate(progress);

      if (elapsed >= this.requiredHoldTimeMs) {
        const targetState = this.state === 'PIANO_MODE' ? 'IDLE' : 'PIANO_MODE';
        this.setSystemState(targetState, '2-FINGER HOLD');
        this.engageCooldown(2500);
      }
    } else {
      this.gestureHoldStart = null;
      this.onProgressUpdate(0);
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopListening();
  }
}
