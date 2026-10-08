# ADR-016 : Le harness est une frontière de confiance

Date : 2026-09-26
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

Le harness d'agent (hooks Claude Code, hooks git, lint, archi, tests, contraste, doc) vérifie le
travail d'un agent de code. Un audit red-team du 2026-09-26 a montré qu'il **ne tenait que par la
bonne volonté de l'agent qu'il surveillait**.

- **Il pouvait être réécrit par l'agent.** Une seule commande `sed -i` a désactivé cinq capteurs,
  sans qu'aucun ne réagisse (JOURNAL J-029).
- **Il pouvait être contourné.** `git push --no-verify` était pré-approuvé par les permissions
  utilisateur. Il n'y avait aucune CI et `develop` n'était pas protégée (J-030).
- **Ses consignes n'étaient que déclaratives.** Rien n'obligeait à passer par le reviewer, ni à
  finir un tour sur un arbre vert (J-034).

Un capteur que le sujet mesuré peut désactiver n'est pas un capteur.

## Décision

Le harness est traité comme une **frontière de confiance**, organisée en quatre couches. Chacune
suppose que la précédente peut tomber.

1. **Refus à la source, local.**
   - Les gardes `PreToolUse` Bash et Edit n'autorisent l'écriture que dans les **zones produit**
     (`harness_paths.PRODUCT_ZONES` : `src/`, `docs/`, `ios/`, `android/`, `functions/`…). Tout le
     reste est du harness par défaut : dotfiles, configs d'outils, `package.json` et lockfiles,
     tout fichier inconnu. S'y ajoutent les fichiers listés dans `scripts/harness-protected.txt`
     (J-045). Les chemins sont comparés sans tenir compte de la casse, comme les compare APFS, et
     `CLAUDE.md` est du harness : ce fichier pilote l'agent (J-046).
   - Ils refusent aussi les commandes destructrices et les contournements des hooks git.
   - Les permissions du projet mettent `git commit`, `git push` et `gh pr merge` en `ask`.
2. **Détection de ce qui aurait échappé.**
   - `scripts/harness.lock` hashe chaque fichier du harness, `package.json` entier compris.
   - Toute dérive rend le capteur `lock` rouge : au Stop, au pre-push et en CI.
   - Le verrou n'est rafraîchi que par Cédric, dans un terminal interactif et hors Claude Code
     (`npm run harness:relock`).
3. **Obligation de processus.**
   - Le hook `Stop` refuse la fin d'un tour sur un arbre rouge.
   - Un commit fait depuis Claude Code exige un verdict `APPROVED` du reviewer, scellé par un hook
     sur l'arbre exact commité.
4. **Rempart côté serveur.**
   - `.github/workflows/check.yml` rejoue la batterie complète, sans abstention possible.
   - `main` et `develop` exigent une PR et les checks `battery`, `security` et `harness-guard`,
     administrateurs compris.
   - Une PR qui touche le harness exige le label `harness-change`, posé par Cédric.

**Une seule table de capteurs** (`scripts/sensors.sh`) alimente `npm run check`, le Stop, le
pre-push et la CI. Les quatre ne peuvent plus diverger.

## Conséquences

### Positives

- Tous les contournements de l'audit red-team (J-026 à J-035) sont rejoués au self-test
  (`npm run check:harness`) et bloqués. La revue du harness v2 en a trouvé d'autres (J-036 à J-041),
  corrigés le 2026-09-28 sauf J-040 : voir « Historique de mise en œuvre ».
- La règle personnelle de Cédric, « pas de commit ni de push sans demande explicite », devient
  mécanique.
- Toute évolution du harness est visible : diff du verrou, label, journal.

### Négatives

- **Faire évoluer le harness demande Cédric.** Il lance une session avec `MIVRO_HARNESS_UNLOCK=1`,
  puis rafraîchit le verrou. L'agent ne peut plus corriger seul un capteur défaillant : il le
  décrit.
- **Tout passe par une PR**, y compris sur `develop`. La branche doit être à jour avant le merge.
- **Chaque nouvelle dépendance npm est une décision explicite**
  (`scripts/allowed-dependencies.json`).

### Limites assumées

- Les gardes locaux restent des ralentisseurs : un script écrit dans `/tmp` puis exécuté leur
  échappe. Le rempart est la couche 4.
- Un token GitHub avec la permission Administration permettrait encore de lever la protection de
  branche. Durcissement recommandé : des sessions Claude avec un token _fine-grained_ sans cette
  permission.
- Deux comportements de Claude Code sur lesquels repose ce dispositif ne sont pas documentés :

  - **l'héritage de l'environnement par les hooks**, nécessaire au déverrouillage. Il est
    **constaté** le 2026-09-28 : une session lancée avec `MIVRO_HARNESS_UNLOCK=1` peut éditer le
    harness.
  - **les champs `agent_type` et `last_assistant_message`** de `SubagentStop`, et l'événement
    `SubagentStart`, nécessaires au scellement. Ils sont **vérifiés dans le binaire** 2.1.283. Leur
    déclenchement réel se confirme à la première revue.

  Dans les deux cas, l'échec est fermé : le harness reste verrouillé, ou le commit est refusé.

- Une mise à jour de Claude Code peut changer ces champs. Si elle le fait, le sceau n'est plus
  posé et les commits de l'agent sont refusés : on le voit tout de suite, rien ne passe en
  silence.

### Historique de mise en œuvre

- **2026-09-26** — La revue du harness v2 trouve deux défauts qui font tomber une couche entière :

  - `harness-guard` exécute le code de la PR qu'il juge (J-036) ;
  - un verdict `APPROVED` déposé par l'agent principal peut être scellé (J-037).

  Elle trouve aussi des trous plus locaux (J-038, J-039, J-041).

- **2026-09-28** — Tous sont corrigés en session déverrouillée :

  - `harness-guard` passe sous `pull_request_target` et ne lit que la base ;
  - le verdict est lu dans le dernier message du reviewer ;
  - le garde Bash est réécrit ;
  - `check-diff` refuse les configs imbriquées et échoue fermé.

  Reste ouvert : J-040 (`npm audit`), à traiter dans une branche dédiée, et J-047 (casse du chemin
  absolu). Le verrou initial est généré le 2026-10-05.

## Alternatives écartées

- **Tout interdire par `permissions.deny` sur les chemins du harness.** C'est plus simple, mais cela
  ne peut pas se lever pour une session de maintenance, et cela ne détecte pas ce qu'un script
  aurait modifié.
- **Exiger une approbation de PR.** Impossible en mainteneur unique, puisque GitHub refuse
  l'auto-approbation. Le geste humain retenu est le merge, plus le label pour le harness.
