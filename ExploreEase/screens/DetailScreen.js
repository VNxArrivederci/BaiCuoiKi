// screens/DetailScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Image, Linking,
} from 'react-native';
import {
  doc, getDoc, deleteDoc, collection, addDoc, getDocs,
  query, orderBy, serverTimestamp, updateDoc, setDoc, deleteField,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/activityLogger';

const TEAL = '#0D9488';
const ERROR = '#EF4444';
const GOLD  = '#F59E0B';

// ── Star rating ────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => !readonly && onChange?.(i)}
          disabled={readonly}
          activeOpacity={readonly ? 1 : 0.7}
        >
          <Text style={{ fontSize: readonly ? 16 : 28, color: i <= value ? GOLD : '#D1D5DB' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Mở Google Maps ─────────────────────────────────────────────
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

export default function DetailScreen({ route, navigation }) {
  const { item, collection: col } = route.params;
  const { user } = useAuth();

  const [data, setData]               = useState(item);
  const [reviews, setReviews]         = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [myRating, setMyRating]       = useState(0);
  const [comment, setComment]         = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwner    = user?.uid === data.authorId;
  const authorId   = data.authorId;
  const isSelfPost = user?.uid === authorId;

  // ── Fetch latest data ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, col, data.id));
      if (snap.exists()) setData({ id: snap.id, ...snap.data() });
    })();
  }, []);

  // ── Check follow status ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !authorId || isSelfPost) return;
    (async () => {
      const followRef = doc(db, 'users', user.uid, 'following', authorId);
      const snap      = await getDoc(followRef);
      setIsFollowing(snap.exists());
    })();
  }, [user?.uid, authorId, isSelfPost]);

  // ── Follow / Unfollow ────────────────────────────────────────
  const handleFollow = async () => {
    if (!user?.uid || !authorId || followLoading) return;
    setFollowLoading(true);
    try {
      const followRef   = doc(db, 'users', user.uid, 'following', authorId);
      const followerRef = doc(db, 'users', authorId, 'followers', user.uid);

      if (isFollowing) {
        await deleteDoc(followRef);
        await deleteDoc(followerRef);
        setIsFollowing(false);
      } else {
        await setDoc(followRef, {
          uid:       authorId,
          name:      data.authorName || '',
          photoURL:  null,
          followedAt: serverTimestamp(),
        });
        await setDoc(followerRef, {
          uid:       user.uid,
          name:      user.displayName || '',
          photoURL:  user.photoURL || null,
          followedAt: serverTimestamp(),
        });
        setIsFollowing(true);
        await logActivity({
          type:       'follow',
          actorId:    user.uid,
          actorName:  user.displayName || user.email,
          actorPhoto: user.photoURL || null,
          targetId:   authorId,
          targetName: data.authorName || '',
        });
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Open chat with author ─────────────────────────────────────
  const handleChat = () => {
    if (!authorId) return;
    navigation.navigate('ChatList', {
      screen: 'Chat',
      params: {
        chat: null,
        otherUser: {
          uid:      authorId,
          name:     data.authorName || 'Người đăng',
          photoURL: null,
        },
      },
    });
  };

  // ── Fetch reviews ────────────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const q = query(
        collection(db, col, data.id, 'reviews'),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoadingReviews(false); }
  }, [col, data.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // ── Submit review ────────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (myRating === 0) { Alert.alert('Lỗi', 'Vui lòng chọn số sao'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, col, data.id, 'reviews'), {
        userId:    user.uid,
        userName:  user.displayName || user.email,
        rating:    myRating,
        comment:   comment.trim(),
        createdAt: serverTimestamp(),
      });

      const allReviews = [...reviews, { rating: myRating }];
      const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
      await updateDoc(doc(db, col, data.id), {
        rating:      parseFloat(avg.toFixed(1)),
        ratingCount: allReviews.length,
      });

      // Ghi activity
      await logActivity({
        type:       'review',
        actorId:    user.uid,
        actorName:  user.displayName || user.email,
        actorPhoto: user.photoURL || null,
        targetId:   data.id,
        targetName: data.title,
        collection: col,
        rating:     myRating,
      });

      setMyRating(0);
      setComment('');
      await fetchReviews();
      const snap = await getDoc(doc(db, col, data.id));
      if (snap.exists()) setData({ id: snap.id, ...snap.data() });
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete review ────────────────────────────────────────────
  const handleDeleteReview = async (reviewId) => {
    Alert.alert('Xóa bình luận', 'Bạn có chắc muốn xóa?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, col, data.id, 'reviews', reviewId));
            const remaining = reviews.filter(r => r.id !== reviewId);
            const avg = remaining.length
              ? remaining.reduce((s, r) => s + r.rating, 0) / remaining.length : 0;
            await updateDoc(doc(db, col, data.id), {
              rating:      remaining.length ? parseFloat(avg.toFixed(1)) : 0,
              ratingCount: remaining.length,
            });
            await fetchReviews();
            const snap = await getDoc(doc(db, col, data.id));
            if (snap.exists()) setData({ id: snap.id, ...snap.data() });
          } catch (e) { Alert.alert('Lỗi', e.message); }
        },
      },
    ]);
  };

  // ── Delete post ──────────────────────────────────────────────
  const handleDeletePost = () => {
    Alert.alert('Xóa bài viết', 'Bài viết và tất cả đánh giá sẽ bị xóa vĩnh viễn. Tiếp tục?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          setDeletingPost(true);
          try {
            const q    = query(collection(db, col, data.id, 'reviews'));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
            await deleteDoc(doc(db, col, data.id));
            navigation.goBack();
          } catch (e) { Alert.alert('Lỗi', e.message); }
          finally { setDeletingPost(false); }
        },
      },
    ]);
  };

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0FDF9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {col === 'events' ? '🎉 Sự kiện' : '📍 Địa điểm'}
              </Text>
            </View>
            {isOwner && (
              <TouchableOpacity style={styles.deletePostBtn} onPress={handleDeletePost} disabled={deletingPost}>
                {deletingPost
                  ? <ActivityIndicator color={ERROR} size="small" />
                  : <Text style={styles.deletePostText}>🗑 Xóa bài</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.address}>📍 {data.address}</Text>

          <View style={styles.ratingRow}>
            <StarRating value={Math.round(data.rating || 0)} readonly />
            <Text style={styles.ratingVal}>{data.rating > 0 ? data.rating.toFixed(1) : 'Chưa có'}</Text>
            <Text style={styles.ratingCount}>({data.ratingCount || 0} đánh giá)</Text>
          </View>

          {/* Chỉ đường */}
          {data.lat && data.lng && (
            <TouchableOpacity
              style={styles.dirBtn}
              onPress={() => openDirections(data.lat, data.lng, data.title)}
              activeOpacity={0.85}
            >
              <Text style={styles.dirBtnText}>🧭 Chỉ đường</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Description ── */}
        {data.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.desc}>{data.description}</Text>
          </View>
        ) : null}

        {/* ── Event details ── */}
        {col === 'events' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin sự kiện</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bắt đầu</Text>
              <Text style={styles.infoValue}>{formatDate(data.startDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Kết thúc</Text>
              <Text style={styles.infoValue}>{formatDate(data.endDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Giá vé</Text>
              <Text style={[styles.infoValue, { color: TEAL, fontWeight: '700' }]}>
                {data.price || 'Miễn phí'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Author + Follow + Chat ── */}
        <View style={styles.authorBox}>
          <View style={styles.authorAvatar}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              {(data.authorName || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{data.authorName || 'Ẩn danh'}</Text>
            <Text style={styles.authorLabel}>Người đăng</Text>
          </View>

          {/* Chỉ hiện nếu không phải bài của mình */}
          {!isSelfPost && (
            <View style={styles.authorActions}>
              {/* Follow */}
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading}
                activeOpacity={0.8}
              >
                {followLoading
                  ? <ActivityIndicator color={isFollowing ? '#fff' : TEAL} size="small" />
                  : <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                      {isFollowing ? '✓' : '+ Theo dõi'}
                    </Text>
                }
              </TouchableOpacity>

              {/* Chat */}
              <TouchableOpacity style={styles.chatBtn} onPress={handleChat} activeOpacity={0.8}>
                <Text style={{ fontSize: 16 }}>💬</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Write review ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đánh giá của bạn</Text>
          <StarRating value={myRating} onChange={setMyRating} />
          <TextInput
            style={[styles.input, { marginTop: 12 }]}
            value={comment}
            onChangeText={setComment}
            placeholder="Chia sẻ cảm nhận của bạn..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.submitBtn, (myRating === 0 || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmitReview}
            disabled={myRating === 0 || submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>⭐ Gửi đánh giá</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Reviews list ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bình luận ({reviews.length})</Text>

          {loadingReviews ? (
            <ActivityIndicator color={TEAL} style={{ marginTop: 12 }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.noReview}>Chưa có đánh giá nào. Hãy là người đầu tiên!</Text>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                      {(r.userName || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewUser}>{r.userName}</Text>
                    <StarRating value={r.rating} readonly />
                  </View>
                  {r.userId === user?.uid && (
                    <TouchableOpacity onPress={() => handleDeleteReview(r.id)}>
                      <Text style={styles.deleteReviewBtn}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                {r.createdAt?.seconds && (
                  <Text style={styles.reviewDate}>
                    {new Date(r.createdAt.seconds * 1000).toLocaleDateString('vi-VN')}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },

  header: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  typeBadge: {
    backgroundColor: '#F0FDF9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: TEAL },
  deletePostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1.5, borderColor: ERROR,
  },
  deletePostText: { color: ERROR, fontSize: 13, fontWeight: '700' },

  title:   { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  address: { fontSize: 13, color: '#6B7280', marginBottom: 10 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ratingVal:   { fontSize: 16, fontWeight: '800', color: '#111827' },
  ratingCount: { fontSize: 12, color: '#9CA3AF' },

  dirBtn: {
    backgroundColor: '#F0FDF9', borderWidth: 1.5, borderColor: TEAL,
    borderRadius: 12, paddingVertical: 10, alignItems: 'center',
  },
  dirBtnText: { color: TEAL, fontWeight: '700', fontSize: 14 },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  desc:         { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#374151' },

  // ── Author box ──
  authorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  authorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
  },
  authorName:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  authorLabel:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  authorActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  followBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#F9FAFB',
    minWidth: 90, alignItems: 'center',
  },
  followBtnActive:     { backgroundColor: TEAL },
  followBtnText:       { fontSize: 12, fontWeight: '700', color: TEAL },
  followBtnTextActive: { color: '#fff' },

  chatBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0FDF9', borderWidth: 1.5, borderColor: '#D1FAE5',
    justifyContent: 'center', alignItems: 'center',
  },

  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
    minHeight: 80,
  },
  submitBtn: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: 12,
  },
  submitBtnDisabled: { backgroundColor: '#A7F3D0' },
  submitBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },

  reviewCard: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingTop: 12, marginTop: 12,
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 6,
  },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
  },
  reviewUser:      { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  reviewComment:   { fontSize: 14, color: '#4B5563', lineHeight: 20, marginTop: 4 },
  reviewDate:      { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  deleteReviewBtn: { fontSize: 18, color: '#9CA3AF', padding: 4 },
  noReview:        { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
});