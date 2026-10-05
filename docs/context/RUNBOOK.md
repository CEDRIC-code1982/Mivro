# RUNBOOK — tâches externes (côté Cédric)

> Procédures pour les chantiers **bloqués par un compte / une infra / un device**.
> Tout le reste (code) est fait. Identifiants réels du projet :
>
> - **Bundle ID (iOS + Android)** : `com.cedricpineau.mivro`
> - **Projet Firebase** : `mivro-40125` — RTDB région **`europe-west1`**
> - **Deep link** : `mivro://` (id `com.mivro.deeplink`), format `mivro://session/{id}`
> - **RN** 0.85.2 (New Architecture), `@react-native-firebase` v25 (API modulaire)
> - **Team Apple** : `W7N4H92U5V` — figée par `scripts/check-native.py` (Xcode la réécrit en silence)

---

## Harness — ce que toi seul peux faire (ADR-016)

L'agent ne peut plus modifier le harness par les voies connues : hooks, capteurs, configs
lint/test/archi, CI et hooks git (liste : `scripts/harness-protected.txt`). Le garde Bash est une
liste noire, il aura toujours des angles morts (J-042). Ce qui passerait quand même et touche un
fichier de la liste rend le verrou rouge, en local comme en CI, et `harness-guard` exige ton label. Toute évolution passe par toi.

### Mise en service (une fois)

L'étape 1 est faite depuis le 2026-09-28 : `EN-ATTENTE.md` est appliqué, et il est vérifié que les
hooks voient bien `MIVRO_HARNESS_UNLOCK`. Pour lancer une session déverrouillée sans installer le
CLI, utilise le binaire de l'extension :
`MIVRO_HARNESS_UNLOCK=1 ~/.vscode/extensions/anthropic.claude-code-<version>-darwin-arm64/resources/native-binary/claude --continue`.

1. **Générer le verrou**, dans ton terminal, hors Claude Code : `npm run harness:relock`, puis
   tape `RELOCK`.
2. **Commit, push de `harness/beton`, PR vers `develop`.** Les jobs `battery` et `security`
   tournent sur la PR. `harness-guard`, lui, ne tourne **pas** encore : un workflow
   `pull_request_target` s'exécute depuis la branche **de base**, et `harness-guard.yml` n'existe
   pas encore sur `develop`. `security` sera rouge à cause de J-040.
3. **`npm audit fix` dans une branche dédiée** issue de `develop` (J-040), avec rebuild natif iOS
   et Android, puis PR et merge. Rebase ensuite `harness/beton` si besoin.
4. **Merger `harness/beton` dans `develop`**, puis **`develop` dans `main`** par PR. Les deux
   branches portent alors `harness-guard.yml`.
5. **Activer la protection** : `bash scripts/setup-branch-protection.sh`. Le script refuse
   d'exiger `harness-guard` sur une branche qui ne porte pas encore le workflow, ce qui évite de
   bloquer toutes les PR. Il crée aussi le label `harness-change`. Vérification :
   `bash scripts/setup-branch-protection.sh --show`.

À partir de là, toute PR qui touche le harness exige que tu poses le label `harness-change`.

### Au quotidien

- **Un capteur est faux, ou une règle manque** : l'agent le décrit (fichier, changement exact). Tu
  lances une session `MIVRO_HARNESS_UNLOCK=1 claude` pour qu'il l'applique, puis
  `npm run harness:relock`, puis commit, PR et label `harness-change`.
- **Dépendance npm, ajout ou simple mise à jour de version** : c'est ta décision. `package.json` et
  les lockfiles sont du harness depuis J-045. Si l'agent lance `npm install`, le verrou rougit et le
  hook Stop le lui signale ; il te décrit le besoin. Pour un nouveau paquet, ajoute-le dans
  `scripts/allowed-dependencies.json`, puis relock.
- **Nouvelle identité native** (team, bundle id) : modifie les constantes de
  `scripts/check-native.py`, puis relock.
- **Fin de tour avec ⚠️ capteurs rouges** : le hook Stop a laissé passer l'agent après 3 tentatives
  infructueuses. Lis ce qu'il a écrit avant de faire confiance à l'état du dépôt.

### Durcissement optionnel, recommandé

Un token GitHub **fine-grained** sans la permission _Administration_ pour les sessions Claude :
`gh auth login` avec ce token dans le shell qui lance `claude`. C'est la seule barrière contre un
script qui lèverait la protection de branche en passant sous les gardes locaux.

---

## F4 / F5 — Configuration Firebase

Identifiants réels du projet, source de vérité :

| Élément                 | Valeur                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Projet Firebase         | `mivro-40125` (RTDB `europe-west1`)                                   |
| Numéro de projet        | `145975054406`                                                        |
| Bundle id iOS / Android | `com.cedricpineau.mivro` (identique sur les deux plateformes)         |
| URL RTDB                | `https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/` |

**Coût** : plan **Spark (gratuit)** suffisant pour la RTDB. Le plan **Blaze** n'est requis que pour
les Cloud Functions (purge RGPD, voir « Filet RGPD » plus bas).

---

### ✅ Déjà en place (vérifié le 2026-08-24)

**Ne pas refaire ces étapes.** Elles sont décrites ici pour pouvoir être rejouées après un
`git clone` : les deux fichiers de config sont gitignorés, donc absents d'un dépôt frais.

| Élément                               | État                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------- |
| App iOS enregistrée dans Firebase     | ✅ bundle `com.cedricpineau.mivro`                                          |
| `ios/Mivro/GoogleService-Info.plist`  | ✅ présent, **référencé dans la cible Xcode** et dans Copy Bundle Resources |
| App Android enregistrée dans Firebase | ✅ package `com.cedricpineau.mivro`                                         |
| `android/app/google-services.json`    | ✅ présent, plugin Google Services `4.4.2` déjà câblé                       |
| `.env`                                | ✅ présent, porte `FIREBASE_DATABASE_URL`                                   |
| `.firebaserc`                         | ✅ présent, alias `default` → `mivro-40125`                                 |

⚠️ **Piège si tu dois re-télécharger le plist** : il ne suffit pas de le déposer dans le Finder,
mais il ne faut **pas non plus** le re-glisser dans Xcode si la référence existe déjà — Xcode
créerait une **seconde** `PBXFileReference` pour le même fichier et le build échouerait sur
`Multiple commands produce .../Mivro.app/GoogleService-Info.plist`.

Pour vérifier l'état de la référence avant de toucher à quoi que ce soit :

```bash
grep -c 'GoogleService-Info.plist' ios/Mivro.xcodeproj/project.pbxproj   # 4 = déjà référencé
```

Si le compteur vaut 0 (dépôt fraîchement cloné, plist re-téléchargé) : ouvrir
`ios/Mivro.xcworkspace` — le **workspace**, pas le projet — glisser le `.plist` sur le dossier
**Mivro** du navigateur de projet, cocher **Copy items if needed** et la cible **Mivro**, puis
vérifier que le fichier apparaît dans cible Mivro → **Build Phases** → **Copy Bundle Resources**.
La référence doit porter `path = "Mivro/GoogleService-Info.plist"` : un chemin relatif au groupe
racine, qui vaut `ios/`.

Pour recréer les fichiers manquants après un clone : les re-télécharger depuis Console Firebase →
⚙️ **Paramètres du projet** → **Général** → « Vos applications », et `[ -f .env ] || cp .env.example .env`.

---

### ✅ Règles RTDB déployées (2026-08-24)

`firebase login` puis `firebase deploy --only database` ont été exécutés. Les règles publiées sont
**structurellement identiques** à `database.rules.json` — vérifié par comparaison du JSON de la
console avec le fichier du dépôt.

Surface d'écriture effective, auditée après déploiement :

| Chemin                                      | Accès                      |
| ------------------------------------------- | -------------------------- |
| racine                                      | `.read`/`.write` = `false` |
| `/sessions/$sessionId/meta`                 | ouvert                     |
| `/sessions/$sessionId/members/$memberId`    | ouvert                     |
| `/sessions/$sessionId/participants/$partId` | ouvert                     |

Les trois chemins ouverts vivent sous un `$sessionId` qui est un UUID non devinable : c'est le
modèle **capability URL** assumé pour le MVP sans auth. Détail dans `database.rules.README.md`.

⚠️ Dette connue : **pas de `$other: { ".validate": false }` au niveau `sessions/$sessionId`**. Un
client qui connaît l'UUID peut donc écrire un nœud frère arbitraire à côté de `meta`, `members` et
`participants`. À durcir avec Firebase Anonymous Auth — voir `TODO.md > Dette technique`.

### ⏳ Reste à faire

Rebuild natif — `react-native-config` lit `.env` au moment du build, pas au reload Metro.

```bash
npm run ios
npx react-native run-android
```

Enfin, suivre les lignes **F4** et **F5** de la matrice de test plus bas. Test minimal : deux
appareils dans la même session, bouger l'un fait bouger son marqueur chez l'autre en 1-2 s.

---

## F6 — Auth Google / Apple

**État du code** : prêt. `src/entities/User.ts` modélise déjà `AuthenticatedUser`
(`provider: 'google' | 'apple'`, `email`). `useAuthStore` expose `signInWithGoogle()` /
`signInWithApple()` qui **throw** (`not implemented yet`). Il reste : SDK natifs + config
consoles + un adapter `AuthService` branché dans le conteneur DI.

### Coûts / prérequis comptes

- **Google** : gratuit (plan Spark suffit pour le social login). Utilise le projet GCP
  **déjà lié à Firebase** (`mivro-40125`) — pas de nouveau compte payant.
- **Apple** : **Apple Developer Program, 99 €/an** (obligatoire, sert aussi à TestFlight).
- ⚠️ **Règle App Store 4.8** : si tu proposes Google Sign-In sur iOS, tu **dois** aussi
  proposer Apple Sign-In. Les deux vont donc ensemble sur iOS.

### 1. Console Firebase

1. Console Firebase → **Authentication** → _Sign-in method_.
2. Activer **Google** (choisir l'email de support).
3. Activer **Apple**.

### 2. Dépendances

```bash
npm i @react-native-firebase/auth @react-native-google-signin/google-signin \
      @invertase/react-native-apple-authentication
cd ios && pod install && cd ..
```

### 3. Google — config native

- **Web Client ID** : GCP Console → _APIs & Services_ → _Credentials_ → OAuth 2.0 client
  « Web client (auto created by Google Service) ». C'est ce qu'on passe à
  `GoogleSignin.configure({ webClientId })`.
- **Android** : ajouter les empreintes **SHA-1 + SHA-256** (debug ET release) au projet
  Firebase, puis **re-télécharger `google-services.json`**.
  ```bash
  cd android && ./gradlew signingReport   # copie les SHA-1/SHA-256
  ```
- **iOS** : ajouter le **`REVERSED_CLIENT_ID`** (lu dans `GoogleService-Info.plist`) comme
  URL scheme dans `ios/Mivro/Info.plist` (à côté du scheme `mivro://` déjà présent).

### 4. Apple — config native

1. Xcode → cible Mivro → _Signing & Capabilities_ → **+ Sign In with Apple**.
2. Apple Developer portal → _Identifiers_ → App ID `com.cedricpineau.mivro` → cocher
   **Sign In with Apple**.
3. (Firebase gère le flux natif iOS avec juste le provider activé + le bundle ID.)

### 5. Branchement code (session dev dédiée, via l'équipe d'agents)

- Créer `src/services/domain/auth/IAuthService.ts` (interface `signInWithGoogle/Apple`, `signOut`).
- Créer `src/services/infra/auth/FirebaseAuthService.ts` (adapter).
- Enregistrer dans `src/services/serviceContainer.ts` (bloc « Swap provider »).
- Remplacer les `throw` de `useAuthStore.signInWithGoogle/Apple` par des appels à l'adapter.
- Tests : `useAuthStore` + intégration `ProfileScreen`.

---

## PostHog — analytics auto-hébergé

**État du code** : rien de branché. À faire derrière un port `AnalyticsService` (DI), pour
pouvoir swapper Cloud ↔ self-host en 1 ligne.

### ⚠️ À décider avant : self-host vs PostHog Cloud EU

Le **self-host** (« hobby deploy ») fait tourner une stack lourde (ClickHouse, Kafka,
Redis, Postgres) via Docker Compose sur **1 serveur** ; PostHog le supporte en
communauté seulement et recommande le Cloud. **PostHog Cloud EU** est hébergé en
Europe (RGPD) et t'évite le VPS. Pour un MVP, le Cloud EU est souvent le meilleur rapport
effort/risque. Le self-host ne se justifie que si la souveraineté totale des données est
une exigence dure.

### Self-host (hobby deploy)

1. **VPS** Ubuntu 22.04, mini **4 vCPU / 16 Go RAM** recommandé (le minimum absolu 4 Go
   rame vite), + un **domaine** pointant dessus (TLS auto via le script).
2. Installer Docker + Docker Compose.
3. Déploiement one-liner :
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/PostHog/posthog/HEAD/bin/deploy-hobby)"
   ```
   → répond domaine + email, crée l'admin, provisionne TLS.
4. Récupérer **Project API key** + l'**URL host** (ton domaine).

### Intégration RN (identique Cloud ou self-host)

```bash
npm i posthog-react-native @react-native-async-storage/async-storage react-native-device-info
cd ios && pod install && cd ..
```

- Client `PostHog` avec `{ host: 'https://<ton-domaine-ou-eu.posthog.com>', apiKey }`.
- Ajouter la clé/host dans `.env` (+ `.env.example`) via `react-native-config`.
- Brancher derrière `AnalyticsService` dans le conteneur DI.
- **RGPD** : opt-in explicite avant tout event ; ne jamais logger de PII.

---

## Beta — TestFlight (iOS) + Play (Android)

### iOS — TestFlight

Prérequis : **Apple Developer Program (99 €/an)**.

1. **App Store Connect** → _My Apps_ → **+** → créer l'app (bundle `com.cedricpineau.mivro`).
2. **Signing** : le plus simple = Xcode _Automatic signing_ (cert de distribution +
   provisioning profile gérés par Xcode). Pour une équipe → `fastlane match`.
3. Incrémenter le _build number_, `Product → Archive` en config **Release** →
   _Distribute App_ → _App Store Connect_ → _Upload_ (ou app **Transporter**, ou
   `fastlane pilot upload`).
4. Onglet **TestFlight** :
   - **Internal testers** (≤ 100) : dispo immédiatement, **pas de review**.
   - **External testers** (≤ 10 000) : passe une **Beta App Review** (rapide).

### Android — Play (Internal testing)

Prérequis : **Google Play Console (25 $ une fois)**.

1. Créer l'app dans la console (bundle `com.cedricpineau.mivro`).
2. **Signing** :
   ```bash
   keytool -genkeypair -v -keystore mivro-upload.keystore \
     -alias mivro -keyalg RSA -keysize 2048 -validity 10000
   ```
   - Activer **Play App Signing** (Google détient la clé de signature finale ; toi la clé
     d'_upload_).
   - Mettre les creds du keystore dans **`~/.gradle/gradle.properties`** (⚠️ **jamais**
     commité) et référencer un `signingConfigs.release` dans `android/app/build.gradle`.
3. Construire l'AAB signé :
   ```bash
   cd android && ./gradlew bundleRelease
   # → app/build/outputs/bundle/release/app-release.aab
   ```
4. Play Console → _Testing_ → **Internal testing** → _Create release_ → uploader l'AAB →
   ajouter les testeurs (liste d'emails / groupe) → partager le **lien d'opt-in**.

---

## Vérifs device — F4 / F5 / F7 / F8 + QA P1

### Prérequis avant tout test

1. Fichiers de config Firebase **en place** (gitignorés) :
   `android/app/google-services.json` et `ios/Mivro/GoogleService-Info.plist`.
   ✅ Vérifiés présents et référencés le 2026-08-24 — voir « Configuration Firebase ».
2. `.env` contient `FIREBASE_DATABASE_URL=https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/`.
3. **Déployer les bonnes règles RTDB** (⚠️ pas les règles all-deny) :
   ```bash
   firebase use mivro-40125
   firebase deploy --only database        # publie database.rules.json
   ```
4. Build device :
   ```bash
   # iOS (device branché)
   cd ios && pod install && cd .. && npx react-native run-ios --device
   # Android (device en debug USB)
   npx react-native run-android
   ```

### Matrice de test

| Feature           | À vérifier sur device                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F4** temps réel | 2 devices dans la même session → bouger l'un fait bouger son marqueur chez l'autre en ~1-2 s ; tuer l'app → le participant disparaît (onDisconnect).                                                                                                                      |
| **F5** partage    | Device A crée un partage → lien `mivro://session/{id}` → ouvrir sur Device B → rejoint comme participant → **midpoint recalculé** → liste des membres OK. Tester l'**expiration** (24 h guest / 7 j compte) et la **suppression RGPD** (owner reset → session supprimée). |
| **F7** profil     | Choisir un avatar emoji ; choisir une **photo** (accorder PUIS refuser la permission caméra/galerie → message d'erreur propre) ; éditer le nom ; **texte système à 200 %** → pas de clipping.                                                                             |
| **F8** biométrie  | Activer le verrou → mettre l'app en arrière-plan → retour → prompt Face ID/Touch ID ; **échouer 3×** → bouton d'échappement (désactiver & continuer) ; device **sans biométrie enrôlée** → repli **code de l'appareil** ; tuer/relancer → reste verrouillée.              |
| **QA P1**         | VoiceOver annonce les marqueurs de la carte ; texte 200 % sans coupure ; **couper le réseau** → recherche Nominatim affiche un **message d'erreur réseau** (pas d'échec silencieux) ; recherche vide → **EmptyState visible** ; mode avion → erreur GPS gérée.            |

### Filet RGPD (avant la beta, pas avant les tests)

Déployer la Cloud Function de purge des sessions expirées (**nécessite le plan Blaze**) :

```bash
cd functions && npm install && cd ..
firebase deploy --only functions          # purgeExpiredSessions (horaire, europe-west1)
```
