// screens/SocialFeedScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import {
  collection, query, orderBy, limit, getDocs, onSnapshot,
  doc, setDoc, deleteDoc, getDoc, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/activityLogger';

const TEAL = '#0D9488';

// ── Time ago ────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts?.seconds) return '';
  const diff = Date.now() - ts.seconds * 1000;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (h < 24) return `${h} giờ trước`;
  return `${d} ngày trước`;
}

// ── Avatar ───────────────────────────────────────────────────────
function Avatar({ name, photoURL, size = 42 }) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: TEAL,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>
        {(name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Activity icon + message ──────────────────────────────────────
function activityContent(item) {
  switch (item.type) {
    case 'review':
      return {
        icon: '⭐',
        text: `đã đánh giá ${item.targetName || 'một địa điểm'}`,
        sub:  item.rating ? `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}` : '',
      };
    case 'follow':
      return {
        icon: '👥',
        text: `đã theo dõi ${item.targetName || 'một người dùng'}`,
        sub:  '',
      };
    case 'add_place':
      return {
        icon: '📍',
        text: `đã thêm địa điểm "${item.targetName || ''}"`,
        sub:  item.category || '',
      };
    case 'add_event':
      return {
        icon: '🎉',
        text: `đã tạo sự kiện "${item.targetName || ''}"`,
        sub:  item.category || '',
      };
    default:
      return { icon: '📌', text: 'đã có hoạt động mới', sub: '' };
  }
}

// ── Activity Card ────────────────────────────────────────────────
function ActivityCard({ item, onPressTarget, onPressUser }) {
  const { icon, text, sub } = activityContent(item);
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => onPressUser(item)} activeOpacity={0.8}>
        <Avatar name={item.actorName} photoURL={item.actorPhoto} />
      </TouchableOpacity>

      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.actorName} onPress={() => onPressUser(item)}>
            {item.actorName}
          </Text>
          <Text style={styles.activityText}> {text}</Text>
        </View>

        {sub ? (
          <Text style={[styles.subText, item.type === 'review' && { color: '#F59E0B' }]}>
            {sub}
          </Text>
        ) : null}

        <Text style={styles.timeText}>{icon} {timeAgo(item.createdAt)}</Text>
      </View>

      {item.targetId && (item.type === 'review' || item.type === 'add_place' || item.type === 'add_event') && (
        <TouchableOpacity style={styles.viewBtn} onPress={() => onPressTarget(item)}>
          <Text style={styles.viewBtnText}>Xem</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── User Search Result ───────────────────────────────────────────
function UserCard({ item, currentUid, onFollow, onChat, followMap }) {
  const isFollowing = !!followMap[item.uid];
  const isSelf = item.uid === currentUid;

  return (
    <View style={styles.userCard}>
      <Avatar name={item.displayName} photoURL={item.photoURL} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'Người dùng'}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
      </View>
      {!isSelf && (
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={() => onFollow(item, isFollowing)}
            activeOpacity={0.8}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? '✓ Đang theo dõi' : '+ Theo dõi'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatSmallBtn} onPress={() => onChat(item)}>
            <Text style={{ fontSize: 16 }}>💬</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── TABS ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'feed',    label: '📰 Bảng tin' },
  { key: 'people',  label: '👥 Mọi người' },
  { key: 'following', label: '❤️ Đang theo dõi' },
];

export default function SocialFeedScreen({ navigation }) {
  const { user } = useAuth();
  const [tab, setTab]             = useState('feed');
  const [feed, setFeed]           = useState([]);
  const [users, setUsers]         = useState([]);
  const [following, setFollowing] = useState([]);
  const [followMap, setFollowMap] = useState({}); // { uid: true }
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load activity feed ────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'activity_feed'),
        orderBy('createdAt', 'desc'),
        limit(30),
      );
      const snap = await getDocs(q);
      setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error('Feed:', e); }
  }, []);

  // ── Load users ────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error('Users:', e); }
  }, []);

  // ── Load following list + map ────────────────────────────────
  const loadFollowing = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'following'));
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setFollowing(list);
      const map = {};
      list.forEach(f => { map[f.uid] = true; });
      setFollowMap(map);
    } catch (e) { console.error('Following:', e); }
  }, [user?.uid]);

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadFeed(), loadUsers(), loadFollowing()]);
      setLoading(false);
    })();
  }, [loadFeed, loadUsers, loadFollowing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadUsers(), loadFollowing()]);
    setRefreshing(false);
  }, [loadFeed, loadUsers, loadFollowing]);

  // ── Follow / Unfollow ────────────────────────────────────────
  const handleFollow = useCallback(async (targetUser, isFollowing) => {
    if (!user?.uid) return;
    const followRef = doc(db, 'users', user.uid, 'following', targetUser.uid);
    const followerRef = doc(db, 'users', targetUser.uid, 'followers', user.uid);

    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(followRef);
        await deleteDoc(followerRef);
        setFollowMap(prev => { const m = { ...prev }; delete m[targetUser.uid]; return m; });
        setFollowing(prev => prev.filter(f => f.uid !== targetUser.uid));
      } else {
        // Follow
        const data = {
          uid:       targetUser.uid,
          name:      targetUser.displayName || '',
          photoURL:  targetUser.photoURL    || null,
          followedAt: serverTimestamp(),
        };
        await setDoc(followRef, data);
        await setDoc(followerRef, {
          uid:      user.uid,
          name:     user.displayName || '',
          photoURL: user.photoURL    || null,
          followedAt: serverTimestamp(),
        });
        setFollowMap(prev => ({ ...prev, [targetUser.uid]: true }));
        setFollowing(prev => [...prev, data]);

        // Ghi activity
        await logActivity({
          type:       'follow',
          actorId:    user.uid,
          actorName:  user.displayName || user.email,
          actorPhoto: user.photoURL || null,
          targetId:   targetUser.uid,
          targetName: targetUser.displayName || '',
        });
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    }
  }, [user]);

  // ── Navigate to chat ─────────────────────────────────────────
  const handleChat = useCallback((targetUser) => {
    navigation.navigate('ChatList', {
      screen: 'Chat',
      params: {
        chat: null,
        otherUser: {
          uid:      targetUser.uid,
          name:     targetUser.displayName || 'Người dùng',
          photoURL: targetUser.photoURL || null,
        },
      },
    });
  }, [navigation]);

  // ── Navigate to detail ────────────────────────────────────────
  const handlePressTarget = useCallback((item) => {
    if (!item.targetId || !item.collection) return;
    navigation.navigate('Explore', {
      screen: 'Detail',
      params: { item: { id: item.targetId, title: item.targetName }, collection: item.collection },
    });
  }, [navigation]);

  const renderFeed = () => (
    <FlatList
      data={feed}
      keyExtractor={i => i.id}
      renderItem={({ item }) => (
        <ActivityCard
          item={item}
          onPressTarget={handlePressTarget}
          onPressUser={() => {}}
        />
      )}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>📰</Text>
          <Text style={styles.emptyTitle}>Chưa có hoạt động</Text>
          <Text style={styles.emptyHint}>Hãy theo dõi mọi người để thấy bảng tin</Text>
        </View>
      )}
    />
  );

  const renderPeople = () => (
    <FlatList
      data={users.filter(u => u.uid !== user?.uid)}
      keyExtractor={i => i.uid}
      renderItem={({ item }) => (
        <UserCard
          item={item}
          currentUid={user?.uid}
          followMap={followMap}
          onFollow={handleFollow}
          onChat={handleChat}
        />
      )}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>👥</Text>
          <Text style={styles.emptyTitle}>Chưa có người dùng</Text>
        </View>
      )}
    />
  );

  const renderFollowing = () => (
    <FlatList
      data={following}
      keyExtractor={i => i.uid}
      renderItem={({ item }) => (
        <UserCard
          item={{ ...item, displayName: item.name }}
          currentUid={user?.uid}
          followMap={followMap}
          onFollow={handleFollow}
          onChat={handleChat}
        />
      )}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>❤️</Text>
          <Text style={styles.emptyTitle}>Chưa theo dõi ai</Text>
          <Text style={styles.emptyHint}>Vào tab "Mọi người" để theo dõi</Text>
        </View>
      )}
    />
  );

  return (
    <View style={styles.screen}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TEAL} size="large" />
        </View>
      ) : tab === 'feed' ? renderFeed()
        : tab === 'people' ? renderPeople()
        : renderFollowing()
      }
    </View>
  );
}



const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: TEAL },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: TEAL, fontWeight: '800' },

  // ── Activity card ──
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    gap: 12,
  },
  cardContent:  { flex: 1 },
  cardRow:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  actorName:    { fontSize: 14, fontWeight: '800', color: TEAL },
  activityText: { fontSize: 14, color: '#374151', flex: 1 },
  subText:      { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  timeText:     { fontSize: 11, color: '#9CA3AF' },
  viewBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#F0FDF9', borderWidth: 1.5, borderColor: '#D1FAE5',
    alignSelf: 'flex-start',
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: TEAL },

  // ── User card ──
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    gap: 12,
  },
  userInfo:    { flex: 1 },
  userName:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  userEmail:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#F9FAFB',
  },
  followBtnActive:    { backgroundColor: TEAL },
  followBtnText:      { fontSize: 12, fontWeight: '700', color: TEAL },
  followBtnTextActive:{ color: '#fff' },
  chatSmallBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0FDF9', borderWidth: 1.5, borderColor: '#D1FAE5',
    justifyContent: 'center', alignItems: 'center',
  },

  empty:     { paddingTop: 80, alignItems: 'center', gap: 10 },
  emptyTitle:{ fontSize: 16, fontWeight: '800', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});