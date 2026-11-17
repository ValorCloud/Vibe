# Barre d’état Vibe — 17 novembre 2026

Base : `5b3023dc20d0ef3f8b0edf8fffe31a37309054dd`.
Contrôle partagé : [ValorCloud/brand, commit 97266a2](https://github.com/ValorCloud/brand/blob/97266a2a4056bf964771b10b422b2205101c0921/themes/celestial/configuration/controls.mjs), intégré par la PR brand #39.

La barre conserve les KPI métier de Vibe à gauche et rassemble les préférences à droite : zoom réel avec cinq choix au survol, plein écran natif de l’application, langue à deux lettres avec drapeau, thèmes Light/Dark disponibles, version, pause des animations et audio d’interface en dernière position. Le lecteur musical et le métronome gardent leurs commandes propres. La présentation LCARS reste celle de Vibe.

Les préférences de zoom, de pause et d’audio sont personnelles et persistantes. Un nouveau réglage de zoom démarre à 100 % ; il s’applique une seule fois à l’espace de travail, en conservant le réglage historique small/medium/large de police. La barre et la navigation mobile conservent leurs cibles de 44 px. Le mouvement réduit du système reste prioritaire ; les animations CSS et les transitions Motion du shell respectent la pause, sans interrompre les opérations métier.

Validation locale :

- Suite Vitest complète : 167 fichiers, 2 160 tests réussis ; vérification ciblée finale des commandes et préférences : 35 tests réussis. Un menu ouvert reste ouvert lors d’un changement de callback et invoque la dernière callback à la sélection.
- ESLint, typecheck application et API, build de production, tests de sélection CI et comparaison des octets du moteur partagé réussis.
- Recette Chromium sur le build de production : trois scénarios réussis (1440 px anglais, 390 px français, 320 px arabe). Vérification des cinq zooms 50–150 %, hover, clavier, Échap/focus, persistance après rechargement, modes clair/sombre et absence de déplacement de la barre à l’ouverture des listes.
- Plein écran natif et sortie vérifiés sur ordinateur en conservant le zoom ; mouvement réduit système et reprise de la préférence personnelle vérifiés. Audio à droite également en RTL, commandes tactiles de 44 × 44 px et navigation mobile préservées.

Captures après passage en Light à 150 %, pause active et audio d’interface coupé : [ordinateur](desktop-en.png), [mobile français](mobile-fr.png), [mobile arabe](mobile-ar.png).

État de ce reçu : source et recette locales. Aucune publication de production attestée ici. La version de production suit le workflow `version-bump.yml` existant ; la version 1.41.0.4 affichée sur ces captures est celle de la base testée.
