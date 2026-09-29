import { registerRootComponent } from 'expo';
import { enableScreens } from 'react-native-screens';

import App from './App';

// Avoid native RNSScreen* views when the dev client lacks react-native-screens linkage.
enableScreens(false);

registerRootComponent(App);
