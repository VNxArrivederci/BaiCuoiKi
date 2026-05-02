// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import {
  updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// ── Data ────────────────────────────────────────
const TRAVEL_STYLES = [
  { key: 'solo',   label: 'Solo 🧳',      desc: 'Thích tự do khám phá một mình' },
  { key: 'couple', label: 'Couple 💑',    desc: 'Đi cùng người thân thiết' },
  { key: 'family', label: 'Gia đình 👨‍👩‍👧', desc: 'Du lịch cùng gia đình' },
  { key: 'group',  label: 'Nhóm 👫',      desc: 'Đi cùng bạn bè, nhóm đông' },
];

const INTERESTS = [
  { key: 'food',      label: '🍜 Ẩm thực' },
  { key: 'culture',   label: '🏛️ Văn hóa' },
  { key: 'shopping',  label: '🛍️ Mua sắm' },
  { key: 'nature',    label: '🌿 Thiên nhiên' },
  { key: 'adventure', label: '🧗 Phiêu lưu' },
  { key: 'nightlife', label: '🌃 Về đêm' },
  { key: 'wellness',  label: '🧘 Sức khỏe' },
  { key: 'history',   label: '📜 Lịch sử' },
];

// ── Component ────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const profile = user?.profile;

  const [displayName, setDisplayName] = useState('');
  const [age, setAge]                 = useState('');
  const [gender, setGender]           = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [interests, setInterests]     = useState([]);

  const [tab, setTab]                 = useState('info');
  const [saving, setSaving]           = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [savingPass, setSavingPass]   = useState(false);

  const isGoogle = user?.providerData?.[0]?.providerId === 'google.com';

  // Load data từ user/profile mỗi khi user thay đổi
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAge(profile?.age ? String(profile.age) : '');
      setGender(profile?.gender || '');
      setTravelStyle(profile?.travelStyle || '');
      setInterests(profile?.interests || []);
    }
  }, [user, profile]);

  const toggleInterest = (key) =>
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  // ── Lưu thông tin cá nhân ──────────────────────
  const handleSaveInfo = async () => {
    if (!displayName.trim()) {
      Alert.alert('Lỗi', 'Tên không được để trống');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        age: age ? parseInt(age) : null,
        gender: gender || null,
      });
      await refreshUser(); // ← cập nhật state ngay lập tức
      Alert.alert('✅ Đã lưu', 'Thông tin cá nhân đã được cập nhật!');
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Lưu sở thích ──────────────────────────────
  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        travelStyle: travelStyle || null,
        interests,
      });
      await refreshUser(); // ← cập nhật state ngay lập tức
      Alert.alert('✅ Đã lưu', 'Sở thích của bạn đã được cập nhật!');
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Đổi mật khẩu ──────────────────────────────
  const handleChangePassword = async () => {
    if (newPass.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    setSavingPass(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPass);
      Alert.alert('✅ Thành công', 'Mật khẩu đã được thay đổi!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setShowPassForm(false);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        Alert.alert('Lỗi', 'Mật khẩu hiện tại không đúng');
      } else {
        Alert.alert('Lỗi', err.message);
      }
    } finally {
      setSavingPass(false);
    }
  };

  // ── Đăng xuất ─────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Render ────────────────────────────────────
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrap}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {(displayName || user?.email || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          {isGoogle && (
            <View style={styles.googleBadge}>
              <Text style={styles.googleBadgeText}>G</Text>
            </View>
          )}
        </View>
        <Text style={styles.avatarName}>{user?.displayName || 'Người dùng'}</Text>
        <Text style={styles.avatarEmail}>{user?.email}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'info' && styles.tabBtnActive]}
          onPress={() => setTab('info')}
        >
          <Text style={[styles.tabText, tab === 'info' && styles.tabTextActive]}>
            👤 Thông tin
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'prefs' && styles.tabBtnActive]}
          onPress={() => setTab('prefs')}
        >
          <Text style={[styles.tabText, tab === 'prefs' && styles.tabTextActive]}>
            ❤️ Sở thích
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB: Thông tin ── */}
      {tab === 'info' && (
        <View style={styles.card}>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Họ và tên</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Nhập tên của bạn"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Tuổi <Text style={styles.optional}>(không bắt buộc)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
              placeholder="VD: 22"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Giới tính <Text style={styles.optional}>(không bắt buộc)</Text>
            </Text>
            <View style={styles.genderRow}>
              {['Nam', 'Nữ', 'Khác'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                  onPress={() => setGender(gender === g ? '' : g)}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.btnSave}
            onPress={handleSaveInfo}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnSaveText}>💾 Lưu thông tin</Text>
            }
          </TouchableOpacity>

          {/* Đổi mật khẩu — chỉ với email user */}
          {!isGoogle && (
            <View style={styles.passwordSection}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => setShowPassForm((v) => !v)}
              >
                <Text style={styles.btnOutlineText}>
                  {showPassForm ? '✕ Đóng' : '🔑 Đổi mật khẩu'}
                </Text>
              </TouchableOpacity>

              {showPassForm && (
                <View style={styles.passForm}>
                  <TextInput
                    style={styles.input}
                    value={currentPass}
                    onChangeText={setCurrentPass}
                    placeholder="Mật khẩu hiện tại"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    value={newPass}
                    onChangeText={setNewPass}
                    placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  /> 
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder="Xác nhận mật khẩu mới"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  />
                  <TouchableOpacity
                    style={[styles.btnSave, { marginTop: 12 }]}
                    onPress={handleChangePassword}
                    disabled={savingPass}
                  >
                    {savingPass
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnSaveText}>Xác nhận đổi mật khẩu</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
            <Text style={styles.btnLogoutText}>🚪 Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TAB: Sở thích ── */}
      {tab === 'prefs' && (
        <View style={styles.card}>

          <Text style={styles.sectionTitle}>Phong cách du lịch</Text>
          <Text style={styles.sectionSub}>Bạn thường du lịch theo hình thức nào?</Text>
          <View style={styles.travelStyleGrid}>
            {TRAVEL_STYLES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.styleCard, travelStyle === s.key && styles.styleCardActive]}
                onPress={() => setTravelStyle(travelStyle === s.key ? '' : s.key)}
              >
                <Text style={[styles.styleLabel, travelStyle === s.key && styles.styleLabelActive]}>
                  {s.label}
                </Text>
                <Text style={[styles.styleDesc, travelStyle === s.key && styles.styleDescActive]}>
                  {s.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Sở thích</Text>
          <Text style={styles.sectionSub}>Chọn những gì bạn yêu thích (có thể chọn nhiều)</Text>
          <View style={styles.interestGrid}>
            {INTERESTS.map((i) => (
              <TouchableOpacity
                key={i.key}
                style={[styles.interestChip, interests.includes(i.key) && styles.interestChipActive]}
                onPress={() => toggleInterest(i.key)}
              >
                <Text style={[styles.interestText, interests.includes(i.key) && styles.interestTextActive]}>
                  {i.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnSave, { marginTop: 24 }]}
            onPress={handleSavePrefs}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnSaveText}>💾 Lưu sở thích</Text>
            }
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

// ────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────
const TEAL = '#0D9488';

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#F0FDF9' },
  content:  { paddingHorizontal: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap:    { position: 'relative' },
  avatarImg:     { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: TEAL },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial:   { fontSize: 36, fontWeight: '800', color: '#fff' },
  googleBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  googleBadgeText: { fontSize: 13, fontWeight: '800', color: '#4285F4' },
  avatarName:      { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 10 },
  avatarEmail:     { fontSize: 13, color: '#6B7280', marginTop: 2 },

  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 14, padding: 4, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  tabBtn:        { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabBtnActive:  { backgroundColor: TEAL },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },

  fieldGroup: { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  optional:   { fontWeight: '400', color: '#9CA3AF' },
  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },

  genderRow:       { flexDirection: 'row', gap: 10 },
  genderBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  genderBtnActive:  { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  genderText:       { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  genderTextActive: { color: TEAL },

  btnSave: {
    backgroundColor: TEAL, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  btnOutline: {
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  btnOutlineText: { color: TEAL, fontSize: 14, fontWeight: '700' },

  btnLogout: {
    borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  btnLogoutText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },

  passwordSection: { marginTop: 4 },
  passForm:        { marginTop: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub:   { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },

  travelStyleGrid: { gap: 10 },
  styleCard: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, backgroundColor: '#F9FAFB',
  },
  styleCardActive:  { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  styleLabel:       { fontSize: 15, fontWeight: '700', color: '#374151' },
  styleLabelActive: { color: TEAL },
  styleDesc:        { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  styleDescActive:  { color: TEAL },

  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  interestChipActive:  { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  interestText:        { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  interestTextActive:  { color: TEAL },
});