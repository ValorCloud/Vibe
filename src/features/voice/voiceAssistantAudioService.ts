interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [altIndex: number]: { transcript: string };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

type WindowWithSpeechRecognition = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

export interface VoiceAudioService {
  isRecognitionSupported: () => boolean;
  isSpeechSupported: () => boolean;
  listenOnce: (language?: string) => Promise<string>;
  speak: (text: string, options?: { slowStartMs?: number; onSlowStart?: () => void }) => Promise<boolean>;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const withSpeech = window as WindowWithSpeechRecognition;
  return withSpeech.SpeechRecognition ?? withSpeech.webkitSpeechRecognition ?? null;
}

export class BrowserVoiceAudioService implements VoiceAudioService {
  isRecognitionSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  isSpeechSupported(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  listenOnce(language = 'fr-FR'): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognitionCtor = getSpeechRecognitionCtor();
      if (!SpeechRecognitionCtor) {
        reject(new Error('Speech recognition is not supported in this browser.'));
        return;
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let transcript = '';
      recognition.onresult = (event) => {
        const firstResult = event.results[0];
        const firstAlt = firstResult?.[0];
        transcript = firstAlt?.transcript?.trim() ?? '';
      };
      recognition.onerror = (event) => {
        reject(new Error(event.error ?? 'Speech recognition error.'));
      };
      recognition.onend = () => {
        if (transcript) resolve(transcript);
        else reject(new Error('No voice input captured.'));
      };
      recognition.start();
    });
  }

  speak(text: string, options?: { slowStartMs?: number; onSlowStart?: () => void }): Promise<boolean> {
    if (!this.isSpeechSupported()) return Promise.resolve(false);

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const synth = window.speechSynthesis;
      const slowStartMs = options?.slowStartMs ?? 1800;
      let resolved = false;
      let started = false;

      const settle = (spoken: boolean) => {
        if (resolved) return;
        resolved = true;
        resolve(spoken);
      };

      const slowTimer = window.setTimeout(() => {
        if (started) return;
        options?.onSlowStart?.();
        synth.cancel();
        settle(false);
      }, slowStartMs);

      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => {
        window.clearTimeout(slowTimer);
        settle(started);
      };
      utterance.onerror = () => {
        window.clearTimeout(slowTimer);
        settle(false);
      };

      synth.cancel();
      synth.speak(utterance);
    });
  }
}
