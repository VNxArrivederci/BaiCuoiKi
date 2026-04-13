// screens/ExploreScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import {
  collection, query, orderBy, limit, startAfter,
  getDocs, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL = '#0D9488';
const PAGE_SIZE = 10;

const CATEGORIES = [
  { key: '',          label: '🌐 Tất cả' },
  { key: 'food',      label: '🍜 Ẩm thực' },
  { key: 'culture',   label: '🏛️ Văn hóa' },
  { key: 'shopping',  label: '🛍️ Mua sắm' },
  { key: 'nature',    label: '🌿 Thiên nhiên' },
  { key: 'adventure', label: '🧗 Phiêu lưu' },
  { key: 'nightlife', label: '🌃 Về đêm' },
  { key: 'wellness',  label: '🧘 Sức khỏe' },
  { key: 'history',   label: '📜 Lịch sử' },
];

const SORT_OPTIONS = [
  { key: 'createdAt', label: '🕐 Mới nhất' },
  { key: 'rating',    label: '⭐ Đánh giá' },
];

function StarBar({ rating }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Text key={i} style={{ fontSize: 12, color: i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB' }}>★</Text>
      ))}
      <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>{rating > 0 ? rating.toFixed(1) : 'Chưa có'}</Text>
    </View>
  );
}

function PlaceCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {CATEGORIES.find(c => c.key === item.category)?.label || item.category}
          </Text>
        </View>
        {item.targetStyle?.length > 0 && (
          <Text style={styles.styleTag}>{item.targetStyle[0]} 🧳</Text>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.address}</Text>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <StarBar rating={item.rating || 0} />
        <Text style={styles.ratingCount}>({item.ratingCount || 0} đánh giá)</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ExploreScreen({ navigation }) {
  const { user } = useAuth();

  // ── useMemo để ổn định reference, tránh re-render vô tận ──────
  const userInterests   = useMemo(() => user?.profile?.interests || [], [user?.profile?.interests]);
  const userTravelStyle = user?.profile?.travelStyle || '';

  const [places, setPlaces]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [category, setCategory]       = useState('');
  const [sortBy, setSortBy]           = useState('createdAt');
  const [search, setSearch]           = useState('');

  const lastDocRef = useRef(null);

  // ── Build Firestore query ──────────────────────────────────────
  const buildQuery = useCallback((afterDoc = null) => {
    let q = query(
      collection(db, 'places'),
      orderBy(sortBy, 'desc'),
      limit(PAGE_SIZE),
    );
    if (category) {
      q = query(collection(db, 'places'), where('category', '==', category), orderBy(sortBy, 'desc'), limit(PAGE_SIZE));
    }
    if (afterDoc) {
      q = query(
        collection(db, 'places'),
        ...(category ? [where('category', '==', category)] : []),
        orderBy(sortBy, 'desc'),
        startAfter(afterDoc),
        limit(PAGE_SIZE),
      );
    }
    return q;
  }, [category, sortBy]);

  // ── Score item theo user preferences ──────────────────────────
  const scoreItem = useCallback((item) => {
    let score = 0;
    if (userInterests.includes(item.category)) score += 2;
    if (item.targetStyle?.includes(userTravelStyle)) score += 1;
    score += (item.rating || 0) * 0.5;
    return score;
  }, [userInterests, userTravelStyle]);

  // ── Fetch first page ───────────────────────────────────────────
  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(buildQuery());
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => scoreItem(b) - scoreItem(a));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setPlaces(docs);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildQuery, scoreItem]);

  // ── Load more ──────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(buildQuery(lastDocRef.current));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => scoreItem(b) - scoreItem(a));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setPlaces(prev => [...prev, ...docs]);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, buildQuery, scoreItem]);

  // ── Refresh ────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastDocRef.current = null;
    await fetchPlaces();
    setRefreshing(false);
  }, [fetchPlaces]);

  useEffect(() => {
    lastDocRef.current = null;
    fetchPlaces();
  }, [fetchPlaces]);

  // ── Filter by search (client-side) ────────────────────────────
  const displayed = search.trim()
    ? places.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.address.toLowerCase().includes(search.toLowerCase())
      )
    : places;

  const renderFooter = () =>
    loadingMore ? <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} /> : null;

  return (
    <View style={styles.screen}>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm kiếm địa điểm..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.sortBtn, sortBy === o.key && styles.sortBtnActive]}
            onPress={() => setSortBy(o.key)}
          >
            <Text style={[styles.sortText, sortBy === o.key && styles.sortTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={c => c.key}
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.catChip, category === c.key && styles.catChipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {loading ? (
        <ActivityIndicator color={TEAL} style={{ flex: 1, marginTop: 40 }} size="large" />
      ) : displayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={styles.emptyText}>Chưa có địa điểm nào</Text>
          <Text style={styles.emptyHint}>Hãy thêm địa điểm đầu tiên!</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <PlaceCard
              item={item}
              onPress={() => navigation.navigate('Detail', { item, collection: 'places' })}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D1FAE5',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  sortRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  sortBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  sortBtnActive:  { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  sortText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  sortTextActive: { color: TEAL },

  catList: { maxHeight: 46, marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  catChipActive: { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  catText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  catTextActive: { color: TEAL },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  categoryBadge: { backgroundColor: '#F0FDF9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText:  { fontSize: 11, fontWeight: '700', color: TEAL },
  styleTag:      { fontSize: 11, color: '#9CA3AF' },
  cardTitle:     { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  cardAddress:   { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  cardDesc:      { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 8 },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingCount:   { fontSize: 11, color: '#9CA3AF' },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF' },
});