/**
 * Canonical LCARS palette for the Vox Nova player UI.
 * Colors chosen to match the Star Trek-inspired mockup
 * (tan/peach primary, purple accent, deep black background, alert reds).
 */
export const LCARS = {
  // Backgrounds
  void: '#000008',          // deep space background
  panelDark: '#1f1f24',     // dark control panel
  panelDarker: '#0a0a10',   // visualizer well

  // Primary LCARS hues
  peach: '#f5b06b',         // warm tan/peach — VOX block, play, header bar, UPLINK
  orange: '#f59e0b',        // bright orange — LOCAL, SCAN SECTOR accents
  amber: '#ffae42',         // structural-integrity bar
  purple: '#9c8cff',        // CLOUD button, neural buffer bar
  red: '#e0676b',           // PURGE / alert
  alertRed: '#ff3b30',      // IMPULSE_ONLY status dot

  // Text
  text: '#f8f8f8',
  subText: '#99ccff',       // cyan-blue caption (COMMS_ENCRYPTION etc.)
  mutedText: 'rgba(255,255,255,0.45)',

  // Strokes
  divider: 'rgba(245,176,107,0.6)',
} as const;
