export interface AudienceConfig {
  schemaVersion: 1;
  enabled: boolean;
  privacyReviewed: boolean;
  key: string;
  projectId: string;
  kind: 'app' | 'site';
  hosts: string[];
  appPaths?: string[];
  privacyPath: string;
}
export interface AudienceStatus {
  configured: boolean; eligible: boolean; decision: 'unknown' | 'granted' | 'denied'; active: boolean; reloadRequired: boolean;
}
export interface AudienceApi {
  status(): AudienceStatus;
  setConsent(value: 'granted' | 'denied'): boolean;
  track(name: string): boolean;
  subscribe(listener: (status: AudienceStatus) => void): () => void;
}
export function createAudience(config: AudienceConfig, environment: Window): AudienceApi;
export function mountAudience(config: AudienceConfig, environment: Window): AudienceApi;
