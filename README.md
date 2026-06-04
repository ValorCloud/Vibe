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

### 🤖 Génération IA (Gemini)
- Génération complète ou par section via l'API Gemini
- Suggestions de paroles, de thèmes, d'humeur et de titre
- Régénération ciblée ligne par ligne ou section par section
- Assistant IA vocal intégré (entrée/sortie vocale)

### 🎵 Paramètres musicaux (Vibe Board)
- Sélection de genre, sous-styles, instruments, tempo, humeur
- Constructeur de prompt musical automatique
- Suggestions musicales contextuelles

### 🎼 Génération musicale Lyria
- Génération de clips musicaux IA courts (≤ 30 s) via **Lyria 3 Clip Preview**
- Génération de chansons complètes (jusqu'à 4 min) via **Lyria 3 Pro**
- Nécessite le token `VITE_LYRIA_INTERNAL_TOKEN`

### 📊 Analyse phonologique
- Détection automatique du schéma de rimes (ABAB, AABB…) multilingue
- Analyse de la densité d'assonances et allitérations
- Matrice de similarité phonologique entre les lignes
- Surlignage des rimes en temps réel dans l'éditeur

### 🔊 Lecteur audio VoxNova
- Lecteur local (fichiers importés) avec visualiseur de fréquences
- **Intégration Spotify** (auth PKCE) : lecture, playlists, recherche
- Interface inspirée du design LCARS

### 🌍 Internationalisation
- Interface disponible en **8 langues** : Anglais, Français, Allemand, Espagnol, Portugais, Arabe, Coréen, Chinois
- Adaptation / traduction de paroles par section ou ligne
- Analyse de rimes adaptée à la langue (moteur ROM pour le français, etc.)

### 🛡️ Vérificateur de copyright
- Détection des risques de similarité avec des œuvres existantes

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

3. Configurer les variables d'environnement :

   | Variable | Obligatoire | Description |
   |---|---|---|
   | `VITE_GEMINI_API_KEY` | ✅ | Clé API Google Gemini (génération de paroles) |
   | `VITE_LYRIA_INTERNAL_TOKEN` | — | Token Lyria pour la génération musicale IA |
   | `VITE_SPOTIFY_CLIENT_ID` | — | Client ID Spotify pour l'intégration lecteur |
   | `VITE_MSGRAPH_CLIENT_ID` | — | Client ID Azure AD pour OneDrive |
   | `VITE_GDRIVE_API_KEY` / `VITE_GDRIVE_CLIENT_ID` | — | Google Drive |
   | `VITE_DROPBOX_APP_KEY` | — | Dropbox |
   | `VITE_BOX_CLIENT_ID` | — | Box |

   > La clé Gemini est lue côté client via `VITE_GEMINI_API_KEY`. Pour un déploiement public, préférez un proxy serverless (voir section Vercel ci-dessous).

## Démarrage local

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

Le serveur est lancé avec `--host=0.0.0.0`, donc vous pouvez aussi y accéder depuis un autre appareil du même réseau local avec l'URL **Network** affichée par Vite (par ex. `http://192.168.x.x:3000`).

## Déploiement sur Vercel (recommandé pour la production)

Ce projet inclut un endpoint serverless (`/api/generate`) qui agit comme proxy sécurisé vers l'API Gemini.
La clé API n'est **jamais** transmise au navigateur.

### Étapes

1. Poussez votre dépôt sur GitHub (branche `main`).
2. Importez le projet dans [Vercel](https://vercel.com/new).
3. Ajoutez vos variables d'environnement dans **Settings → Environment Variables** :

   | Nom | Description |
   |---|---|
   | `VITE_GEMINI_API_KEY` | Clé API Gemini |
   | `VITE_LYRIA_INTERNAL_TOKEN` | Token Lyria (optionnel) |
   | `VITE_SPOTIFY_CLIENT_ID` | Client ID Spotify (optionnel) |

4. Déployez. Vercel détecte automatiquement Vite comme framework.

> ⚠️ **GitHub Pages** expose les clés injectées au build dans le bundle JS.  
> Pour une configuration sécurisée en production, utilisez **Vercel** avec le proxy `/api/generate` décrit ci-dessus.

## Dépannage (localhost refusé)

Si votre navigateur affiche `localhost refused to connect` :

1. Vérifiez que le serveur est bien lancé (`npm run dev`) et qu'il reste actif dans le terminal.
2. Utilisez l'URL exacte affichée par Vite :
   - `Local: http://localhost:3000/` (même machine)
   - `Network: http://<ip>:3000/` (WSL/Docker/VM ou autre appareil du LAN)
3. Si vous exécutez le code dans un conteneur distant (Codespaces, VM, serveur), `localhost` du navigateur ne pointe pas ce conteneur : utilisez l'URL de port-forwarding de votre plateforme.

## Scripts utiles

- `npm run dev` : serveur de développement Vite
- `npm run build` : build de production
- `npm run preview` : prévisualisation locale du build
- `npm run lint` : ESLint + TypeScript
- `npm test` : lance la suite Vitest
- `npm run test:coverage` : tests + rapport de couverture lcov

## Stack

- **React 19** + **Vite 6**
- **Fluent UI 2** (`@fluentui/react-components`)
- **Tailwind CSS 4**
- **Motion** (animations)
- **Google Gemini** (`@google/genai`) via proxy serverless (`/api/generate`)
- **Lyria 3** (génération musicale IA)
- **Spotify Web API** (PKCE auth)
- **Zod** (validation de schémas)
- **fflate** (compression pour l'export/import)
- **Vitest** + **Testing Library** (tests unitaires)
