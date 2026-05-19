import React from 'react';
import { PersonVoice } from '../../components/ui/icons';

export type VoiceAssistantVisualState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceAssistantButtonProps {
  state: VoiceAssistantVisualState;
  disabled?: boolean;
  onInvoke: () => void;
}

const STATE_LABELS: Record<VoiceAssistantVisualState, string> = {
  idle: 'Voice assistant',
  listening: 'Voice assistant listening',
  processing: 'Voice assistant processing',
  speaking: 'Voice assistant speaking',
};

export function VoiceAssistantButton({ state, disabled = false, onInvoke }: VoiceAssistantButtonProps) {
  const active = state !== 'idle';

  return (
    <button
      onClick={onInvoke}
      disabled={disabled}
      aria-label={STATE_LABELS[state]}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
        backgroundColor: active ? 'color-mix(in srgb, var(--accent-color) 12%, transparent)' : undefined,
      }}
    >
      <PersonVoice className={`w-4 h-4 ${state === 'listening' ? 'animate-pulse' : ''}`} />
    </button>
  );
}
