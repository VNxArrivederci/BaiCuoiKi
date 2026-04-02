// screens/HomeScreen.js
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🌍</Text>
      <Text style={styles.title}>ExploreEase</Text>
      <Text style={styles.sub}>Tính năng khám phá sẽ được thêm vào đây</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },
  emoji:     { fontSize: 56, marginBottom: 16 },
  title:     { fontSize: 26, fontWeight: '800', color: '#0F766E' },
  sub:       { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});