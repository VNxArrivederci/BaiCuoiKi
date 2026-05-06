// screens/EditProfileScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';
const ERROR = '#EF4444';

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

const TRAVEL_STYLES = [
  { key: 'solo',   label: '🧳 Solo' },
  { key: 'couple', label: '💑 Couple' },
  { key: 'family', label: '👨‍👩‍👧 Gia đình' },
  { key: 'group',  label: '👫 Nhóm' },
];

const GENDERS = [
  { key: 'male',   label: '👨 Nam' },
  { key: 'female', label: '👩 Nữ' },
  { key: 'other',  label: '🧑 Khác' },
];

async function uploadAvatar(uri, uid) {
  const response = await fetch(uri);
  const blob     = await response.blob();
  const imgRef   = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytes(imgRef, blob);
  return await getDownloadURL(imgRef);
}

export default function EditProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const profile = user?.profile || {};

  const [displayName,  setDisplayName]  = useState(user?.displayName  || profile.displayName || '');
  const [age,          setAge]          = useState(profile.age         ? String(profile.age) : '');
  const [gender,       setGender]       = useState(profile.gender      || '');
  const [travelStyle,  setTravelStyle]  = useState(profile.travelStyle || '');
  const [interests,    setInterests]    = useState(profile.interests   || []);
  const [avatarUri,    setAvatarUri]    = useState(null); // local URI mới chọn
  const [currentPhoto, setCurrentPhoto]= useState(profile.photoURL || user?.photoURL || null);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState({});

  const toggleInterest = (key) =>
    setInterests(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // ── Chọn ảnh ────────────────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Cần quyền truy cập thư viện ảnh'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  // ── Validate ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!displayName.trim() || displayName.trim().length < 2)
      errs.displayName = 'Tên phải có ít nhất 2 ký tự';
    if (displayName.trim().length > 50)
      errs.displayName = 'Tên tối đa 50 ký tự';
    if (age && (isNaN(Number(age)) || Number(age) < 10 || Number(age) > 100))
      errs.age = 'Tuổi không hợp lệ (10–100)';
    return errs;
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      let photoURL = currentPhoto;

      // Upload ảnh mới nếu có
      if (avatarUri) {
        photoURL = await uploadAvatar(avatarUri, user.uid);
      }

      // Cập nhật Firebase Auth displayName + photoURL
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
          photoURL:    photoURL || '',
        });
      }

      // Cập nhật Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName:  displayName.trim(),
        photoURL:     photoURL || null,
        age:          age ? Number(age) : null,
        gender:       gender || null,
        travelStyle:  travelStyle || null,
        interests,
        updatedAt:    serverTimestamp(),
      });

      // Refresh user context
      await refreshUser();

      Alert.alert('✅ Đã lưu!', 'Hồ sơ của bạn đã được cập nhật.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setLoading(false);
    }
  };

  const avatarSource = avatarUri
    ? { uri: avatarUri }
    : currentPhoto
      ? { uri: currentPhoto }
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0FDF9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {displayName.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Nhấn để đổi ảnh đại diện</Text>
        </View>

        {/* Họ tên */}
        <Text style={styles.label}>Họ và tên *</Text>
        <TextInput
          style={[styles.input, errors.displayName && styles.inputError]}
          value={displayName}
          onChangeText={(v) => { setDisplayName(v); setErrors(e => ({ ...e, displayName: null })); }}
          placeholder="Nguyễn Văn A"
          placeholderTextColor="#9CA3AF"
          maxLength={50}
        />
        {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}

        {/* Tuổi */}
        <Text style={styles.label}>Tuổi</Text>
        <TextInput
          style={[styles.input, errors.age && styles.inputError]}
          value={age}
          onChangeText={(v) => { setAge(v); setErrors(e => ({ ...e, age: null })); }}
          placeholder="VD: 25"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          maxLength={3}
        />
        {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}

        {/* Giới tính */}
        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.chipRow}>
          {GENDERS.map(g => (
            <TouchableOpacity
              key={g.key}
              style={[styles.chip, gender === g.key && styles.chipActive]}
              onPress={() => setGender(gender === g.key ? '' : g.key)}
            >
              <Text style={[styles.chipText, gender === g.key && styles.chipTextActive]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phong cách du lịch */}
        <Text style={styles.label}>Phong cách du lịch</Text>
        <View style={styles.chipRow}>
          {TRAVEL_STYLES.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.chip, travelStyle === s.key && styles.chipActive]}
              onPress={() => setTravelStyle(travelStyle === s.key ? '' : s.key)}
            >
              <Text style={[styles.chipText, travelStyle === s.key && styles.chipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sở thích */}
        <Text style={styles.label}>Sở thích</Text>
        <View style={styles.chipRow}>
          {INTERESTS.map(i => (
            <TouchableOpacity
              key={i.key}
              style={[styles.chip, interests.includes(i.key) && styles.chipActive]}
              onPress={() => toggleInterest(i.key)}
            >
              <Text style={[styles.chipText, interests.includes(i.key) && styles.chipTextActive]}>
                {i.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lưu */}
        <TouchableOpacity
          style={[styles.btnSave, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSaveText}>💾 Lưu thay đổi</Text>
          }
        </TouchableOpacity>

        {/* Huỷ */}
        <TouchableOpacity
          style={styles.btnCancel}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.btnCancelText}>Huỷ</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: TEAL,
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial:  { fontSize: 42, color: '#fff', fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#fff', borderRadius: 16, width: 32, height: 32,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D1FAE5',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  avatarEditIcon: { fontSize: 16 },
  avatarHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },

  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  inputError: { borderColor: ERROR },
  errorText:  { fontSize: 12, color: ERROR, marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  chipActive:     { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: TEAL },

  btnSave: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 28,
    shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  btnCancel: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 10,
    backgroundColor: '#F9FAFB',
  },
  btnCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
});