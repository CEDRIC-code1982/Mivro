# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : TODO réaligné sur le code, et libellé du marker midpoint traduit (I18N-002)

**Demande d'origine** : « Fait 1 et 2 ». C'est la reco du point d'après la PR #8, validée ligne par
ligne :

- corriger le libellé de la couverture (seuils par couche) ;
- corriger le chemin `src/services/infra/{eta,analytics}` ;
- corriger la ligne du libellé en dur et traiter le défaut I18N-002 ;
- garder ouverte la ligne « Première CI » (J-048).

**Branche** : `fix/todo-et-libelle-poi`, issue de `chore/menage-apres-lot-5` (`7319d42`, mergée par
la PR #8).

**Hors périmètre explicite** :

- Les autres libellés d'accessibilité non traduits, construits à partir de données (par exemple la
  catégorie brute dans `` `${poi.name}, ${poi.category}` ``). C'est une autre tâche.
- Remettre ce fichier à son modèle vierge (volet « contrat périmé » de J-022).
- Le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                             | Comment on le vérifie                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Aucun `accessibilityLabel` littéral ne subsiste dans `src/` hors tests                                                                                                                | `grep -rn 'accessibilityLabel="[^"]*[a-zA-Z]' src --include='*.tsx'` vide |
| 2   | Le marker midpoint de `POIMapView` passe par `t('mapView.midpointMarker')` (namespace `poi`), celui de `SessionMapView` par `t('markers.midpoint')` (namespace `map`), en FR et en EN | lecture du diff, `locales.parity.test.ts` vert                            |
| 3   | Un test par composant vérifie le libellé traduit du marker midpoint, et échoue si la clé est fausse (le mock renvoie la clé brute)                                                    | `npx jest POIMapView SessionMapView`                                      |
| 4   | Les trois lignes du TODO collent au code : seuils de `jest.config.js`, chemin `src/services/infra/`, libellé corrigé dans les deux composants ; « Première CI » reste ouverte         | lecture du diff de `TODO.md`                                              |
| 5   | Les commentaires des deux fichiers de test touchés sont tous en anglais ; aucun fichier du harness ne change                                                                          | lecture, `npm run check` (`lock` vert sans relock)                        |

---

## Socle systématique

- [x] `npm run check` vert (12 capteurs).
- [x] Les trois états rendus pour chaque écran touché : sans objet, seuls des libellés changent.
- [x] Toute donnée externe validée : sans objet.
- [x] Toute string affichée passe par `useTranslation()`, props incluses : c'est l'objet de la tâche.
- [x] Docs de contexte mises à jour : `TODO.md`.
- [x] ADR : aucune.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Push de `fix/todo-et-libelle-poi`, PR vers `develop`, merge si la CI est verte.
- [ ] Avec VoiceOver, vérifier que le marker midpoint annonce « Point de rencontre » (FR) ou
      « Meeting point » (EN).
