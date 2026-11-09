# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : `CLAUDE.md` sous le refus d'écriture du sandbox, suite de J-064

**Demande d'origine** : « On suit tes recommandations », après la revue de J-064 (`86cbb90`) :
protéger `CLAUDE.md` au noyau comme le reste de la liste, noter en suggestion les capteurs proposés
par la revue, et corriger ses deux imprécisions mineures.

**Branche** : `harness/finition-lots-a-e`, après `86cbb90`, avant le relock et le push.

**Hors périmètre explicite** :

- `.git/`, `package.json`, `package-lock.json` restent écrivables (S2) ; `.claude/` est déjà protégé
  par Claude Code (S3).
- EN-ATTENTE §5 (masquage d'une commande destructive) et §7 (détection textuelle de
  `check-scripts`) : non couverts par le sandbox, laissés en limites (S8).
- Le relock, le push, la PR : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                         | Comment on le vérifie                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `CLAUDE.md` et `CLAUDE.local.md` sont dans `scripts/harness-protected.txt` et refusés en écriture au sandbox ; un `CLAUDE.md` créé dans un sous-dossier l'est aussi si le sandbox accepte un motif, sinon c'est une limite nommée | sonde `touch` ; self-test (config = liste) |
| 2   | Le self-test prouve, sous le sandbox, le refus d'écrire `CLAUDE.md`                                                                                                                                                               | self-test                                  |
| 3   | J-064, EN-ATTENTE et INVENTAIRE ne citent plus `CLAUDE.md` parmi les chemins non couverts ; « plus les variantes Babel » devient « y compris » ; le RUNBOOK cite aussi `unable to create file`                                    | relecture, `docrefs`, `docclaims`          |
| 4   | Les capteurs proposés par la revue de J-064 sont notés en suggestion, non implémentés                                                                                                                                             | relecture de `TODO.md`                     |

---

## Socle systématique

- [ ] `npm run check` vert (`lock` s'abstient en session déverrouillée, relock à Cédric).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché : aucun écran.
- [x] Toute donnée externe validée par un schéma Zod : sans objet.
- [x] Toute string affichée passe par `useTranslation()` : aucune string.
- [ ] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md`, `INVENTAIRE.md`, `TODO.md`.
- [x] ADR si décision d'architecture : ADR-016 couvre la protection du harness.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] `npm run harness:relock` hors Claude Code, push, PR, fusion.
- [ ] Si le sandbox ne se recharge pas en cours de session : la sonde de la condition 2 dans une
      session neuve.
