import { useTranslation } from '../../i18n';
import { Tooltip } from '../../components/ui/Tooltip';
import { Volume2, VolumeX } from '../../components/ui/icons';
import { useTextToSpeech, type TextToSpeechApi } from './useTextToSpeech';

interface ReadAloudButtonProps {
  /** Text to read, or a getter resolved lazily on click (e.g. current editor value). */
  text: string | (() => string);
  /** Stable id so multiple buttons can coordinate which one is speaking. */
  id?: string;
  /** Accessible label / tooltip for the idle (play) state. */
  label?: string;
  /** Accessible label / tooltip for the speaking (stop) state. */
  stopLabel?: string;
  /** Tailwind size classes for the icon. Defaults to a compact 3.5 size. */
  iconClassName?: string;
  className?: string;
  /** Optional shared controller so a group of buttons share one speaking state. */
  controller?: TextToSpeechApi;
}

/**
 * Pictogram button that reads the supplied text aloud in the active UI language.
 * Hidden entirely when the browser has no speech-synthesis support. Acts as a
 * play/stop toggle: the icon and label switch while speaking.
 */
export function ReadAloudButton({
  text,
  id = 'read-aloud',
  label,
  stopLabel,
  iconClassName = 'w-3.5 h-3.5',
  className,
  controller,
}: ReadAloudButtonProps) {
  const { t } = useTranslation();
  const fallback = useTextToSpeech();
  const tts = controller ?? fallback;

  if (!tts.isSupported) return null;

  const isSpeaking = tts.speakingId === id;
  const tooltipDict = t.tooltips as Record<string, string | undefined>;
  const playLabel = label ?? tooltipDict.readAloud ?? 'Read aloud';
  const activeLabel = stopLabel ?? tooltipDict.stopReading ?? 'Stop reading';
  const current = isSpeaking ? activeLabel : playLabel;

  const handleClick = () => {
    const resolved = typeof text === 'function' ? text() : text;
    tts.speak(resolved, id);
  };

  return (
    <Tooltip title={current}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={current}
        aria-pressed={isSpeaking}
        className={[
          'inline-flex items-center justify-center rounded-md transition-colors focus-ring',
          isSpeaking
            ? 'text-[var(--lcars-cyan,#4f98a3)] bg-[color-mix(in_srgb,var(--lcars-cyan,#4f98a3)_14%,transparent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)]',
          className ?? 'p-1.5',
        ].join(' ')}
      >
        {isSpeaking
          ? <VolumeX className={iconClassName} aria-hidden="true" />
          : <Volume2 className={iconClassName} aria-hidden="true" />}
      </button>
    </Tooltip>
  );
}
