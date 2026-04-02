// navigation/MainTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import HomeScreen    from '../screens/HomeScreen';
import MapScreen     from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// ── Tab Icon ────────────────────────────────────
const TabIcon = ({ emoji, label, focused }) => (
  <View style={[iconStyles.wrap, focused && iconStyles.wrapActive]}>
    <Text style={iconStyles.emoji}>{emoji}</Text>
    <Text style={[iconStyles.label, focused && iconStyles.labelActive]}>{label}</Text>
  </View>
);

const iconStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 6, paddingHorizontal: 14, paddingBottom: 2,
    borderRadius: 16, minWidth: 64,
  },
  wrapActive:  { backgroundColor: '#F0FDF9' },
  emoji:       { fontSize: 20 },
  label:       { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginTop: 2 },
  labelActive: { color: '#0D9488' },
});

// ── Placeholder screen ──────────────────────────
function PlaceholderScreen(emoji, title) {
  return function Screen() {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' }}>
        <Text style={{ fontSize: 48 }}>{emoji}</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#0D9488', marginTop: 12 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>Tính năng đang phát triển...</Text>
      </View>
    );
  };
}

// ── Bottom Tab Navigator ────────────────────────
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle:      { backgroundColor: '#0D9488' },
        headerTitleStyle: { color: '#fff', fontWeight: '800', fontSize: 18 },
        headerTintColor:  '#fff',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 64,
          paddingBottom: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      {/* Khám phá */}
      <Tab.Screen
        name="Explore"
        component={HomeScreen}
        options={{
          headerTitle: '🌍 ExploreEase',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔍" label="Khám phá" focused={focused} />
          ),
        }}
      />

      {/* Bản đồ */}
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          headerTitle: '🗺️ Bản đồ',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🗺️" label="Bản đồ" focused={focused} />
          ),
        }}
      />

      {/* Sự kiện (placeholder) */}
      <Tab.Screen
        name="Events"
        component={PlaceholderScreen('🎉', 'Sự kiện')}
        options={{
          headerTitle: '🎉 Sự kiện',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎉" label="Sự kiện" focused={focused} />
          ),
        }}
      />

      {/* Đã lưu (placeholder) */}
      <Tab.Screen
        name="Saved"
        component={PlaceholderScreen('🔖', 'Đã lưu')}
        options={{
          headerTitle: '🔖 Đã lưu',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔖" label="Đã lưu" focused={focused} />
          ),
        }}
      />

      {/* Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: '👤 Hồ sơ của tôi',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Hồ sơ" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}