# Checklist QA — Mivro MVP (F1 → F3)

## 🎯 Objectif

Valider que l'app fonctionne **en conditions réelles** (device physique,
réseau variable, vrai usage humain) avant d'investir dans F4 Realtime.

Durée estimée : **30-45 min**.

---

## 📱 Préparation (5 min)

### Setup device

- [x] Installer l'app sur **ton iPhone physique** (pas seulement simulator)
      `bash
      cd ~/Personnel/MidPoint
      npm run ios -- --device "Ton iPhone"
  # Ou ouvrir Xcode > Build & Run sur device
  `
- [x] Si possible, installer aussi sur un **Android physique** (si tu en as un) L APP EN REALEASE NE SOUVRE PAS MAIS EN DEBUG OUI
- [x] Activer le mode **Release** plutôt que Debug pour ressentir les perfs réelles :
      `bash
npx react-native run-ios --configuration Release
`
- [x] Désactiver Metro bundler (l'app doit tourner en standalone)

### Conditions de test

- [x] Wifi **off**, 4G **on** (conditions réelles utilisateur)
- [x] Mode "ne pas déranger" **off** (tester si les notifs système clash)
- [x] Luminosité écran à 50% (vérifier les contrastes en conditions normales)
- [x] Si tu portes des lunettes : tester avec ET sans (accessibilité)

---

## 🔍 Test 1 — Parcours nominal (10 min)

### Étape 1 : Premier lancement

- [x] L'app démarre en **moins de 3 secondes** sur device récent
- [x] L'écran de chargement (Spinner bootstrap) **n'apparaît pas plus de 1s**
- [ ] L'icône de l'app affiche bien **"Mivro"** (pas "MidPoint") A FIXER TOUJOURS MidPoint
- [x] Les 4 onglets sont visibles : Map, Sessions, Create, Profile
- [x] L'onglet par défaut au lancement est cohérent (Map ou Create selon décision) A OUVRIR SUR CREATE SI PAS DE SESSION SAUVEGARDEE, SINON MAP

### Étape 2 : Connexion guest

- [x] Aller sur Profile → "Continuer en invité"
- [x] Un nom auto "Invité-XXXX" apparaît
- [x] Sortir/relancer l'app → l'invité est **toujours connecté** (persistance MMKV OK)
- [ ] Toggle thème : system → light → dark → system fonctionne THEME NE VARIE PAS SELON L APPUI SUR LE TOGGLE, IL RESTE EN MODE SYSTEM. MAIS LE MODE SYSTEM FONCTIONNE BIEN (CHANGE QUAND JE CHANGE LE MODE DANS LES SETTINGS IOS)

### Étape 3 : F1 — Saisie de points

- [x] Aller sur l'onglet **Créer**
- [x] L'écran affiche bien le compteur "0 / 5 points"
- [x] L'EmptyState est visible
- [x] Cliquer **"Utiliser ma position"**
  - [x] Le prompt système iOS/Android demande la permission
  - [x] Wording user-friendly visible
  - [x] Accepter → un point est ajouté avec ton adresse réelle
  - [x] La ParticipantCard affiche avatar + nom auto + adresse formatée
- [x] Cliquer sur l'Input adresse
  - [ ] Le bottom sheet s'ouvre (animation fluide ≥ 60fps) OUI IL S OUVRE MAIS LA ParticipantCard reste visible au dessus, ce qui fait un effet de "double card" un peu bizarre. À FIXER : la card devrait être cachée quand le sheet est ouvert
  - [x] Taper "Tour Eiffel"
  - [x] Après ~400ms, les résultats Nominatim apparaissent
  - [ ] **Le clavier ne cache pas les résultats** (BottomSheetTextInput OK) SI LE CLAVIER CACHE LES RESULTATS, IL FAUT SCROLLER POUR LES VOIR, CE QUI N EST PAS IDEAL. À FIXER : le clavier devrait pousser le bottom sheet vers le haut pour que les résultats soient toujours visibles
  - [x] Tap sur un résultat → le sheet ferme, le point est ajouté
- [x] Ajouter encore 2 points (max 5 total)
- [ ] Vérifier le compteur "5 / 5" — le bouton "Utiliser ma position" doit être **disabled** IMPOSSIBLE DE METTRE PLUS DE 3 POINT LES ADRESSES NE SONT PLUS ACCESSIBLE AU VU DE L UI (la card "Utiliser ma position" est cachée dès qu'on a ajouté 3 points, alors que le max est 5)
- [x] Tap × sur une card → suppression instantanée
- [x] Le bouton **Continuer** s'active avec 2 points (devient brand color)

### Étape 4 : F2 — Carte midpoint

- [x] Cliquer **Continuer**
- [x] L'app navigue automatiquement vers l'onglet **Map**
- [x] La carte s'affiche en moins de 2 secondes
- [x] Tous les markers participants sont visibles (cercles avec initiales)
- [x] Le marker midpoint (★ orange) est visible
- [x] Le cercle de zone (opacity 15%) entoure tous les participants
- [x] La caméra a auto-zoomé pour tout voir (`fitToCoordinates` OK)
- [x] Le footer affiche le résumé (radius en km)
- [x] **"Vue liste"** : tap → modal avec liste textuelle des participants + midpoint
- [x] **VoiceOver test** (Settings > Accessibility > VoiceOver ON) :
  - [ ] La carte est annoncée NON
  - [ ] Le bouton "Vue liste" donne accès à toute l'info textuellement NON

### Étape 5 : F3 — POI à proximité

- [x] Cliquer **"Voir les lieux à proximité"**
- [x] L'écran POIScreen s'affiche
- [x] Vue **Liste par défaut** (ma reco)
- [x] Les POIs apparaissent en moins de 3 secondes (Overpass peut être lent)
- [x] Les POIs sont **triés par distance croissante**
- [x] Les filtres chips horizontales sont scrollables
- [x] La chip "Tout" est sélectionnée par défaut
- [x] Cliquer "Cafés" uniquement → seuls les cafés visibles
- [x] Toggle **Carte** → la vue change, markers POI visibles
- [ ] Tap sur un marker POI → bottom sheet détail SI ON TAPE SUR UN POI RIEN NE SE PASSE
- [ ] Le bottom sheet affiche : nom, catégorie, distance, adresse si dispo NON
- [ ] Bouton **"Y aller"** → ouvre Apple Maps / Google Maps natif PAS DE BOUTON Y ALLER
- [ ] Retour à l'app → "Fermer" ferme le bottom sheet SI ON FAIT UN GO BACK SUR LIEUX A PROXIMITÉ ON REVIENT BIEN SUR LA CARTE

---

## ⚡ Test 2 — Robustesse (10 min)

### Mode avion / réseau coupé

- [x] Activer mode avion
- [ ] Tenter une recherche d'adresse → message d'erreur i18n clair
      ("Pas de connexion. Vérifie ton réseau.") NON JUSTE AUCUN RESULTAT
- [x] Tenter GPS → fonctionne quand même (GPS local) SI ON APPUIE SUR "UTILISER MA POSITION" EN MODE AVION, ON A BIEN UN POINT QUI S AJOUTE AVEC L ADRESSE GPS (PAS DE MESSAGE D ERREUR) MIS SI UNE ADRESSE EST SAISIE MANUELLEMENT ET QUE L ON CLIQUE SUR MA POSITION APRES L ADRESSE APPARAIT DANS LA ParticipantCard
- [x] Désactiver mode avion → la recherche fonctionne à nouveau

### Permissions refusées

- [x] Désinstaller l'app, réinstaller
- [x] Aller dans F1 → "Utiliser ma position" → **Refuser** le prompt
- [x] Message d'erreur clair affiché
- [x] Saisir manuellement une adresse fonctionne toujours (fallback OK)

### Données limites

- [x] Saisir une adresse qui ne renvoie aucun résultat ("xkcdaazz")
  - [x] EmptyState "Aucun résultat" visible MAIS CACHE PAR UNE AUTRE ECRITURE
- [x] Calculer midpoint avec 2 points **très éloignés** (Paris + Tokyo par ex)
  - [x] Le calcul fonctionne (centroïde cartésien)
  - [x] La carte zoom bien sur les 2 (peut être très dézoomé)
  - [x] POIs cherchés au milieu du Pacifique → vide attendu, EmptyState ERREUR INNATTENDUE SUR LA LISTE
- [x] Saisir 2 points **très proches** (même rue, 2 numéros) Résultat de test -> Les numéros ne sont pas retenus dans le résultat de Nominatim, donc les 2 points sont quasiment au même endroit
  - [ ] Midpoint au milieu
  - [ ] POIs à proximité immédiate trouvés
  - [ ] Le radius est très petit mais affichage OK

### Performances

- [x] L'app reste fluide après 5 min d'usage continu (pas de leak)
- [x] Quitter l'app (background) puis revenir → la session est persistée
- [x] Faire le parcours complet F1 → F2 → F3 sans crash
- [x] Forcer le kill de l'app → relancer → état attendu (auth persistée, session perdue : RGPD OK)

---

## 🎨 Test 3 — UX/UI (10 min)

### Accessibilité

- [x] Mettre la taille du texte au **maximum** (Réglages iOS > Accessibilité > Taille du texte)
- [x] Vérifier que **aucun layout ne casse** (textes coupés, boutons hors écran) LAYOUT CASSE
- [x] Activer **Reduce Motion** (Réglages iOS > Accessibilité > Réduction d'animations)
  - [x] Le Spinner devient statique (pas de rotation)
  - [x] Les animations bottom sheet sont réduites

### Dark mode

- [x] Passer iOS en mode sombre (Réglages > Affichage > Sombre)
- [x] Toute l'app passe en dark mode automatiquement
- [x] Pas de texte illisible (contrastes WCAG AA)
- [x] Pas de "trous" blancs (fond brand qui ne s'adapte pas)

### Langue

- [x] Passer iOS en anglais (Réglages > Général > Langue)
- [x] Relancer l'app
- [x] Tous les textes sont en anglais (i18n OK)
- [x] Aucun "missing translation" warning

### Tactile

- [x] Tester avec **un doigt** (touch targets ≥ 48dp)
- [x] Aucun bouton trop petit, aucune zone tap manquée
- [ ] Le clavier ne cache **aucun élément interactif** important LORS DE LA SAISIE D ADRESSE, LE CLAVIER CACHE LES RESULTATS DE RECHERCHE, CE QUI N EST PAS IDEAL. À FIXER : le clavier devrait pousser le bottom sheet vers le haut pour que les résultats soient toujours visibles

---

## 🐛 Test 4 — Bugs probables à chercher (10 min)

### À surveiller spécifiquement

- [x] **Permission GPS refusée puis ré-acceptée** : l'app s'adapte ?
- [x] **Navigation Back** depuis POI : retour à Map sans crash ?
- [x] **Plusieurs ouvertures rapides** du bottom sheet : pas de bug d'état ?
- [x] **Filtrage 0 catégorie** : EmptyState "Choisis au moins une catégorie" ?
- [ ] **Bouton "Y aller"** sans app Maps installée (rare iOS) : fallback web ? bouton y aller inactif ? PAS DE BOUTON Y ALLER
- [ ] **Recherche Overpass très lente** (3-5s) : Spinner clair, pas de freeze ? Pas de problème rencontré mais à surveiller sur Android qui est moins puissant que mon iPhone de test
- [ ] **Carte qui ne charge pas** sur Android (sans Google API key) : watermark "for development" OK ? A tester sur Android pour vérifier que la carte s'affiche même sans clé API Google Maps (en mode développement, c'est censé fonctionner avec un watermark "for development")

---

## 📝 Format de notes — pour chaque bug trouvé

```
[BUG] [Priority: HIGH/MED/LOW]
- Where: F1 / F2 / F3 / Profile / Other
- Steps: 1. 2. 3.
- Expected: ...
- Actual: ...
- Device: iPhone X iOS 17.2 / Pixel 6 Android 14
- Screenshot/video: oui/non
```

Garde ces notes dans un fichier `qa-notes-{date}.md` à la racine du repo
(gitignored).

---

## 🎯 À la fin du QA

Tu auras :

- [ ] Une liste de bugs/améliorations classés par priorité
- [ ] Une vision claire de **ce qui va bien** dans ton MVP
- [ ] Une vision claire de **ce qui doit être patché AVANT F4**

Reviens-moi avec :

- Le nombre de bugs HIGH / MED / LOW
- Les 2-3 problèmes les plus gênants
- Tes ressentis subjectifs ("la navigation est confuse", "le bottom sheet
  est lent", etc.)

Je te livre alors :

- **Si bugs HIGH** : un prompt Claude Code dédié au fix
- **Si pas de bug bloquant** : on attaque F7 ou F4 selon ta préférence
