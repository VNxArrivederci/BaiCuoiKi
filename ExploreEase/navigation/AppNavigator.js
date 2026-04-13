// navigation/AppNavigator.js
// Cập nhật: thêm tab Khám phá, Sự kiện, Thêm (+), Bản đồ và DetailScreen vào stack
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';

import { useAuth } from '../context/AuthContext';

import LoginScreen          from '../screens/LoginScreen';
import RegisterScreen       from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen           from '../screens/HomeScreen';
import ExploreScreen        from '../screens/ExploreScreen';
import EventsScreen         from '../screens/EventsScreen';
import AddScreen            from '../screens/AddScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import DetailScreen         from '../screens/DetailScreen';
import PreferencesScreen    from '../screens/PreferencesScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TEAL = '#0D9488';
const GRAY = '#9CA3AF';

// ── Tab Icon ─────────────────────────────────────────────────────
const TabIcon = ({ emoji, label, focused, isAdd }) => {
  if (isAdd) {
    return (
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
        marginBottom: 22,
        shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
      }}>
        <Text style={{ fontSize: 26, color: '#fff' }}>＋</Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{
        fontSize: 10, marginTop: 2, fontWeight: focused ? '700' : '400',
        color: focused ? TEAL : GRAY,
      }}>{label}</Text>
    </View>
  );
};

// ── Home Stack (includes Detail) ─────────────────────────────────
const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ExploreHome" component={HomeScreen}
      options={{ headerShown: false }} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={{ title: 'Chi tiết', headerStyle: { backgroundColor: TEAL },
        headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
  </Stack.Navigator>
);

const ExploreStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ExploreList" component={ExploreScreen}
      options={{ title: '🔍 Khám phá', headerStyle: { backgroundColor: TEAL }, headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={{ title: 'Chi tiết', headerStyle: { backgroundColor: TEAL }, headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
  </Stack.Navigator>
);

const EventsStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="EventsList" component={EventsScreen}
      options={{ title: '🎉 Sự kiện', headerStyle: { backgroundColor: TEAL }, headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={{ title: 'Chi tiết sự kiện', headerStyle: { backgroundColor: TEAL }, headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
  </Stack.Navigator>
);

const AddStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="AddMain" component={AddScreen}
      options={{ title: '➕ Thêm mới', headerStyle: { backgroundColor: TEAL }, headerTitleStyle: { color: '#fff', fontWeight: '800' }, headerTintColor: '#fff' }} />
  </Stack.Navigator>
);

// ── Main Tabs ─────────────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        height: 68,
        paddingBottom: 8,
        paddingTop: 6,
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Trang chủ" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Explore"
      component={ExploreStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="Khám phá" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Add"
      component={AddStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="＋" label="Thêm" focused={focused} isAdd />,
      }}
    />
    <Tab.Screen
      name="Events"
      component={EventsStack}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🎉" label="Sự kiện" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Hồ sơ" focused={focused} />,
        headerShown: true,
        headerTitle: '👤 Hồ sơ của tôi',
        headerStyle: { backgroundColor: TEAL },
        headerTitleStyle: { color: '#fff', fontWeight: '800' },
      }}
    />
  </Tab.Navigator>
);

// ── Auth Stack ────────────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login"          component={LoginScreen} />
    <Stack.Screen name="Register"       component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="Preferences"    component={PreferencesScreen} />
  </Stack.Navigator>
);

// ── Root ──────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' }}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}