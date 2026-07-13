# RUNBOOK — tâches externes (côté Cédric)

> Procédures pour les chantiers **bloqués par un compte / une infra / un device**.
> Tout le reste (code) est fait. Identifiants réels du projet :
>
> - **Bundle ID (iOS + Android)** : `com.cedricpineau.mivro`
> - **Projet Firebase** : `mivro-40125` — RTDB région **`europe-west1`**
> - **Deep link** : `mivro://` (id `com.mivro.deeplink`), format `mivro://session/{id}`
> - **RN** 0.85.2 (New Architecture), `@react-native-firebase` v25 (API modulaire)

---

## F6 — Auth Google / Apple

**État du code** : prêt. `src/core/entities/User.ts` modélise déjà `AuthenticatedUser`
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

- Créer `src/core/ports/AuthService.ts` (interface `signInWithGoogle/Apple`, `signOut`).
- Créer `src/infrastructure/auth/FirebaseAuthService.ts` (adapter).
- Enregistrer dans `src/di/container.ts` (bloc « Swap provider », ~ligne 152).
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

1. Fichiers de config Firebase **en place** (gitignorés — tu les as déjà) :
   `android/app/google-services.json` et `ios/Mivro/GoogleService-Info.plist`.
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
