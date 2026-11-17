export const statusZoomPresets: readonly number[];
export const statusZoomLevels: readonly number[];
export function nextZoom(percent: number, direction: number, levels?: readonly number[]): number;
export function mountChoices(group: HTMLElement, options?: {
  placement?: 'above' | 'below';
  getBounds?: () => { left: number; top: number; width: number; height: number };
  onSelect?: (value: string) => void;
}): () => void;
export function mountFullscreen(options: {
  target: HTMLElement;
  button: HTMLButtonElement;
  enterLabel: () => string;
  exitLabel: () => string;
  onChange?: (active: boolean) => void;
  onError?: (error: unknown) => void;
}): { update: () => void; dispose: () => void };
