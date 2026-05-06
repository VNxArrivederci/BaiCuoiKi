// screens/TravelPlanningScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Share,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  collection, query, where, orderBy, onSnapshot,
  deleteDoc, doc, serverTimestamp, addDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL = '#0D9488';

function timeAgo(ts) {
  if (!ts?.seconds) return '';
  const diff = Date.now() - ts.seconds * 1000;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hôm nay';
  if (d === 1) return 'Hôm qua';
  return `${d} ngày trước`;
}

function PlanCard({ item, onPress, onDelete, onShare }) {
  const totalStops = item.days?.reduce((s, d) => s + (d.stops?.length || 0), 0) || 0;
  const dayCount   = item.days?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.planIcon}>
          <Text style={{ fontSize: 26 }}>🗺️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {dayCount} ngày • {totalStops} điểm dừng
          </Text>
        </View>
        <Text style={styles.cardDate}>{timeAgo(item.updatedAt || item.createdAt)}</Text>
      </View>

      {/* Description */}
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}

      {/* Day chips */}
      {dayCount > 0 && (
        <View style={styles.dayChips}>
          {item.days.slice(0, 4).map((d, i) => (
            <View key={i} style={styles.dayChip}>
              <Text style={styles.dayChipText}>Ngày {d.dayNumber}</Text>
            </View>
          ))}
          {dayCount > 4 && (
            <View style={styles.dayChip}>
              <Text style={styles.dayChipText}>+{dayCount - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare} activeOpacity={0.8}>
          <Text style={styles.actionBtnText}>📤 Chia sẻ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete} activeOpacity={0.8}>
          <Text style={styles.actionBtnDeleteText}>🗑 Xóa</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function TravelPlanningScreen({ navigation }) {
  const { user } = useAuth();
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [newTitle, setNewTitle]     = useState('');

  // ── Realtime listener ────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    // Query có orderBy — cần composite index. Nếu chưa có index thì fallback getDocs
    const q = query(
      collection(db, 'travel_plans'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('onSnapshot error (cần tạo index):', err.message);
        // Fallback: getDocs không orderBy
        getDocs(query(collection(db, 'travel_plans'), where('userId', '==', user.uid)))
          .then(snap => {
            const data = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setPlans(data);
          })
          .catch(e => console.error('Fallback getDocs:', e))
          .finally(() => setLoading(false));
      },
    );
    return unsub;
  }, [user?.uid]);

  // ── Tạo kế hoạch mới ─────────────────────────────────────────
  const handleCreate = () => {
    setNewTitle('');
    setShowModal(true);
  };

  const confirmCreate = async () => {
    const title = newTitle.trim() || `Chuyến đi ${new Date().toLocaleDateString('vi-VN')}`;
    setShowModal(false);
    await createPlan(title);
  };

  const createPlan = async (title) => {
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'travel_plans'), {
        userId:      user.uid,
        userName:    user.displayName || user.email,
        title,
        description: '',
        days:        [{ dayNumber: 1, date: '', stops: [], notes: '' }],
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
        isPublic:    false,
      });
      navigation.navigate('TravelPlanDetail', { planId: ref.id, title });
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Xóa kế hoạch ────────────────────────────────────────────
  const handleDelete = (plan) => {
    Alert.alert('Xóa kế hoạch', `Xóa "${plan.title}"? Hành động này không thể hoàn tác.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'travel_plans', plan.id));
          } catch (err) {
            Alert.alert('Lỗi', err.message);
          }
        },
      },
    ]);
  };

  // ── Chia sẻ kế hoạch ────────────────────────────────────────
  const handleShare = async (plan) => {
    const totalStops = plan.days?.reduce((s, d) => s + (d.stops?.length || 0), 0) || 0;
    let text = `✈️ ${plan.title}\n`;
    if (plan.description) text += `${plan.description}\n`;
    text += `\n📅 ${plan.days?.length || 0} ngày | 📍 ${totalStops} điểm dừng\n\n`;
    plan.days?.forEach(day => {
      text += `━━ Ngày ${day.dayNumber}`;
      if (day.date) text += ` (${day.date})`;
      text += ` ━━\n`;
      day.stops?.forEach((stop, i) => {
        text += `  ${i + 1}. ${stop.title}`;
        if (stop.address) text += ` — ${stop.address}`;
        text += '\n';
        if (stop.note) text += `     📝 ${stop.note}\n`;
        if (stop.time) text += `     ⏰ ${stop.time}\n`;
      });
      if (day.notes) text += `  💬 Ghi chú: ${day.notes}\n`;
      text += '\n';
    });
    text += `📲 Chia sẻ từ ExploreEase`;

    try {
      await Share.share({ message: text, title: plan.title });
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={plans}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={TEAL} onRefresh={() => setRefreshing(false)} />}
        renderItem={({ item }) => (
          <PlanCard
            item={item}
            onPress={() => navigation.navigate('TravelPlanDetail', { planId: item.id, title: item.title })}
            onDelete={() => handleDelete(item)}
            onShare={() => handleShare(item)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🧳</Text>
            <Text style={styles.emptyTitle}>Chưa có kế hoạch nào</Text>
            <Text style={styles.emptyHint}>Nhấn nút + để tạo chuyến đi đầu tiên!</Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, creating && { opacity: 0.7 }]}
        onPress={handleCreate}
        disabled={creating}
        activeOpacity={0.85}
      >
        {creating
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.fabText}>＋ Tạo kế hoạch</Text>
        }
      </TouchableOpacity>

      {/* ── Create Plan Modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>✈️ Tạo kế hoạch mới</Text>
            <Text style={styles.modalSubtitle}>Nhập tên chuyến đi của bạn</Text>

            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={`VD: Du lịch Đà Lạt ${new Date().getFullYear()}`}
              placeholderTextColor="#9CA3AF"
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={confirmCreate}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={confirmCreate}
              >
                <Text style={styles.modalBtnConfirmText}>Tạo ngay 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  planIcon: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: '#F0FDF9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D1FAE5',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardMeta:  { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  cardDate:  { fontSize: 11, color: '#9CA3AF' },
  cardDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 10 },

  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dayChip: {
    backgroundColor: '#F0FDF9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  dayChipText: { fontSize: 11, fontWeight: '700', color: TEAL },

  cardActions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  actionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F0FDF9', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D1FAE5',
  },
  actionBtnText:       { fontSize: 13, fontWeight: '700', color: TEAL },
  actionBtnDelete:     { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' },
  actionBtnDeleteText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },

  empty:     { paddingTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 18, fontWeight: '800', color: '#374151', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  fab: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    backgroundColor: TEAL, borderRadius: 28,
    paddingHorizontal: 28, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', marginBottom: 18 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
    marginBottom: 20,
  },
  modalBtns:          { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  modalBtnCancelText:  { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalBtnConfirm: {
    flex: 2, paddingVertical: 13, borderRadius: 12,
    backgroundColor: TEAL, alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});