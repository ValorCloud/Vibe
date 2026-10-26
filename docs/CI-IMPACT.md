# Vérification proportionnée aux changements

Décision du propriétaire du 26 octobre 2026 : éviter les tests sans rapport avec un correctif, puis appliquer ce principe à tous les projets. La sélection porte sur le diff Git cumulé, jamais le titre, le label ou le numéro de patch. Le sélecteur est `.github/ci/impact.py`, ses régressions `.github/ci/test_impact.py`.

## Règles communes

Comparer le before/after complet d'un push ou le merge-base/base-head d'une PR, avec historique Git complet. Fichier supprimé, renommé, binaire, dépendance, script de build/CI, chemin inconnu, base absente/invalide : suite complète. Une exécution manuelle conserve la suite complète. Avant toute réduction en CI, le SHA de base doit avoir une exécution réussie du même workflow ; absence de preuve ou API indisponible revient à full. Le résumé Actions indique le profil et les références comparées. Ne jamais utiliser un test sauté comme preuve d'exécution.

Les chemins de documentation opérationnelle explicitement listés constituent le profil metadata. Tous les autres documents restent non classés, car certains sont des entrées du produit. Une modification mêlant plusieurs composants reprend la suite complète. Les tests de sélection sont exécutés avant toute réduction.

## Application dans ce dépôt

Les changements limités aux consignes/registre de continuité évitent installation, build, tests et navigateurs. Les changements applicatifs conservent les suites et la matrice multi-navigateurs. Le titre ou message [skip bump] ne permet plus de contourner le smoke test. Les styles partagés ne justifient pas de retirer les navigateurs sans couverture plus précise.

## Validation et reprise

Contribution sur branche codex/ci-impact-20261026, préparée depuis main et distincte des PR de doctrine déjà ouvertes. Tests comportementaux du sélecteur exécutés localement ; la CI GitHub du commit candidat est une preuve séparée. Les copies locales sont des fichiers de source récupérés via API, pas un checkout complet capable de reconstruire les applications. Aucun résultat de build produit local ni nouveau déploiement n'est revendiqué.

Étape suivante : consulter la CI exacte de la PR, traiter ses éventuels échecs, puis intégrer selon le workflow du projet. La modification de la CI elle-même sélectionne full pour son premier contrôle. La durée du circuit court doit ensuite être mesurée sur une modification admissible ; aucune durée cible n'est attestée à l'avance. Conserver les autres travaux, recettes métier et limites existantes.
