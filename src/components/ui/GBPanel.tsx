import React from 'react';

interface GBPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * GBPanel — shared LCARS "glass-bordered" panel container.
 * Applies the `lcars-gb-panel` CSS class from `lcars-system.css`.
 * Used throughout the Musical page to group related parameter sections.
 */
export function GBPanel({ children, className = '', style }: GBPanelProps) {
  return (
    <div className={`lcars-gb-panel${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}
