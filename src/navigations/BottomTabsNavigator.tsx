/**
 * @file BottomTabsNavigator.tsx
 * @description Bottom Tabs Navigator — 4 onglets principaux de l'app.
 *              Bottom Tabs Navigator — 4 main app tabs.
 *
 *              Map | Sessions | Create (FAB) | Profile
 *
 * @module presentation/navigation/BottomTabsNavigator
 */

// [ADDED] Bottom Tabs Navigator avec icônes Lucide + i18n + theme + a11y
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@theme';
import { List, MapPin, PlusCircle, User } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TabBarIcon } from '@components/atoms';
import ProfileScreen from '@features/Profile/screens/ProfileScreen/ProfileScreen';
import CreateSessionScreen from '@features/Session/screens/CreateSessionScreen/CreateSessionScreen';
import MapScreen from '@features/Session/screens/MapScreen/MapScreen';
import SessionsScreen from '@features/Session/screens/SessionsScreen/SessionsScreen';
import { useSessionStore } from '@state/useSessionStore'; // [FIXED P0-7]
import type { BottomTabsParamList } from './types';

// [ADDED] Typed bottom tab navigator
const Tab = createBottomTabNavigator<BottomTabsParamList>();

/**
 * Bottom Tabs Navigator — les 4 onglets principaux.
 * Bottom Tabs Navigator — the 4 main tabs.
 *
 * @returns Composant BottomTabsNavigator / BottomTabsNavigator component
 */
const BottomTabsNavigator: React.FC = () => {
  const { t } = useTranslation('navigation');
  const theme = useTheme();

  // [FIXED P0-7] Default tab: Map if session computed, Create otherwise
  const session = useSessionStore((s) => s.session);
  const initialTab = session?.status === 'computed' ? 'Map' : 'Create';

  // [ADDED] Extracted tabBarIcon render functions to avoid unstable nested components
  const renderMapIcon = React.useCallback(
    ({ focused }: { focused: boolean }) => (
      <TabBarIcon icon={MapPin} focused={focused} accessibilityLabel={t('tabs.map')} />
    ),
    [t],
  );

  const renderSessionsIcon = React.useCallback(
    ({ focused }: { focused: boolean }) => (
      <TabBarIcon icon={List} focused={focused} accessibilityLabel={t('tabs.sessions')} />
    ),
    [t],
  );

  const renderCreateIcon = React.useCallback(
    ({ focused }: { focused: boolean }) => (
      <TabBarIcon icon={PlusCircle} focused={focused} accessibilityLabel={t('tabs.create')} />
    ),
    [t],
  );

  const renderProfileIcon = React.useCallback(
    ({ focused }: { focused: boolean }) => (
      <TabBarIcon icon={User} focused={focused} accessibilityLabel={t('tabs.profile')} />
    ),
    [t],
  );

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.interactive.brand.default,
        tabBarInactiveTintColor: theme.color.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.color.surface.primary,
          borderTopColor: theme.color.border.subtle,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.sans,
          fontSize: theme.typography.fontSize.caption,
        },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: t('tabs.map'),
          tabBarAccessibilityLabel: t('tabs.map'),
          tabBarIcon: renderMapIcon,
        }}
      />
      <Tab.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{
          tabBarLabel: t('tabs.sessions'),
          tabBarAccessibilityLabel: t('tabs.sessions'),
          tabBarIcon: renderSessionsIcon,
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateSessionScreen}
        options={{
          tabBarLabel: t('tabs.create'),
          tabBarAccessibilityLabel: t('tabs.create'),
          tabBarIcon: renderCreateIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: renderProfileIcon,
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabsNavigator;
