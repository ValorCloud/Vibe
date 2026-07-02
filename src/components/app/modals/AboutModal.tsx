import React, { useEffect, useRef, useState } from 'react';
import { Apple, Github, Music, Youtube, ExternalLink, Linkedin, Radio, ShoppingBag, Info, X, BookOpen, FileText } from '../../ui/icons';
import { useTranslation } from '../../../i18n';
import { APP_VERSION_LABEL } from '../../../version';
import { getAiProviderName, getAiModelName, getAiKeySourceLabel, isAiAvailable } from '../../../utils/aiUtils';
import { Button } from '../../ui/Button';
import { AiAssistantPanel } from '../AiAssistantPanel';
import bannerImage from '../../../../docs/Lyricist_Splash_Medium.png';

const SPLASH_DELAY_MS = 3000;

/** Lyria model catalogue shown in the About dialog. */
const LYRIA_MODELS = [
  {
    id: 'lyria-3-clip-preview',
    label: 'Clip Preview',
    description: 'Short musical sketches (≤30 s). Low latency, ideal for iterating on hooks and chord progressions.',
  },
  {
    id: 'lyria-3-pro-preview',
    label: 'Full Song',
    description: 'Full-length generation (up to 4 min). Higher fidelity, richer arrangement — best for final production.',
  },
] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Quand true, ferme automatiquement après 3 secondes. */
  isSplashScreen?: boolean;
}

export function AboutModal({ isOpen, onClose, isSplashScreen = false }: Props) {
  const { t } = useTranslation();
  const about = t.about ?? ({} as NonNullable<typeof t.about>);
  const actions = (t as { actions?: { close?: string } }).actions;
  const bodyRef = useRef<HTMLDivElement>(null);
  const sweepItemsRef = useRef<HTMLDivElement>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  // Active AI provider info — refreshed when the dialog opens (the provider
  // status may resolve asynchronously and the user can change it in Settings).
  const [aiInfo, setAiInfo] = useState({
    provider: getAiProviderName(),
    model: getAiModelName(),
    keySource: getAiKeySourceLabel(),
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const refresh = () => setAiInfo({
      provider: getAiProviderName(),
      model: getAiModelName(),
      keySource: getAiKeySourceLabel(),
    });
    refresh();
    void isAiAvailable().then(() => { if (!cancelled) refresh(); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const container = sweepItemsRef.current;
    if (container) {
      const items = container.querySelectorAll<HTMLElement>('.about-sweep-item');
      items.forEach((item) => {
        item.classList.remove('sweep-active');
        void item.offsetWidth;
        item.classList.add('sweep-active');
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isSplashScreen) return;
    const id = setTimeout(() => onCloseRef.current(), SPLASH_DELAY_MS);
    return () => clearTimeout(id);
  }, [isOpen, isSplashScreen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden items-center justify-center hidden dark:flex">
        <div className="w-[600px] h-[400px] bg-[var(--accent-color)]/10 blur-[120px] rounded-full" />
      </div>

      <div
        className="lcars-gradient-outline relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[24px_8px_24px_8px] animate-in zoom-in-95 duration-300"
        style={{
          padding: '2px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          isolation: 'isolate',
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.app.name}
        className="relative w-full h-full flex flex-col shadow-2xl overflow-hidden about-dialog-shimmer dialog-surface rounded-none sm:rounded-[22px_6px_22px_6px]"
      >
        {isSplashScreen && (
          <>
            <div
              className="absolute top-0 left-0 h-[2px] bg-[var(--accent-color)] z-10"
              style={{
                opacity: 0.8,
                width: '100%',
                transformOrigin: 'left center',
                animation: `splash-progress ${SPLASH_DELAY_MS}ms linear forwards`,
              }}
              aria-hidden="true"
            />
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {about.splashAutoClose ?? `This window will close automatically in ${SPLASH_DELAY_MS / 1000} seconds.`}
            </div>
          </>
        )}

        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0" style={{ background: 'var(--bg-sidebar)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center">
              <Info className="w-4 h-4 text-[var(--accent-color)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase">
                {t.app.name}
              </h3>
              <p className="text-xs text-[var(--accent-color)] uppercase tracking-wider mt-0.5">
                {APP_VERSION_LABEL} · VoxNova42
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={about.close ?? actions?.close ?? 'Close'}
            className="ux-interactive p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto custom-scrollbar">

          <img
            src={bannerImage}
            alt="Lyricist splash screen"
            className="w-full block"
          />

          <div ref={sweepItemsRef} className="px-8 pt-4 pb-8 space-y-6">
            <p className="about-sweep-item text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto text-center">
              <span className="about-sweep-content">
                {about.description ?? 'AI-powered songwriting assistant.'}
              </span>
            </p>

            {/* Tech Info — active AI provider */}
            <div className="grid grid-cols-1 gap-3 pt-4 border-t border-[var(--border-color)] sm:grid-cols-2">
              <div className="about-sweep-item flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)]">
                <div className="about-sweep-content flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{about.engineLabel ?? 'Engine'}</span>
                  <span className="text-xs text-[var(--text-primary)] telemetry-text">{aiInfo.provider}</span>
                </div>
              </div>
              <div className="about-sweep-item flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)]">
                <div className="about-sweep-content flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{about.modelLabel ?? 'Model'}</span>
                  <span className="text-xs text-[var(--text-primary)] telemetry-text break-all text-center">{aiInfo.model}</span>
                </div>
              </div>
              <div className="about-sweep-item flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)]">
                <div className="about-sweep-content flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{about.apiKeyLabel ?? 'API key'}</span>
                  <span className="text-xs text-[var(--text-primary)] telemetry-text break-all text-center">{aiInfo.keySource}</span>
                </div>
              </div>
              <div className="about-sweep-item flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)]">
                <div className="about-sweep-content flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{about.licenseLabel ?? 'License'}</span>
                  <span className="text-xs text-[var(--text-primary)] telemetry-text">{about.license ?? 'MIT'}</span>
                </div>
              </div>
            </div>

            {/* Lyria Music Generation */}
            <div className="about-sweep-item pt-4 border-t border-[var(--border-color)] space-y-3">
              <div className="about-sweep-content space-y-3">
                <div className="flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-[var(--accent-color)]" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--accent-color)]">Lyria Music Generation</span>
                  <span className="ml-auto text-[10px] text-[var(--text-secondary)] font-mono">VITE_LYRIA_INTERNAL_TOKEN</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {LYRIA_MODELS.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-1 px-4 py-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{m.label}</span>
                        <span className="text-[10px] font-mono text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded">{m.id}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{m.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="pt-2 space-y-3">
              <div className="flex gap-2">
                <a
                  href="https://github.com/EmmanuelKerhoz/Vibe"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={about.github ?? 'GitHub'}
                  className="about-sweep-item ux-interactive flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs font-medium"
                >
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Github className="w-4 h-4" />
                    <span>{about.github ?? 'GitHub'}</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsAssistantOpen(v => !v)}
                  aria-label={about.docs ?? 'Documentation'}
                  aria-pressed={isAssistantOpen}
                  className={`about-sweep-item ux-interactive flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium transition-all ${
                    isAssistantOpen
                      ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/40 text-[var(--accent-color)]'
                      : 'bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border-[var(--border-color)] hover:border-[var(--accent-color)]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span>{about.docs ?? 'Documentation'}</span>
                  </span>
                </button>
              </div>

              {isAssistantOpen && (
                <AiAssistantPanel onClose={() => setIsAssistantOpen(false)} />
              )}

              <a href="https://github.com/sponsors/EmmanuelKerhoz" target="_blank" rel="noopener noreferrer" aria-label="Visit GitHub Sponsors page"
                className="about-sweep-item ux-interactive mx-auto flex w-full max-w-sm items-center justify-center gap-2 px-4 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 hover:border-pink-500/40 text-pink-400 hover:text-pink-300 rounded-lg text-xs font-medium">
                <span className="about-sweep-content flex items-center justify-center gap-2">
                  <Github className="w-4 h-4" />
                  <span>Donation (Github Sponsor)</span>
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </span>
              </a>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a href="https://www.youtube.com/@voxnova42" target="_blank" rel="noopener noreferrer" aria-label="Visit YouTube channel"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Youtube className="w-4 h-4" />
                    <span>YouTube</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <a href="https://open.spotify.com/artist/6VfhDlWsBW0qk0a8x7UbOM" target="_blank" rel="noopener noreferrer" aria-label="Visit Spotify artist page"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 hover:text-green-300 rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Music className="w-4 h-4" />
                    <span>Spotify</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <a href="https://www.linkedin.com/in/emmanuelkerhoz/" target="_blank" rel="noopener noreferrer" aria-label="Visit LinkedIn profile"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <a href="https://network.landr.com/users/emmanueldk" target="_blank" rel="noopener noreferrer" aria-label="Visit Landr profile"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 text-violet-400 hover:text-violet-300 rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Radio className="w-4 h-4" />
                    <span>Landr</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <a href="https://music.amazon.com/artists/B0DKW3BNL7/emmanuel-kerhoz" target="_blank" rel="noopener noreferrer" aria-label="Visit Amazon Music artist page"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Amazon</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
                <a href="https://music.apple.com/artist/emmanuel-kerhoz/1776965137" target="_blank" rel="noopener noreferrer" aria-label="Visit Apple Music artist page"
                  className="about-sweep-item ux-interactive flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-app)] hover:bg-[var(--bg-sidebar)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs font-medium">
                  <span className="about-sweep-content flex items-center justify-center gap-2">
                    <Apple className="w-4 h-4" />
                    <span>Apple Music</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end flex-shrink-0" style={{ background: 'var(--bg-sidebar)' }}>
          <Button onClick={onClose} variant="contained" color="primary" className="ux-interactive">
            {about.close ?? actions?.close ?? 'Close'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
