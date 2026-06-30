<div align="center">
  <img width="1200" height="475" alt="Lyricist Pro banner" src="docs/Lyricist_Splash_Medium.png" />
</div>

# Lyricist Pro

[![Tests](https://github.com/EmmanuelKerhoz/Vibe/actions/workflows/test.yml/badge.svg)](https://github.com/EmmanuelKerhoz/Vibe/actions/workflows/test.yml)

**Lyricist Pro** est un assistant de composition de chansons alimenté par l'IA, conçu pour les auteurs-compositeurs et les poètes. Il combine un éditeur de paroles professionnel, une analyse phonologique avancée, une génération musicale IA et un lecteur audio intégré.

## Fonctionnalités

### ✍️ Éditeur de paroles
- **4 modes d'édition** : Section (éditeur structuré), Texte libre, Markdown et Phonétique (transcription IPA)
- Structure de chanson par sections (couplet, refrain, pont…) avec drag & drop pour réorganiser
- Undo/Redo illimité, auto-save via OPFS (stockage privé du navigateur)
- Quantization syllabique par ligne ou globale
- Gestion de versions des paroles

### 🤖 Génération IA
- Génération complète ou par section via proxy serverless (`api/generate.ts`)
- Supporte **Gemini** (défaut), **OpenAI** et **Anthropic** — sélectionnable via `AI_PROVIDER`
- Suggestions de paroles, de thèmes, d'humeur et de titre
- Régénération ciblée ligne par ligne ou section par section
- Assistant IA vocal intégré (entrée/sortie vocale)

### 🎵 Paramètres musicaux (Vibe Board)
- Sélection de genre, sous-styles, instruments, tempo, humeur
- Constructeur de prompt musical automatique
- Suggestions musicales contextuelles

### 🎼 Génération musicale IA
- **Lyria 3** : clips courts (≤ 30 s) via _Clip Preview_ et chansons complètes (jusqu'à 4 min) via _Lyria 3 Pro_
- **Suno** : génération et extension de chansons via proxy Evolink ou proxy local

### 📊 Analyse phonologique
- Détection automatique du schéma de rimes (ABAB, AABB…) multilingue (17 algorithmes)
- Analyse de la densité d'assonances et allitérations
- Matrice de similarité phonologique entre les lignes
- Surlignage des rimes en temps réel dans l'éditeur
- Métronome intégré

### 🔊 Lecteur audio VoxNova
- Lecteur local (fichiers importés) avec visualiseur de fréquences
- **Intégration Spotify** (auth PKCE) : lecture, playlists, recherche
- Interface inspirée du design LCARS

### 🌍 Internationalisation
- Interface disponible en **8 langues** : Anglais, Français, Allemand, Espagnol, Portugais, Arabe, Coréen, Chinois
- Adaptation / traduction de paroles par section ou ligne
- Analyse de rimes adaptée à la langue

### 🛡️ Vérificateur de copyright
- Détection des risques de similarité avec des œuvres existantes (Genius)
- 4 stratégies : exacte, fuzzy, structurelle, sémantique + score de risque

### 📤 Import / Export & Partage
- Import depuis le presse-papier, fichier texte ou stockages cloud (OneDrive, Google Drive, Dropbox, Box)
- Export des paroles ou du prompt musical
- Partage de chanson via URL (hash encodé)

### 🖥️ Expérience utilisateur
- Thèmes clair / sombre, échelle d'interface configurable (S/M/L)
- Raccourcis clavier documentés
- Interface responsive (desktop & mobile/tablette)
- Application web progressive (PWA) installable

---

## Prérequis

- Node.js 18+
- npm
- Une clé API Gemini (obligatoire pour la génération IA)

## Installation

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer un fichier `.env.local` à partir de `.env.example`.

3. Configurer les variables d'environnement (voir tableau complet dans `.env.example`) :

   **Client-side (`.env.local` — `VITE_` prefix)**

   | Variable | Obligatoire | Description |
   |---|---|---|
   | `VITE_LYRIA_INTERNAL_TOKEN` | — | Token d'auth Lyria (doit correspondre à `LYRIA_INTERNAL_TOKEN` côté serveur) |
   | `VITE_SPOTIFY_CLIENT_ID` | — | Client ID Spotify pour l'intégration lecteur |
   | `VITE_SUNO_MODE` | — | Mode Suno : `evolink` \| `dev` \| vide (désactivé) |
   | `VITE_MSGRAPH_CLIENT_ID` | — | Client ID Azure AD pour OneDrive |
   | `VITE_GDRIVE_API_KEY` / `VITE_GDRIVE_CLIENT_ID` | — | Google Drive |
   | `VITE_DROPBOX_APP_KEY` | — | Dropbox |
   | `VITE_BOX_CLIENT_ID` | — | Box |
   | `VITE_PHONEMIZE_ENABLED` | — | `true` pour activer le microservice Python G2P |
   | `VITE_PHONEMIZE_API_URL` | — | URL du microservice phonemize |

   **Server-side (Vercel dashboard uniquement — ne pas mettre dans `.env.local`)**

   | Variable | Obligatoire | Description |
   |---|---|---|
   | `GEMINI_API_KEY` | ✅ | Clé API Google Gemini (proxy `api/generate.ts`) |
   | `GOOGLE_GENAI_API_KEY` | ✅ | Clé Google GenAI pour Lyria (`api/lyria/generate.ts`) |
   | `LYRIA_INTERNAL_TOKEN` | ✅ si Lyria activé | Token de validation interne Lyria |
   | `AI_PROVIDER` | — | Provider IA : `gemini` (défaut) \| `openai` \| `anthropic` |
   | `AI_MODEL` | — | Override du modèle (ex: `gpt-4o`, `claude-opus-4-5`) |
   | `OPENAI_API_KEY` | — | Requis si `AI_PROVIDER=openai` |
   | `ANTHROPIC_API_KEY` | — | Requis si `AI_PROVIDER=anthropic` |
   | `GENIUS_ACCESS_TOKEN` | — | Token Genius pour le vérificateur de copyright |
   | `SUNO_MODE` | — | `evolink` \| `dev` |
   | `EVOLINK_API_KEY` | — | Requis si `SUNO_MODE=evolink` |
   | `SUNO_DEV_URL` | — | Requis si `SUNO_MODE=dev` |
   | `SUNO_COOKIE` | — | Requis si `SUNO_MODE=dev` |
   | `UPSTASH_REDIS_REST_URL` | — | Rate limiting distribué (Upstash Redis) |
   | `UPSTASH_REDIS_REST_TOKEN` | — | Rate limiting distribué (Upstash Redis) |
   | `RATE_LIMIT_MAX` | — | Requêtes max par fenêtre (défaut: 60) |
   | `RATE_LIMIT_WINDOW_MS` | — | Fenêtre de rate limit en ms (défaut: 60000) |

   > ⚠️ **Important** : Ne jamais utiliser `VITE_GEMINI_API_KEY`. La clé Gemini est lue
   > **exclusivement côté serveur** via `GEMINI_API_KEY` dans les fonctions Vercel.
   > Un préfixe `VITE_` exposerait la clé dans le bundle JS public.

## Démarrage local

```bash
npm run dev
```

Application disponible sur `http://localhost:5173`.

Pour tester les fonctions serverless localement :

```bash
npm i -g vercel
vercel dev
```

Application disponible sur `http://localhost:3000`.

## Tests

```bash
npm test
```

161 fichiers de test, 2 067 tests unitaires et d'intégration.

## Déploiement Vercel

1. Connecter le dépôt à Vercel
2. Dans **Project → Settings → Environment Variables**, ajouter les variables **server-side** du tableau ci-dessus (sans préfixe `VITE_`)
3. Dans le même panneau, ajouter les variables **client-side** avec leur préfixe `VITE_`
4. Déclencher un redéploiement

## Architecture backend (Phonemize)

Un microservice Python FastAPI G2P optionnel est disponible dans `api/phonemize/`. Il est exclu du build Vercel (`.vercelignore`) et doit être déployé séparément (ex: Railway, Fly.io). Voir `api/phonemize/README.md` pour les instructions de déploiement.

## Licence

MIT

