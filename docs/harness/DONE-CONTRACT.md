# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : <titre court>

**Demande d'origine** : « <la demande, citée> »

**Branche** : `<branche>`, issue de `<base>`.

**Hors périmètre explicite** :

- <ce qui n'est pas fait, et qui le fera>

---

## Conditions de fin

| #   | Condition   | Comment on le vérifie |
| --- | ----------- | --------------------- |
| 1   | <condition> | <commande ou preuve>  |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché.
- [ ] Toute donnée externe validée par un schéma Zod.
- [ ] Toute string affichée passe par `useTranslation()`.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] <action hors de portée de l'agent>
