import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/app/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageProvider';
import { RefsProvider } from './contexts/RefsContext';
import { SpotifyAuthProvider } from './contexts/SpotifyAuthContext';
import { SpotifyEngineProvider } from './contexts/SpotifyEngineContext';
import { initClarity } from './utils/clarity';
import './index.css';

initClarity();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(
    '[Lyricist] Root element #root not found in the DOM. ' +
    'Check index.html for a <div id="root"> element.',
  );
}

// Remove legacy legal footer markup that may remain in cached/stale host HTML.
// The canonical Privacy/Terms links are rendered inside StatusBar.
document.querySelectorAll('[data-legacy-legal-footer], body > footer').forEach((el) => {
  const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).map((anchor) => anchor.getAttribute('href'));
  if (hrefs.includes('/privacy.html') && hrefs.includes('/terms.html')) {
    el.remove();
  }
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RefsProvider>
        <LanguageProvider>
          <SpotifyAuthProvider>
            <SpotifyEngineProvider>
              <App />
            </SpotifyEngineProvider>
          </SpotifyAuthProvider>
        </LanguageProvider>
      </RefsProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
