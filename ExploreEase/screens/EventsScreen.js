// screens/EventsScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Image,
} from 'react-native';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL      = '#0D9488';
const PAGE_SIZE  = 10;
const PLACEHOLDER = 'https://via.placeholder.com/400x200?text=No+Image';

const STATUS_OPTS = [
  { key: '',          label: '📋 Tất cả' },
  { key: 'incoming',  label: '🔜 Sắp diễn ra' },
  { key: 'ongoing',   label: '🔥 Đang diễn ra' },
  { key: 'completed', label: '✅ Đã kết thúc' },
];

const SORT_OPTIONS = [
  { key: 'createdAt', label: '🕐 Mới nhất' },
  { key: 'rating',    label: '⭐ Đánh giá' },
];

const RATING_OPTS = [
  { key: 0,   label: 'Tất cả' },
  { key: 3,   label: '⭐ 3+' },
  { key: 4,   label: '⭐ 4+' },
  { key: 4.5, label: '⭐ 4.5+' },
];

const PRICE_OPTS = [
  { key: 'all',  label: '💰 Tất cả' },
  { key: 'free', label: '🆓 Miễn phí' },
  { key: 'paid', label: '🎟 Có phí' },
];

function computeStatus(item) {
  const now = new Date(), start = new Date(item.startDate), end = new Date(item.endDate);
  if (now < start) return 'incoming';
  if (now > end)   return 'completed';
  return 'ongoing';
}

function StatusBadge({ status }) {
  const map = {
    incoming:  { label: '🔜 Sắp diễn ra', bg: '#EFF6FF', color: '#3B82F6' },
    ongoing:   { label: '🔥 Đang diễn ra', bg: '#FEF3C7', color: '#D97706' },
    completed: { label: '✅ Đã kết thúc',  bg: '#F0FDF4', color: '#16A34A' },
  };
  const s = map[status] || { label: status, bg: '#F3F4F6', color: '#6B7280' };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function Countdown({ startDate }) {
  const diff = new Date(startDate) - new Date();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return (
    <Text style={styles.countdown}>
      ⏱ {days > 0 ? `${days} ngày ` : ''}{hours} giờ nữa
    </Text>
  );
}

function StarBar({ rating }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <Text key={i} style={{ fontSize: 12, color: i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB' }}>★</Text>
      ))}
      <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>
        {rating > 0 ? rating.toFixed(1) : 'Chưa có'}
      </Text>
    </View>
  );
}

function EventCard({ item, onPress }) {
  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';
  const isFree = !item.price || item.price === 'Miễn phí';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Thumbnail */}
      <Image
        source={{ uri: item.imageURL || PLACEHOLDER }}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <StatusBadge status={item.status} />
          <View style={[styles.priceBadge, { backgroundColor: isFree ? '#F0FDF9' : '#FEF3C7' }]}>
            <Text style={[styles.priceText, { color: isFree ? TEAL : '#D97706' }]}>
              {isFree ? '🆓 Miễn phí' : `🎟 ${item.price}`}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.address}</Text>
        {item.description
          ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          : null}

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>🗓 {formatDate(item.startDate)} → {formatDate(item.endDate)}</Text>
        </View>

        {item.status === 'incoming' && <Countdown startDate={item.startDate} />}

        <View style={styles.cardFooter}>
          <StarBar rating={item.rating || 0} />
          <Text style={styles.ratingCount}>({item.ratingCount || 0} đánh giá)</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EventsScreen({ navigation }) {
  const { user } = useAuth();
  const userInterests   = useMemo(() => user?.profile?.interests || [], [user?.profile?.interests]);
  const userTravelStyle = user?.profile?.travelStyle || '';

  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy]           = useState('createdAt');
  const [search, setSearch]           = useState('');
  const [minRating, setMinRating]     = useState(0);
  const [priceFilter, setPriceFilter] = useState('all');

  const lastDocRef = useRef(null);

  const buildQuery = useCallback((afterDoc = null) => {
    const constraints = [orderBy(sortBy, 'desc'), limit(PAGE_SIZE)];
    if (afterDoc) constraints.push(startAfter(afterDoc));
    return query(collection(db, 'events'), ...constraints);
  }, [sortBy]);

  const scoreItem = useCallback((item) => {
    let score = 0;
    if (userInterests.includes(item.category)) score += 2;
    if (item.targetStyle?.includes(userTravelStyle)) score += 1;
    score += (item.rating || 0) * 0.5;
    return score;
  }, [userInterests, userTravelStyle]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(buildQuery());
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data(), status: computeStatus(d.data()) }));
      docs.sort((a, b) => scoreItem(b) - scoreItem(a));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setEvents(docs);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildQuery, scoreItem]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(buildQuery(lastDocRef.current));
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data(), status: computeStatus(d.data()) }));
      docs.sort((a, b) => scoreItem(b) - scoreItem(a));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setEvents(prev => [...prev, ...docs]);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, buildQuery, scoreItem]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastDocRef.current = null;
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  useEffect(() => {
    lastDocRef.current = null;
    fetchEvents();
  }, [fetchEvents]);

  // ── Client-side filters ──────────────────────────────────────
  const displayed = events.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (minRating > 0 && (e.rating || 0) < minRating) return false;
    if (priceFilter === 'free' && e.price && e.price !== 'Miễn phí') return false;
    if (priceFilter === 'paid' && (!e.price || e.price === 'Miễn phí')) return false;
    if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase()) &&
        !e.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={styles.screen}>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm kiếm sự kiện..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Sort */}
      <View style={styles.filterRow}>
        {SORT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.filterBtn, sortBy === o.key && styles.filterBtnActive]}
            onPress={() => setSortBy(o.key)}
          >
            <Text style={[styles.filterText, sortBy === o.key && styles.filterTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rating filter */}
      <View style={styles.filterRow}>
        {RATING_OPTS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.filterBtn, minRating === o.key && styles.filterBtnActive]}
            onPress={() => setMinRating(o.key)}
          >
            <Text style={[styles.filterText, minRating === o.key && styles.filterTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Price filter */}
      <View style={styles.filterRow}>
        {PRICE_OPTS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.filterBtn, priceFilter === o.key && styles.filterBtnActive]}
            onPress={() => setPriceFilter(o.key)}
          >
            <Text style={[styles.filterText, priceFilter === o.key && styles.filterTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filter */}
      <FlatList
        horizontal
        data={STATUS_OPTS}
        keyExtractor={s => s.key}
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={[styles.catChip, statusFilter === s.key && styles.catChipActive]}
            onPress={() => setStatusFilter(s.key)}
          >
            <Text style={[styles.catText, statusFilter === s.key && styles.catTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {loading ? (
        <ActivityIndicator color={TEAL} style={{ flex: 1, marginTop: 40 }} size="large" />
      ) : displayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>🎉</Text>
          <Text style={styles.emptyText}>Không tìm thấy sự kiện</Text>
          <Text style={styles.emptyHint}>Thử thay đổi bộ lọc</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <EventCard
              item={item}
              onPress={() => navigation.navigate('Detail', { item, collection: 'events' })}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={() => loadingMore
            ? <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} /> : null}
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

  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 6, flexWrap: 'wrap' },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  filterBtnActive:  { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  filterText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: TEAL },

  catList: { maxHeight: 46, marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  catChipActive: { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  catText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  catTextActive: { color: TEAL },

  badge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  thumbnail:   { width: '100%', height: 150, backgroundColor: '#E5E7EB' },
  cardBody:    { padding: 12 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  priceBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priceText:   { fontSize: 11, fontWeight: '700' },
  cardTitle:   { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  cardAddress: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cardDesc:    { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 6 },
  dateRow:     { marginBottom: 4 },
  dateText:    { fontSize: 12, color: '#6B7280' },
  countdown:   { fontSize: 11, color: '#F59E0B', fontWeight: '700', marginTop: 4 },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  ratingCount: { fontSize: 11, color: '#9CA3AF' },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF' },
});