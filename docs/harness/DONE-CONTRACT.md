# DONE-CONTRACT — condition de « terminé »

> **À remplir AVANT d'écrire la première ligne de code.** Une tâche sans condition de fin écrite
> n'est pas commencée : sans définition de « terminé », ni l'agent ni le reviewer ne peuvent
> juger le résultat, et « ça marche chez moi » devient le seul critère.
>
> Le subagent `reviewer` lit ce fichier en premier. S'il le trouve vide ou non rempli pour la
> tâche en cours, il rend `VERDICT: NO_CONTRACT` et s'arrête.
>
> Un seul contrat actif à la fois. En fin de tâche, le contrat rempli part dans le message de
> commit (ou dans `docs/context/PROGRESS.md`), puis ce fichier est remis à son modèle vierge.

---

## Tâche

**Titre** : <!-- ex: F6 — Auth Google / Apple -->

**Demande d'origine, en une phrase** : <!-- ce que Cédric a réellement demandé, pas ta reformulation -->

**Hors périmètre explicite** : <!-- ce que tu ne feras PAS, pour éviter que ça revienne en review -->

---

## Conditions de fin

Chaque ligne doit être **vérifiable par quelqu'un qui n'a pas écrit le code**. Une condition
qu'on ne peut pas cocher avec une preuve n'est pas une condition, c'est un vœu.

| #   | Condition | Comment on le vérifie (commande, fichier:ligne, manip device) |
| --- | --------- | ------------------------------------------------------------- |
| 1   |           |                                                               |
| 2   |           |                                                               |
| 3   |           |                                                               |

### Formulations à éviter

| ✗ Non vérifiable          | ✓ Vérifiable                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| « le partage fonctionne » | « `mivro://session/<id>` ouvre JoinSessionScreen et ajoute le membre dans RTDB — vérifié via `xcrun simctl openurl` »          |
| « c'est testé »           | « `SearchPOIUseCase.test.ts` couvre les 4 codes d'erreur du port ; `npm run test:coverage` ≥ 90 % sur `services/domain/poi/` » |
| « l'a11y est bonne »      | « VoiceOver annonce le libellé et le hint des 3 boutons de l'écran ; touch target mesuré ≥ 48dp »                              |
| « pas de régression »     | « `npm run check` vert, et les 4 tests d'intégration existants passent sans modification »                                     |

---

## Socle systématique

Ces lignes valent pour **toute** tâche : à confirmer, pas à recopier.

- [ ] `npm run check` vert (typecheck + lint + format + `check:arch` + `check:diff` + tests).
- [ ] Les trois états rendus pour chaque écran ou état async touché : loading, error, empty (ERR-003).
- [ ] Toute donnée externe (réseau, storage, deep link, SDK natif) validée par un schéma Zod (TS-004).
- [ ] Toute string affichée passe par `useTranslation()`, **props incluses** (I18N-002).
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md` si nouveau pattern.
- [ ] ADR écrit si une décision d'architecture a été prise (DOC-003).
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

À remplir dès qu'un blocker externe apparaît, plutôt qu'en fin de tâche.

- [ ] <!-- ex: déployer les rules RTDB étendues (`firebase deploy --only database`) -->
- [ ] <!-- ex: test device Face ID + fallback passcode -->

---

## Hypothèses prises

Ce que tu as tranché seul faute de spec. Si une hypothèse est fausse, le travail est à refaire :
autant qu'elle soit écrite ici que découverte en review.

- <!-- ex: le lien de partage expire à 24h pour un guest (aligné sur POLICIES.md > RGPD) -->
