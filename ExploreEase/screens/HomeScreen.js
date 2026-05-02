// screens/HomeScreen.js
// Bản đồ chính: GPS, markers places + events, bottom card, chỉ đường
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Platform, Animated,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { height: SCREEN_H } = Dimensions.get('window');
const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';
const CARD_H = 170;

// ── Màu marker theo loại ───────────────────────────────────────
const MARKER_COLOR = { place: TEAL, event: '#F59E0B' };

// ── Mở Google Maps chỉ đường ───────────────────────────────────
function openDirections(lat, lng, label = '') {
  const encoded = encodeURIComponent(label);
  const url = Platform.select({
    ios:     `maps://?daddr=${lat},${lng}&q=${encoded}`,
    android: `google.navigation:q=${lat},${lng}`,
  });
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.canOpenURL(url)
    .then(ok => Linking.openURL(ok ? url : fallback))
    .catch(() => Linking.openURL(fallback));
}

// ── Bottom Info Card ───────────────────────────────────────────
function InfoCard({ item, onClose, onDetail, slideAnim }) {
  if (!item) return null;
  const isEvent = item.type === 'event';
  return (
    <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
      {/* Handle */}
      <View style={styles.handle} />

      {/* Type badge */}
      <View style={[styles.typeBadge, { backgroundColor: isEvent ? '#FEF3C7' : '#F0FDF9' }]}>
        <Text style={[styles.typeBadgeText, { color: isEvent ? '#D97706' : TEAL }]}>
          {isEvent ? '🎉 Sự kiện' : '📍 Địa điểm'}
        </Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardAddr} numberOfLines={1}>📍 {item.address}</Text>

      {/* Rating */}
      <View style={styles.ratingRow}>
        {[1,2,3,4,5].map(i => (
          <Text key={i} style={{ fontSize: 13, color: i <= Math.round(item.rating || 0) ? '#F59E0B' : '#D1D5DB' }}>★</Text>
        ))}
        <Text style={styles.ratingText}>
          {item.rating > 0 ? item.rating.toFixed(1) : 'Chưa có'} ({item.ratingCount || 0})
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.btnDetail}
          onPress={onDetail}
          activeOpacity={0.85}
        >
          <Text style={styles.btnDetailText}>Xem chi tiết</Text>
        </TouchableOpacity>

        {item.lat && item.lng ? (
          <TouchableOpacity
            style={styles.btnDir}
            onPress={() => openDirections(item.lat, item.lng, item.title)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDirText}>🧭 Chỉ đường</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const mapRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(CARD_H + 40)).current;

  const [location, setLocation]   = useState(null);
  const [locError, setLocError]   = useState(false);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);

  // ── Xin quyền + lấy GPS ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocError(true); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
    })();
  }, []);

  // ── Fetch places + events từ Firestore ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [placesSnap, eventsSnap] = await Promise.all([
          getDocs(collection(db, 'places')),
          getDocs(collection(db, 'events')),
        ]);
        const places = placesSnap.docs
          .map(d => ({ id: d.id, type: 'place', ...d.data() }))
          .filter(p => p.lat && p.lng);
        const events = eventsSnap.docs
          .map(d => ({ id: d.id, type: 'event', ...d.data() }))
          .filter(e => e.lat && e.lng);
        setItems([...places, ...events]);
      } catch (err) {
        console.error('Fetch map items:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Animate card ─────────────────────────────────────────────
  const showCard = useCallback((item) => {
    setSelected(item);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [slideAnim]);

  const hideCard = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: CARD_H + 40,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelected(null));
  }, [slideAnim]);

  // ── Recenter về vị trí hiện tại ─────────────────────────────
  const recenter = () => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       location.latitude,
      longitude:      location.longitude,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  // ── Region mặc định (TP.HCM nếu chưa có GPS) ────────────────
  const initialRegion = location
    ? { latitude: location.latitude,  longitude: location.longitude,  latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 10.7769,            longitude: 106.7009,            latitudeDelta: 0.12, longitudeDelta: 0.12 };

  return (
    <View style={styles.container}>

      {/* ── Bản đồ ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={hideCard}
      >
        {items.map(item => (
          <Marker
            key={`${item.type}-${item.id}`}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            pinColor={MARKER_COLOR[item.type] || TEAL}
            title={item.title}
            description={item.address}
            onPress={(e) => { e.stopPropagation?.(); showCard(item); }}
          />
        ))}
      </MapView>

      {/* ── Loading overlay ── */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={TEAL} size="large" />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}

      {/* ── Lỗi GPS ── */}
      {locError && (
        <View style={styles.locErrorBanner}>
          <Text style={styles.locErrorText}>⚠️ Không có quyền truy cập vị trí</Text>
        </View>
      )}

      {/* ── Legend ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
          <Text style={styles.legendLabel}>Địa điểm</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendLabel}>Sự kiện</Text>
        </View>
      </View>

      {/* ── Nút Recenter ── */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
        <Text style={styles.recenterIcon}>◎</Text>
      </TouchableOpacity>

      {/* ── Bottom Info Card ── */}
      <InfoCard
        item={selected}
        slideAnim={slideAnim}
        onClose={hideCard}
        onDetail={() => {
          hideCard();
          navigation.navigate('Detail', {
            item:       selected,
            collection: selected?.type === 'event' ? 'events' : 'places',
          });
        }}
      />

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0FDF9CC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: TEAL2, fontWeight: '600', fontSize: 14 },

  locErrorBanner: {
    position: 'absolute', top: 16, alignSelf: 'center',
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  locErrorText: { color: '#D97706', fontWeight: '600', fontSize: 13 },

  legend: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: '#ffffffDD', borderRadius: 12,
    padding: 10, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendLabel:{ fontSize: 12, fontWeight: '600', color: '#374151' },

  recenterBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  recenterIcon: { fontSize: 22, color: TEAL },

  // ── Card ──
  card: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: CARD_H,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 10,
  },
  typeBadge: {
    alignSelf: 'flex-start', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  cardAddr:  { fontSize: 12, color: '#6B7280', marginBottom: 6 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  ratingText:{ fontSize: 11, color: '#6B7280', marginLeft: 4 },

  btnRow:       { flexDirection: 'row', gap: 10 },
  btnDetail: {
    flex: 1, backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  btnDetailText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDir: {
    flex: 1, borderWidth: 1.5, borderColor: TEAL, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  btnDirText: { color: TEAL, fontWeight: '700', fontSize: 14 },

  closeBtn: {
    position: 'absolute', top: 14, right: 16,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  closeTxt: { color: '#6B7280', fontSize: 13, fontWeight: '700' },
});