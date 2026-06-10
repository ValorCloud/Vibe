import React from 'react';
import { Music, Wand2, Loader2, Zap } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { useTranslation } from '../../../i18n';

const AMBER_PRIMARY = '#f59e0b';
const AMBER_SECONDARY = '#38bdf8';

const MUSICAL_GUIDE_STEPS = [
  { title: '1. Start broad',         action: 'Select your genre family', description: 'Choose from ÉLECTRONIQUE, URBAIN, ROCK, SOUL/JAZZ, WORLD, POP, or CLASSIQUE below to set the foundation.' },
  { title: '2. Refine the niche',    action: 'Pick a sub-style',        description: 'After selecting a genre, choose a sub-style (Indie, Club-ready, Cinematic, etc.) to define the specific lane.' },
  { title: '3. Give references',     action: 'Copy 2-3 artist cues', description: 'Use the “Copy references” control under For fans of, then paste them into the Musical Prompt under REFERENCES.' },
  { title: '4. Lock production',     action: 'Confirm BPM & instruments', description: 'Verify the auto-set tempo, instruments, and rhythm, or adjust them to match your vision.' },
];

interface Props {
  title: string;
  topic: string;
  mood: string;
  hasContext: boolean;
  hasApiKey: boolean;
  isAnalyzingLyrics: boolean;
  isGeneratingMusicalPrompt: boolean;
  analyzeLyricsForMusic: () => void;
  completedSteps?: Set<number>;
}

export function LyricsMusicAnalysis({ title, topic, mood, hasContext, hasApiKey, isAnalyzingLyrics, isGeneratingMusicalPrompt, analyzeLyricsForMusic, completedSteps = new Set() }: Props) {
  const { t } = useTranslation();
  const m = t.musical;
  const isDisabled = !hasApiKey || isAnalyzingLyrics || isGeneratingMusicalPrompt;
  const analyzeTooltip = !hasApiKey
    ? t.tooltips.aiUnavailable
    : m.analyzeLyricsShort;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lcars-ribbon-rail">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px_4px_12px_4px] flex items-center justify-center shrink-0" style={{ background: `${AMBER_PRIMARY}22` }}>
              <Music className="w-5 h-5" style={{ color: AMBER_PRIMARY }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-widest uppercase" style={{ color: AMBER_PRIMARY }}>{m.title}</h2>
              <p className="text-xs mt-0.5" style={{ color: AMBER_SECONDARY }}>{m.description}</p>
            </div>
          </div>
          <Tooltip title={analyzeTooltip}>
            <button onClick={analyzeLyricsForMusic} disabled={isDisabled}
              className="ux-interactive flex items-center gap-2 px-3 py-2 text-xs font-medium tracking-wide shrink-0 disabled:opacity-50 disabled:cursor-not-allowed border"
              style={{ borderRadius: '10px 3px 10px 3px', background: `${AMBER_PRIMARY}1a`, borderColor: `${AMBER_PRIMARY}55`, color: AMBER_PRIMARY }}
            >
              {isAnalyzingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isAnalyzingLyrics ? m.analyzing : m.analyzeLyricsShort}</span>
            </button>
          </Tooltip>
        </div>
        {hasContext && (
          <div className="mt-3 flex items-center gap-2 text-[10px] px-3 py-1.5 border"
            style={{ borderRadius: '10px 3px 10px 3px', background: `${AMBER_PRIMARY}0d`, borderColor: `${AMBER_PRIMARY}2a`, color: AMBER_SECONDARY }}
          >
            <Zap className="w-3 h-3 shrink-0" style={{ color: AMBER_PRIMARY }} />
            <span>{m.contextInfo}</span>
            <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
              {title && <span className="px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${AMBER_PRIMARY}22`, color: AMBER_PRIMARY }}>{title}</span>}
              {topic && <span className="px-1.5 py-0.5 rounded-md text-[var(--text-secondary)] bg-[var(--border-color)]/40">{topic}</span>}
              {mood  && <span className="px-1.5 py-0.5 rounded-md text-[var(--text-secondary)] bg-[var(--border-color)]/40">{mood}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Guide steps — compact mini-cards with tooltip details */}
      <div className="grid gap-2 lg:grid-cols-4 px-6 pt-2">
        {MUSICAL_GUIDE_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completedSteps.has(stepNumber);
          return (
            <Tooltip key={step.title} title={step.description}>
              <div className="ux-interactive border px-3 py-2"
                style={{
                  borderRadius: '14px 4px 14px 4px',
                  background: isCompleted ? `${AMBER_PRIMARY}20` : `${AMBER_SECONDARY}10`,
                  borderColor: isCompleted ? `${AMBER_PRIMARY}50` : `${AMBER_SECONDARY}30`,
                  cursor: 'default',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center border text-[9px] font-bold shrink-0"
                    style={{
                      borderRadius: '50%',
                      borderColor: isCompleted ? AMBER_PRIMARY : `${AMBER_SECONDARY}45`,
                      background: isCompleted ? AMBER_PRIMARY : (index === 0 ? `${AMBER_PRIMARY}22` : 'transparent'),
                      color: isCompleted ? '#000' : (index === 0 ? AMBER_PRIMARY : AMBER_SECONDARY),
                    }}>
                    {isCompleted ? '✓' : stepNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold tracking-[0.18em] uppercase truncate"
                      style={{ color: isCompleted ? AMBER_PRIMARY : (index === 0 ? AMBER_PRIMARY : AMBER_SECONDARY) }}
                    >
                      {step.title}
                    </div>
                    <p className="text-[10px] font-medium leading-4 truncate" style={{ color: AMBER_PRIMARY }}>{step.action}</p>
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
