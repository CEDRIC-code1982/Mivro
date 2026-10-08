# EN ATTENTE — changements du harness à appliquer en session déverrouillée

> Le harness protège ses propres fichiers (ADR-016). Quand l'agent trouve un défaut dans l'un
> d'eux, il ne le corrige pas : il le décrit ici, avec le changement exact. Cédric l'applique
> depuis une session `MIVRO_HARNESS_UNLOCK=1 claude`, puis lance `npm run harness:relock`.
> Une entrée appliquée est supprimée de ce fichier dans le même commit.

---

**Historique.** Les constats de l'audit (J-026 à J-035) et des deux revues (J-036 à J-042) ont
tous été appliqués : le 2026-09-28, puis le 2026-10-01 en session déverrouillée. Le détail est dans
`JOURNAL-ECHECS.md`. Les capteurs de J-043 à J-046 sont appliqués aussi ; le self-test de J-046 et le formatage
de `check-deps.js` ont été posés par Cédric le 2026-10-05, avec le premier verrou. Les points 2 à 4
(garde `prettier --config`, J-047, capteur `audit` à avis acceptés) ont été appliqués le 2026-10-05
en session déverrouillée. Les points 5 à 8 (J-048 à J-050) l'ont été le 2026-10-05 aussi, en
session déverrouillée. Les points 2 et 4 (J-051 : trap `ERR` du self-test, juge `audit` sur `[]`)
l'ont été le 2026-10-05 aussi. Le point 1 (J-040, lots 1 et 1 bis) est fait le 2026-10-08. Les points 3 (sandbox Bash, J-051)
et 4 et 5 (J-052, première CI) ont été appliqués le 2026-10-08 en session déverrouillée, avec trois
correctifs que le sandbox a imposés au harness (`mktemp` et `/dev/fd`, voir J-051). Il reste à Cédric
la clé utilisateur `allowUnsandboxedCommands: false` (ancien point 3, étape 2), hors du dépôt. Elle a été posée le 2026-10-08.
Les points 6 (J-053 : le self-test n'écrit plus l'historique) et 7 (J-054 : GitHub refusé au réseau
du sandbox, quatre routes du trousseau refusées) ont été appliqués le 2026-10-08 en session
déverrouillée. Il reste à Cédric le jeton GitHub à privilèges réduits, hors du dépôt (TODO).

## À appliquer en session déverrouillée

### 1. Sonde réseau du self-test : un contrôle positif (14e revue, mineur)

La sonde J-054 (`curl https://api.github.com`, section sandbox) passe au vert sur **tout** échec de
`curl`. Hors ligne, ou avec un DNS en panne, elle conclut donc « refusé » sans rien prouver. C'est
la leçon de J-053 : un contrôle doit distinguer une sonde qui marche d'une préparation cassée. Dans
`scripts/harness-selftest.sh`, juste avant la sonde :

```bash
  # Positive control: the network itself works, so a failure below is the deny list (J-054).
  if ! curl -s -o /dev/null --max-time 5 https://registry.npmjs.org/-/ping 2>/dev/null; then
    bad "network probe control failed: registry.npmjs.org unreachable, the GitHub probe proves nothing"
  elif curl -s -o /dev/null --max-time 5 https://api.github.com 2>/dev/null; then
```

(la branche `bad "the sandbox lets a call out to api.github.com (J-054)"` et le `else ok …` restent
inchangés). `registry.npmjs.org` répond 200 sous sandbox (constaté le 2026-10-08).
