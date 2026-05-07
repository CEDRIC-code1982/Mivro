/**
 * @format
 */

// [ADDED] react-native-gesture-handler must be imported FIRST (before any other import)
import 'react-native-gesture-handler';

// [ADDED] Polyfill crypto.getRandomValues pour uuid sur React Native
// Doit être importé AVANT toute utilisation de uuid
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
// [MODIFIED] App moved to src/presentation/ (Clean Architecture)
import App from './src/presentation/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
