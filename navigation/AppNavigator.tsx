import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import { useMemo, type ComponentType } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenEntrance } from '../components/ui';

import BoardScreen from '../screens/BoardScreen';
import BotDetailScreen from '../screens/BotDetailScreen';
import BotRosterScreen from '../screens/BotRosterScreen';
import GameReviewScreen from '../screens/GameReviewScreen';
import GameReviewSetupScreen from '../screens/GameReviewSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import BoardFeaturesScreen from '../screens/BoardFeaturesScreen';
import FreeBoardModesScreen from '../screens/FreeBoardModesScreen';
import LicensesScreen from '../screens/LicensesScreen';
import SavedGamesScreen from '../screens/SavedGamesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function withScreenEntrance<Name extends keyof RootStackParamList>(
  Screen: ComponentType<NativeStackScreenProps<RootStackParamList, Name>>,
) {
  function EnteredScreen(props: NativeStackScreenProps<RootStackParamList, Name>) {
    return (
      <ScreenEntrance>
        <Screen {...props} />
      </ScreenEntrance>
    );
  }

  EnteredScreen.displayName = `Entered(${Screen.displayName ?? Screen.name})`;
  return EnteredScreen;
}

const EnteredHome = withScreenEntrance(HomeScreen);
const EnteredSettings = withScreenEntrance(SettingsScreen);
const EnteredBoardFeatures = withScreenEntrance(BoardFeaturesScreen);
const EnteredFreeBoardModes = withScreenEntrance(FreeBoardModesScreen);
const EnteredLicenses = withScreenEntrance(LicensesScreen);
const EnteredBots = withScreenEntrance(BotRosterScreen);
const EnteredBotDetail = withScreenEntrance(BotDetailScreen);
const EnteredSavedGames = withScreenEntrance(SavedGamesScreen);
const EnteredGameReviewSetup = withScreenEntrance(GameReviewSetupScreen);

type AppNavigatorProps = {
  initialNavigationState?: PartialState<NavigationState>;
};

export default function AppNavigator({ initialNavigationState }: AppNavigatorProps) {
  const theme = useTheme();

  const navigationTheme = useMemo(
    () => ({
      ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.navBackground,
        card: theme.navCard,
        text: theme.navText,
        border: theme.navBorder,
        primary: theme.navPrimary,
      },
    }),
    [theme],
  );

  return (
    <NavigationContainer theme={navigationTheme} initialState={initialNavigationState}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 220,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="Home" component={EnteredHome} />
        <Stack.Screen name="Settings" component={EnteredSettings} />
        <Stack.Screen name="BoardFeatures" component={EnteredBoardFeatures} />
        <Stack.Screen name="FreeBoardModes" component={EnteredFreeBoardModes} />
        <Stack.Screen name="Licenses" component={EnteredLicenses} />
        <Stack.Screen name="Bots" component={EnteredBots} />
        <Stack.Screen name="BotDetail" component={EnteredBotDetail} />
        <Stack.Screen name="Board" component={BoardScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SavedGames" component={EnteredSavedGames} />
        <Stack.Screen name="GameReviewSetup" component={EnteredGameReviewSetup} />
        <Stack.Screen name="GameReview" component={GameReviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
