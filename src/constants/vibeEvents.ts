/**
 * VIBE_EVENTS — typed const map for all window CustomEvent names.
 *
 * Usage (dispatch):
 *   window.dispatchEvent(new CustomEvent(VIBE_EVENTS.PLAYER_FOLDER_LOADED, { detail: file }));
 *
 * Usage (listen):
 *   window.addEventListener(VIBE_EVENTS.API_ERROR, handler);
 */
export const VIBE_EVENTS = {
  /** Dispatched by AppModalLayer when a cloud file is loaded in player mode.
   *  Detail: CloudFile */
  PLAYER_FOLDER_LOADED: 'vibe:playerfolderloaded',

  /** Dispatched when an API call fails with a user-visible error.
   *  Detail: { message: string } */
  API_ERROR: 'vibe:apierror',
} as const;

export type VibeEventName = (typeof VIBE_EVENTS)[keyof typeof VIBE_EVENTS];
