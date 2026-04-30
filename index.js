/**
 * @format
 */

import { AppRegistry } from 'react-native';
// [MODIFIED] App moved to src/presentation/ (Clean Architecture)
import App from './src/presentation/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
