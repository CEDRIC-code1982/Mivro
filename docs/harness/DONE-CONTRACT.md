# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Correctif iOS SDK 27 (cycle de vie UIScene + cibles de déploiement des Pods)

**Demande d'origine** : « Voici le message d'erreur. […] Je pense que c'est dû à la montée du SDK en
27 de iOS » (cibles de déploiement 12.0, 9.0, 11.0, 12.4 refusées), puis « l'app bloque sur le
splashscreen, j'ai compil avec xcode » et le log « UIScene life cycle is required for apps built
with this SDK » ; « Ok, on suit ta reco, applique-le ».

**Branche** : `fix/ios-sdk-27`, issue de `develop` (ad43859).

**Hors périmètre explicite** :

- Tests sur appareil de la scène reconnectée (non déclenchable à la demande) et de la pile temps
  réel : reportés. Le report du 2026-11-23 (« On fera les tests plus tard mais ca compile sur iOS »)
  couvrait aussi les liens `mivro://` à froid et à chaud, faits depuis : iPhone 13 le 2026-11-23,
  iPad le 2026-11-26.
- Android : partie native non touchée, le SDK iOS 27 ne la concerne pas. Le `getInitialURL` JS de
  `linking.ts` (J-066) s'y applique aussi ; le lien à froid Android reste à tester sur appareil
  (TODO F5).
- La règle du capteur `native` proposée en J-065 : c'est Cédric qui l'applique (ADR-016).

---

## Conditions de fin

| #   | Condition                                                                                                       | Comment on le vérifie                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Le build iOS passe sous Xcode 27.2 sans erreur de cible de déploiement des Pods                                 | Build Xcode de Cédric après `pod install` (2026-11-23)                                    |
| 2   | L'app dépasse l'écran de lancement sur iOS 27                                                                   | Cédric : « C'est bon, l'app démarre sur l'iPad »                                          |
| 3   | Le module React Native démarré est `Mivro`, dans la fenêtre de la scène                                         | Relecture de `ios/Mivro/AppDelegate.swift` (`SceneDelegate.scene(_:willConnectTo:)`)      |
| 4   | Un lien `mivro://` à froid reste lisible par `Linking.getInitialURL()`                                          | `connectionOptions.urlContexts` passé en `launchOptions[.url]` ; ✅ sur iPhone 13         |
| 5   | Un lien `mivro://` à chaud est transmis à `RCTLinkingManager`                                                   | `scene(_:openURLContexts:)` ; ✅ sur iPhone 13                                            |
| 6   | Le schéma Xcode reste en Debug                                                                                  | Capteur `native` vert dans `npm run check`                                                |
| 7   | Le défaut des liens à chaud est consigné avec la règle qui l'aurait attrapé                                     | Entrée J-065 dans `docs/harness/JOURNAL-ECHECS.md`                                        |
| 8   | `AppDelegate` garde `window`, affectée par le `SceneDelegate` (React Native la lit)                             | Relecture de `AppDelegate.swift` ; fermeture de LogBox en Debug ✅ (Cédric, 2026-11-26)   |
| 9   | Scène reconnectée, hôte déjà lancé : l'écran existant est repris, le lien est relayé à chaud, rien n'est rejoué | `hostAlreadyRunning` dans `SceneDelegate.scene(_:willConnectTo:)` ; test appareil reporté |
| 10  | Un lien à froid qui arrive après 150 ms n'est plus perdu par React Navigation (J-066)                           | `getInitialURL` de `linking.ts` et ses tests ; à froid ✅ sur iPhone 13 (2026-11-23)      |
| 11  | Pendant la lecture du lien initial, l'app affiche l'écran de chargement, pas un écran blanc                     | `fallback={<LoadingScreen />}` dans `src/App.tsx` ; ✅ sur appareil (Cédric, 2026-11-26)  |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché. — Sans objet : aucun
      écran touché.
- [x] Toute donnée externe validée par un schéma Zod. — Sans objet : l'URL du lien est validée en
      aval, par `linking.ts` et `JoinSessionScreen`, inchangés.
- [x] Toute string affichée passe par `useTranslation()`. — Sans objet : aucune string ajoutée.
- [x] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md` (`ARCHITECTURE.md` ne décrit pas la
      couche native : sans objet).
- [x] ADR si décision d'architecture. — Non : la migration UIScene est imposée par le SDK, sans
      alternative à arbitrer.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] Tester sur appareil iOS un lien `mivro://session/<id>` à froid (app tuée) et à chaud (app en
      arrière-plan) : l'écran `JoinSession` doit s'ouvrir dans les deux cas. — iPhone 13 le
      2026-11-23 (à froid après le correctif J-066), iPad par Cédric le 2026-11-26.
- [ ] Appliquer au capteur `native` les deux règles proposées en J-065.
- [x] Pousser la branche (`git push -u origin fix/ios-sdk-27`) ; pas de PR tant que le verrou de
      facturation GitHub tient. — Poussée (cd9a907, 6939e21).
