/**
 * Dual Command Engine & Interaction Arbiter
 * Coordinates Voice Commands (Primary) and Hand Gestures (Secondary)
 * Eliminates race conditions with temporal debounce and 2-second suppression locks.
 */

export class CommandArbiter {
  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onProgressUpdate = options.onProgressUpdate || (() => {});
    this.onVoiceTranscript = options.onVoiceTranscript || (() => {});

    this.state = "IDLE"; // "IDLE" or "PIANO_MODE"
    this.gestureHoldStart = null;
    this.requiredHoldTimeMs = 1000; // 1.0 second hold required
    this.cooldownUntil = 0; // Epoch timestamp for gesture suppression
    this.speechRecognition = null;
    this.isListening = false;

    this.initSpeech();
  }

  initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser. Falling back to gestures.");
      return;
    }

    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const transcript = lastResult[0].transcript.trim().toLowerCase();
          console.log("[Voice Command Detected]:", transcript);
          this.onVoiceTranscript(transcript);
          this.handleVoiceCommand(transcript);
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn("[Speech Error]:", e.error);
      };

      this.speechRecognition.onend = () => {
        if (this.isListening) {
          try {
            this.speechRecognition.start();
          } catch (err) {}
        }
      };

      this.startListening();
    } catch (e) {
      console.warn("Speech init exception:", e);
    }
  }

  startListening() {
    if (this.speechRecognition && !this.isListening) {
      try {
        this.speechRecognition.start();
        this.isListening = true;
      } catch (err) {}
    }
  }

  handleVoiceCommand(transcript) {
    // Voice has instant, absolute priority (Supports both English and Romanian)
    const isPianoStart = [
      "piano mode", "start piano", "activate piano", "play piano", "piano",
      "deschide pianul", "porneste pianul", "mod pian", "pian"
    ].some(k => transcript.includes(k));

    const isPianoStop = [
      "stop piano", "exit piano", "close piano", "stop", "exit",
      "opreste pianul", "inchide pianul", "gata", "opreste"
    ].some(k => transcript.includes(k));

    const isReset = [
      "reset", "calibrate", "recenter", "reseteaza", "calibreaza"
    ].some(k => transcript.includes(k));

    if (isPianoStart && !isPianoStop) {
      this.setSystemState("PIANO_MODE", "VOICE");
      this.engageCooldown(2000);
    } else if (isPianoStop) {
      this.setSystemState("IDLE", "VOICE");
      this.engageCooldown(2000);
    } else if (isReset) {
      this.setSystemState("IDLE", "VOICE");
      this.engageCooldown(1500);
    }
  }

  engageCooldown(durationMs = 2000) {
    this.cooldownUntil = Date.now() + durationMs;
    this.gestureHoldStart = null;
    this.onProgressUpdate(0);
  }

  setSystemState(newState, source = "SYSTEM") {
    if (this.state !== newState) {
      this.state = newState;
      console.log(`[State Transition] -> ${newState} (via ${source})`);
      this.onStateChange(this.state, source);
    }
  }

  /**
   * Evaluate two-finger raised gesture from MediaPipe hand landmarks
   */
  evaluateGesture(handLandmarks) {
    const now = Date.now();

    // 1. If currently in cooldown, suppress all gestures
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

    // Hand geometry check:
    // Landmark 8: Index Tip, Landmark 6: Index PIP
    // Landmark 12: Middle Tip, Landmark 10: Middle PIP
    // Landmark 16: Ring Tip, Landmark 14: Ring PIP
    // Landmark 20: Pinky Tip, Landmark 18: Pinky PIP
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
        // Toggle or activate piano mode
        const targetState = this.state === "PIANO_MODE" ? "IDLE" : "PIANO_MODE";
        this.setSystemState(targetState, "GESTURE (2-Finger Hold)");
        this.engageCooldown(2500); // 2.5s lock prevents rapid loop
      }
    } else {
      this.gestureHoldStart = null;
      this.onProgressUpdate(0);
    }
  }
}
