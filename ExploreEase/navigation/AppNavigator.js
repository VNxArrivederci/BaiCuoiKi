// navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text } from 'react-native';

import { useAuth } from '../context/AuthContext';

// ── Auth Screens ──────────────────────────────────────────────
import LoginScreen          from '../screens/LoginScreen';
import RegisterScreen       from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PreferencesScreen    from '../screens/PreferencesScreen';

// ── Main Screens ──────────────────────────────────────────────
import HomeScreen           from '../screens/HomeScreen';
import ExploreScreen        from '../screens/ExploreScreen';
import EventsScreen         from '../screens/EventsScreen';
import AddScreen            from '../screens/AddScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import EditProfileScreen    from '../screens/EditProfileScreen';
import DetailScreen         from '../screens/DetailScreen';

// ── Social + Chat ─────────────────────────────────────────────
import SocialFeedScreen        from '../screens/SocialFeedScreen';
import ChatListScreen          from '../screens/ChatListScreen';
import ChatScreen              from '../screens/ChatScreen';

// ── Travel Planning ───────────────────────────────────────────
import TravelPlanningScreen    from '../screens/TravelPlanningScreen';
import TravelPlanDetailScreen  from '../screens/TravelPlanDetailScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TEAL = '#0D9488';
const GRAY = '#9CA3AF';

// ── Shared header options ─────────────────────────────────────
const headerOpts = (title) => ({
  title,
  headerStyle:      { backgroundColor: TEAL },
  headerTitleStyle: { color: '#fff', fontWeight: '800' },
  headerTintColor:  '#fff',
});

// ── Tab Icon ──────────────────────────────────────────────────
const TabIcon = ({ emoji, label, focused, isAdd }) => {
  if (isAdd) {
    return (
      <View style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
        shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
      }}>
        <Text style={{ fontSize: 24, color: '#fff' }}>＋</Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 19 }}>{emoji}</Text>
      <Text style={{
        fontSize: 10, marginTop: 2,
        fontWeight: focused ? '700' : '400',
        color: focused ? TEAL : GRAY,
      }}>{label}</Text>
    </View>
  );
};

// ── Stacks ────────────────────────────────────────────────────

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="HomeMap" component={HomeScreen}
      options={{ headerShown: false }} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={headerOpts('Chi tiết')} />
  </Stack.Navigator>
);

const ExploreStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ExploreList" component={ExploreScreen}
      options={headerOpts('🔍 Khám phá')} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={headerOpts('Chi tiết')} />
  </Stack.Navigator>
);

const EventsStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="EventsList" component={EventsScreen}
      options={headerOpts('🎉 Sự kiện')} />
    <Stack.Screen name="Detail" component={DetailScreen}
      options={headerOpts('Chi tiết sự kiện')} />
  </Stack.Navigator>
);

const AddStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="AddMain" component={AddScreen}
      options={headerOpts('➕ Thêm mới')} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProfileMain" component={ProfileScreen}
      options={headerOpts('👤 Hồ sơ của tôi')} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen}
      options={headerOpts('✏️ Chỉnh sửa hồ sơ')} />
  </Stack.Navigator>
);

// ── Travel Planning Stack ─────────────────────────────────────
const TravelStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="TravelList" component={TravelPlanningScreen}
      options={headerOpts('🧳 Kế hoạch du lịch')} />
    <Stack.Screen name="TravelPlanDetail" component={TravelPlanDetailScreen}
      options={({ route }) => headerOpts(route.params?.title || '📅 Chi tiết kế hoạch')} />
  </Stack.Navigator>
);

// ── Social Stack (Feed + Follow) ──────────────────────────────
const SocialStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="SocialFeed" component={SocialFeedScreen}
      options={headerOpts('🌐 Cộng đồng')} />
  </Stack.Navigator>
);

// ── Chat Stack ────────────────────────────────────────────────
export const ChatStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ChatListMain" component={ChatListScreen}
      options={headerOpts('💬 Tin nhắn')} />
    <Stack.Screen name="Chat" component={ChatScreen}
      options={({ route }) => ({
        ...headerOpts(route.params?.otherUser?.name || 'Chat'),
      })} />
  </Stack.Navigator>
);

// ── Main Tabs ─────────────────────────────────────────────────
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
    <Tab.Screen name="Home" component={HomeStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Bản đồ" focused={focused} /> }} />

    <Tab.Screen name="Explore" component={ExploreStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="Khám phá" focused={focused} /> }} />

    <Tab.Screen name="Events" component={EventsStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🎉" label="Sự kiện" focused={focused} /> }} />

    <Tab.Screen name="Add" component={AddStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="＋" label="Thêm" focused={focused} isAdd /> }} />

    <Tab.Screen name="Travel" component={TravelStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🧳" label="Kế hoạch" focused={focused} /> }} />

    <Tab.Screen name="Social" component={SocialStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🌐" label="Cộng đồng" focused={focused} /> }} />

    <Tab.Screen name="ChatList" component={ChatStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Tin nhắn" focused={focused} /> }} />

    <Tab.Screen name="Profile" component={ProfileStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Hồ sơ" focused={focused} /> }} />
  </Tab.Navigator>
);

// ── Auth Stack ────────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login"          component={LoginScreen} />
    <Stack.Screen name="Register"       component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="Preferences"    component={PreferencesScreen} />
  </Stack.Navigator>
);

// ── Root ──────────────────────────────────────────────────────
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