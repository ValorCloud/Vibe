/**
 * cloudStorage.ts — Abstraction multi-provider pour cloud storage pick.
 * Providers : OneDrive Personnel, OneDrive Business, Dropbox, Box, Google Drive.
 *
 * Stratégie : chaque provider expose une méthode `pickFile()` qui retourne
 * un `CloudFile` (nom + contenu texte) ou null si annulé.
 * Aucune dépendance runtime supplémentaire hors @azure/msal-browser (déjà présent).
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
} from '@azure/msal-browser';

// ─── Types publics ────────────────────────────────────────────────────────────

export interface CloudFile {
  name: string;
  content: string;
}

export type CloudProviderId =
  | 'onedrive'
  | 'onedrive-business'
  | 'dropbox'
  | 'box'
  | 'gdrive';

export interface CloudProviderMeta {
  id: CloudProviderId;
  label: string;
  /** Classe CSS couleur accent pour l'icône/badge */
  colorClass: string;
  available: boolean;
}

// ─── Config runtime (variables d'env Vite) ───────────────────────────────────

const MSAL_CLIENT_ID =
  (import.meta.env.VITE_MSGRAPH_CLIENT_ID as string | undefined) ?? '';
const MSAL_AUTHORITY =
  (import.meta.env.VITE_MSGRAPH_AUTHORITY as string | undefined) ??
  'https://login.microsoftonline.com/common';
const SHAREPOINT_ORIGIN =
  (import.meta.env.VITE_SHAREPOINT_ORIGIN as string | undefined) ??
  'https://your-tenant.sharepoint.com';
const DROPBOX_APP_KEY =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? '';
const BOX_CLIENT_ID =
  (import.meta.env.VITE_BOX_CLIENT_ID as string | undefined) ?? '';
const GDRIVE_API_KEY =
  (import.meta.env.VITE_GDRIVE_API_KEY as string | undefined) ?? '';
const GDRIVE_CLIENT_ID =
  (import.meta.env.VITE_GDRIVE_CLIENT_ID as string | undefined) ?? '';

// ─── Helpers internes ────────────────────────────────────────────────────────

async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.odt'];

function isAcceptedFile(name: string): boolean {
  return ACCEPTED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

// ─── MSAL singleton ──────────────────────────────────────────────────────────

let _msalApp: PublicClientApplication | null = null;

function getMsalApp(): PublicClientApplication | null {
  if (!MSAL_CLIENT_ID) return null;
  if (!_msalApp) {
    const config: Configuration = {
      auth: { clientId: MSAL_CLIENT_ID, authority: MSAL_AUTHORITY },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    };
    _msalApp = new PublicClientApplication(config);
  }
  return _msalApp;
}

async function getMsalToken(scopes: string[]): Promise<string | null> {
  const app = getMsalApp();
  if (!app) return null;
  await app.initialize();
  const accounts = app.getAllAccounts();
  try {
    let result: AuthenticationResult;
    if (accounts.length > 0) {
      // exactOptionalPropertyTypes: account must be AccountInfo, not undefined
      const account = accounts[0]!;
      result = await app.acquireTokenSilent({ scopes, account });
    } else {
      result = await app.acquireTokenPopup({ scopes });
    }
    return result.accessToken;
  } catch {
    try {
      const result = await app.acquireTokenPopup({ scopes });
      return result.accessToken;
    } catch {
      return null;
    }
  }
}

// ─── OneDrive Personnel ──────────────────────────────────────────────────────

async function pickOneDrive(business: boolean): Promise<CloudFile | null> {
  const scopes = business
    ? ['Files.Read', 'User.Read', 'openid', 'profile']
    : ['Files.Read', 'User.Read', 'openid', 'profile'];

  const token = await getMsalToken(scopes);
  if (!token) return null;

  // OneDrive File Picker v8 (SDK-less) ─ ouvre une fenêtre popup
  return new Promise(resolve => {
    const origin = business
      ? SHAREPOINT_ORIGIN
      : 'https://onedrive.live.com';

    const pickerWindow = window.open(
      `${origin}/picker?v=8&quantum=1&entry.mode=files&select.mode=single&typesAndExtensions=${encodeURIComponent(ACCEPTED_EXTENSIONS.join(','))}`,
      'OneDrivePicker',
      'width=800,height=600,toolbar=0,scrollbars=1',
    );

    if (!pickerWindow) { resolve(null); return; }

    const messageHandler = async (event: MessageEvent) => {
      if (event.source !== pickerWindow) return;
      const data = event.data as { type?: string; items?: Array<{ name: string; '@microsoft.graph.downloadUrl'?: string; id?: string }> };
      if (data?.type === 'Success' && data.items?.length) {
        window.removeEventListener('message', messageHandler);
        pickerWindow.close();
        const item = data.items[0];
        if (!item || !isAcceptedFile(item.name)) { resolve(null); return; }
        try {
          const downloadUrl = item['@microsoft.graph.downloadUrl'];
          if (downloadUrl) {
            const res = await fetch(downloadUrl);
            const content = await res.text();
            resolve({ name: item.name, content });
          } else if (item.id) {
            // Fallback Graph API
            const res = await fetch(
              `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const content = await res.text();
            resolve({ name: item.name, content });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      } else if (data?.type === 'Cancel') {
        window.removeEventListener('message', messageHandler);
        pickerWindow.close();
        resolve(null);
      }
    };

    window.addEventListener('message', messageHandler);

    // Fallback timeout 5 min
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (!pickerWindow.closed) pickerWindow.close();
      resolve(null);
    }, 300_000);
  });
}

// ─── Dropbox ─────────────────────────────────────────────────────────────────

interface DropboxWindow {
  Dropbox: {
    choose: (opts: {
      success: (files: Array<{ name: string; link: string }>) => void;
      cancel: () => void;
      linkType: string;
      multiselect: boolean;
      extensions: string[];
    }) => void;
  };
}

async function pickDropbox(): Promise<CloudFile | null> {
  if (!DROPBOX_APP_KEY) return null;

  // Charge le SDK Dropbox Chooser de façon lazy
  const winWithDropbox = window as unknown as Partial<DropboxWindow>;
  if (!winWithDropbox.Dropbox) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
      s.setAttribute('id', 'dropboxjs');
      s.setAttribute('data-app-key', DROPBOX_APP_KEY);
      s.onload = () => res();
      s.onerror = () => rej(new Error('Dropbox SDK load failed'));
      document.head.appendChild(s);
    });
  }

  return new Promise(resolve => {
    const dbx = (window as unknown as DropboxWindow).Dropbox;

    dbx.choose({
      success: async (files) => {
        const f = files[0];
        if (!f || !isAcceptedFile(f.name)) { resolve(null); return; }
        try {
          // direct_link : lien téléchargeable direct
          const res = await fetch(f.link.replace('?dl=0', '?dl=1'));
          const blob = await res.blob();
          const content = await readBlobAsText(blob);
          resolve({ name: f.name, content });
        } catch {
          resolve(null);
        }
      },
      cancel: () => resolve(null),
      linkType: 'direct',
      multiselect: false,
      extensions: ACCEPTED_EXTENSIONS,
    });
  });
}

// ─── Box ─────────────────────────────────────────────────────────────────────

async function pickBox(): Promise<CloudFile | null> {
  if (!BOX_CLIENT_ID) return null;

  // Charge Box Content Picker de façon lazy via popup OAuth implicite
  return new Promise(resolve => {
    const popupUrl =
      `https://app.box.com/api/oauth2/authorize` +
      `?response_type=token&client_id=${BOX_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(window.location.origin + '/box-callback')}`;

    const popup = window.open(popupUrl, 'BoxAuth', 'width=600,height=700,toolbar=0');
    if (!popup) { resolve(null); return; }

    const handler = (event: MessageEvent) => {
      if (event.source !== popup) return;
      const data = event.data as { type?: string; token?: string; fileId?: string; fileName?: string };
      if (data?.type === 'box-token' && data.token && data.fileId) {
        window.removeEventListener('message', handler);
        popup.close();
        fetch(`https://api.box.com/2.0/files/${data.fileId}/content`, {
          headers: { Authorization: `Bearer ${data.token}` },
        })
          .then(r => r.text())
          .then(content => resolve({ name: data.fileName ?? 'file.txt', content }))
          .catch(() => resolve(null));
      } else if (data?.type === 'box-cancel') {
        window.removeEventListener('message', handler);
        popup.close();
        resolve(null);
      }
    };
    window.addEventListener('message', handler);
    setTimeout(() => {
      window.removeEventListener('message', handler);
      if (!popup.closed) popup.close();
      resolve(null);
    }, 300_000);
  });
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

async function pickGoogleDrive(): Promise<CloudFile | null> {
  if (!GDRIVE_API_KEY || !GDRIVE_CLIENT_ID) return null;

  // Charge gapi lazy
  const gapiWindow = window as Window & {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
      auth2?: { getAuthInstance: () => { signIn: () => Promise<void>; currentUser: { get: () => { getAuthResponse: () => { access_token: string } } } } };
      client?: { init: (opts: { apiKey: string; clientId: string; scope: string }) => Promise<void> };
      picker?: {
        PickerBuilder: new () => {
          addView: (v: unknown) => unknown;
          setOAuthToken: (t: string) => unknown;
          setDeveloperKey: (k: string) => unknown;
          setCallback: (cb: (data: { action: string; docs: Array<{ name: string; id: string }> }) => void) => unknown;
          build: () => { setVisible: (v: boolean) => void };
        };
        DocsView: new () => unknown;
        Action: { PICKED: string; CANCEL: string };
      };
    };
  };

  if (!gapiWindow.gapi) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('gapi load failed'));
      document.head.appendChild(s);
    });
  }

  return new Promise(resolve => {
    const gapi = gapiWindow.gapi!;
    gapi.load('auth2:picker:client', async () => {
      try {
        await gapi.client!.init({
          apiKey: GDRIVE_API_KEY,
          clientId: GDRIVE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
        });
        await gapi.auth2!.getAuthInstance().signIn();
        const token = gapi.auth2!.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        const picker = new gapi.picker!.PickerBuilder()
          .addView(new gapi.picker!.DocsView())
          .setOAuthToken(token)
          .setDeveloperKey(GDRIVE_API_KEY)
          .setCallback(async (data: { action: string; docs: Array<{ name: string; id: string }> }) => {
            if (data.action === gapi.picker!.Action.PICKED) {
              const doc = data.docs[0];
              if (!doc || !isAcceptedFile(doc.name)) { resolve(null); return; }
              try {
                const res = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                const content = await res.text();
                resolve({ name: doc.name, content });
              } catch {
                resolve(null);
              }
            } else if (data.action === gapi.picker!.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();
        (picker as { setVisible: (v: boolean) => void }).setVisible(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[cloudStorage] Google Drive picker error:', msg);
        resolve(null);
      }
    });
  });
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function pickCloudFile(provider: CloudProviderId): Promise<CloudFile | null> {
  switch (provider) {
    case 'onedrive':          return pickOneDrive(false);
    case 'onedrive-business': return pickOneDrive(true);
    case 'dropbox':           return pickDropbox();
    case 'box':               return pickBox();
    case 'gdrive':            return pickGoogleDrive();
    default:                  return null;
  }
}

export function getProvidersMeta(): CloudProviderMeta[] {
  return [
    {
      id: 'onedrive',
      label: 'OneDrive',
      colorClass: 'text-blue-400',
      available: !!MSAL_CLIENT_ID,
    },
    {
      id: 'onedrive-business',
      label: 'OneDrive Business',
      colorClass: 'text-blue-500',
      available: !!MSAL_CLIENT_ID,
    },
    {
      id: 'dropbox',
      label: 'Dropbox',
      colorClass: 'text-sky-400',
      available: !!DROPBOX_APP_KEY,
    },
    {
      id: 'box',
      label: 'Box',
      colorClass: 'text-blue-300',
      available: !!BOX_CLIENT_ID,
    },
    {
      id: 'gdrive',
      label: 'Google Drive',
      colorClass: 'text-yellow-400',
      available: !!GDRIVE_CLIENT_ID && !!GDRIVE_API_KEY,
    },
  ];
}
