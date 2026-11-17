import { useEffect, useId, useRef, type ReactNode } from 'react';
import { mountChoices } from '../../vendor/valor-configuration/controls.mjs';

interface Props {
  label: string;
  value: string;
  children: ReactNode;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
}

/** Shared hover, keyboard and touch choices, opening above the status bar. */
export function StatusChoice({ label, value, children, options, onSelect }: Props) {
  const group = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const panelId = useId();
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!group.current) return;
    return mountChoices(group.current, { placement: 'above', onSelect: selectedValue => selectRef.current(selectedValue) });
  }, []);

  return (
    <div ref={group} className="vibe-status-choice">
      <button type="button" className="lcars-meta-btn" aria-label={label} aria-controls={panelId} aria-expanded="false">
        {children}
      </button>
      <div id={panelId} data-choices hidden className="vibe-status-options" role="group" aria-label={label}>
        {options.map(option => (
          <button type="button" key={option.value} data-choice={option.value} dir="auto" aria-pressed={option.value === value}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
