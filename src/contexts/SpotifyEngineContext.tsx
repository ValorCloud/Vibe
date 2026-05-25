import React, { createContext, useContext } from 'react';
import { useSpotifyEngine } from '../hooks/useSpotifyEngine';
import { useSpotifyAuthActions, useSpotifyAuthState } from './SpotifyAuthContext';
import type { UseSpotifyEngineResult } from '../hooks/useSpotifyEngine';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SpotifyEngineContext = createContext<UseSpotifyEngineResult | null>(null);

export function SpotifyEngineProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useSpotifyAuthState();
  const { getValidToken } = useSpotifyAuthActions();
  const engine = useSpotifyEngine({ accessToken, getValidToken });

  return (
    <SpotifyEngineContext.Provider value={engine}>
      {children}
    </SpotifyEngineContext.Provider>
  );
}

export function useSpotifyEngine_(): UseSpotifyEngineResult {
  const ctx = useContext(SpotifyEngineContext);
  if (!ctx) throw new Error('useSpotifyEngine_ must be used within SpotifyEngineProvider');
  return ctx;
}
