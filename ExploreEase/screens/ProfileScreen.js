// screens/ProfileScreen.js
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';

const INTEREST_LABELS = {
  food: '🍜 Ẩm thực', culture: '🏛️ Văn hóa', shopping: '🛍️ Mua sắm',
  nature: '🌿 Thiên nhiên', adventure: '🧗 Phiêu lưu',
  nightlife: '🌃 Về đêm', wellness: '🧘 Sức khỏe', history: '📜 Lịch sử',
};
const STYLE_LABELS = {
  solo: '🧳 Solo', couple: '💑 Couple',
  family: '👨‍👩‍👧 Gia đình', group: '👫 Nhóm',
};

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const profile = user?.profile || {};

  const displayName  = user?.displayName  || profile.displayName || 'Chưa đặt tên';
  const email        = user?.email        || '';
  const photoURL     = profile.photoURL   || user?.photoURL || null;
  const travelStyle  = profile.travelStyle || null;
  const interests    = profile.interests  || [];
  const age          = profile.age        || null;
  const gender       = profile.gender     || null;
  const provider     = profile.provider   || 'email';
  const isAdmin      = profile.isAdmin    === true;
  const createdAt    = profile.createdAt?.toDate?.()
    ? profile.createdAt.toDate().toLocaleDateString('vi-VN')
    : 'Không rõ';

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>

      {/* Avatar + tên */}
      <View style={styles.avatarSection}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.providerBadge}>
            <Text style={styles.providerText}>
              {provider === 'google' ? '🔵 Google' : '📧 Email'}
            </Text>
          </View>
          {/* Admin badge — chỉ hiển thị nếu isAdmin */}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>🛡️ Admin</Text>
            </View>
          )}
        </View>
      </View>

      {/* Thống kê nhanh */}
      <View style={styles.statsRow}>
        <StatBox label="Tham gia" value={createdAt} />
        {age    && <StatBox label="Tuổi"      value={age} />}
        {gender && (
          <StatBox
            label="Giới tính"
            value={gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : 'Khác'}
          />
        )}
      </View>

      {/* Travel style */}
      {travelStyle && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phong cách du lịch</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{STYLE_LABELS[travelStyle] || travelStyle}</Text>
          </View>
        </View>
      )}

      {/* Sở thích */}
      {interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sở thích</Text>
          <View style={styles.chipRow}>
            {interests.map(i => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{INTEREST_LABELS[i] || i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Nút chỉnh sửa */}
      <TouchableOpacity
        style={styles.btnEdit}
        onPress={() => navigation.navigate('EditProfile')}
        activeOpacity={0.85}
      >
        <Text style={styles.btnEditText}>✏️ Chỉnh sửa hồ sơ</Text>
      </TouchableOpacity>

      {/* ── Nút Admin Dashboard — chỉ hiện nếu isAdmin ── */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.btnAdmin}
          onPress={() => navigation.navigate('AdminDashboard')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnAdminText}>🛡️ Admin Dashboard</Text>
        </TouchableOpacity>
      )}

      {/* Đăng xuất */}
      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.btnLogoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function StatBox({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 24, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: TEAL,
  },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 40, color: '#fff', fontWeight: '800' },
  name:  { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12 },
  email: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  providerBadge: {
    backgroundColor: '#F0FDF9', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  providerText: { fontSize: 12, color: TEAL2, fontWeight: '600' },

  adminBadge: {
    backgroundColor: '#1E1B4B', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4338CA',
  },
  adminBadgeText: { fontSize: 12, color: '#A5B4FC', fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', minWidth: 90,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: '#D1FAE5',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: TEAL },

  btnEdit: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
    shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnEditText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Admin button ──────────────────────────────────────────
  btnAdmin: {
    backgroundColor: '#1E1B4B', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 12,
    borderWidth: 1.5, borderColor: '#4338CA',
    shadowColor: '#4338CA', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnAdminText: { color: '#A5B4FC', fontSize: 15, fontWeight: '700' },

  btnLogout: {
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
    backgroundColor: '#FFF5F5',
  },
  btnLogoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});