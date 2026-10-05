# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Appliquer EN-ATTENTE §5 à §8 en session déverrouillée (J-048, J-049, J-050)

**Demande d'origine, en une phrase** : « applique EN-ATTENTE §5 à §8 », puis « relance le reviewer
sur l'arbre et commit ».

**Branche** : `harness/en-attente-5-8`, issue de `harness/beton` (`a941268`).

**Hors périmètre explicite** :

- §1 (J-040 lot 1, `npm update`) : réservé à Cédric, hors Claude Code, branche `fix/j-040-npm-audit`.
- `npm run harness:relock` : Cédric le lance hors Claude Code.
- Push et PR : sur demande explicite de Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                             | Comment on le vérifie                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | §5, J-048 : un appel du self-test à une commande inconnue est compté comme un échec, y compris sous Bash 3.2                                          | `command_not_found_handle` et repli 127 ; preuve sur une copie       |
| 2   | §6, J-049 : un Read de `~/.config/gh/hosts.yml` (toutes casses) ou de `~/.ssh/*` est refusé ; un Read ordinaire, harness compris, reste autorisé      | cas `read_guard` et `guard` du self-test ; matcher `Read` du hook    |
| 3   | §7, J-050 : `prettier --write -c <harness>` et `-w -c` refusés ; ESLint `-o`, `--output-file`, `--cache-location` vers le harness refusés             | cas `guard BLOCK` du self-test                                       |
| 4   | §7 : pas de régression de la garde : commandes des capteurs, `prettier --config X --write docs/…`, `eslint -o /tmp/…` autorisés                       | cas `guard ALLOW` du self-test ; stage `check` vert                  |
| 5   | §8, J-050 : le juge `audit` est rouge sur `{}`, `''`, un paquet sévère non traçable, une entrée acceptée mal justifiée ; inchangé sur le vrai rapport | cas hors ligne du self-test ; `check -- --only audit` (rouge, lot 1) |
| 6   | J-048 à J-050 marqués RÉSOLU au journal ; seule l'entrée §1 reste dans `EN-ATTENTE.md`                                                                | relecture                                                            |
| 7   | Aucune régression ; comptes d'assertions à jour (INVENTAIRE, PROGRESS, TODO)                                                                          | `npm run check:harness` : 393 passed, 0 failed (374 avant)           |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric après §5 à §8).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — le rapport `npm audit` est validé (version 2, objet
      `vulnerabilities`, chaîne `via` traçable), TS-004.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md` (J-048 à J-050),
      `INVENTAIRE.md`, `PROGRESS.md`, `TODO.md`.
- [x] ADR : aucune nouvelle décision d'architecture (correctifs du harness dans le cadre d'ADR-016).
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` hors Claude Code.
- [ ] §1 d'`EN-ATTENTE.md` (J-040 lot 1).
- [ ] Push de `harness/en-attente-5-8` et PR, sur sa demande.
