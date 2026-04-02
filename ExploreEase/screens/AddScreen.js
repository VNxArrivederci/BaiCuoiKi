// screens/AddScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';
const ERROR = '#EF4444';

const CATEGORIES = [
  { key: 'food',      label: '🍜 Ẩm thực' },
  { key: 'culture',   label: '🏛️ Văn hóa' },
  { key: 'shopping',  label: '🛍️ Mua sắm' },
  { key: 'nature',    label: '🌿 Thiên nhiên' },
  { key: 'adventure', label: '🧗 Phiêu lưu' },
  { key: 'nightlife', label: '🌃 Về đêm' },
  { key: 'wellness',  label: '🧘 Sức khỏe' },
  { key: 'history',   label: '📜 Lịch sử' },
];

const TRAVEL_STYLES = ['solo', 'couple', 'family', 'group'];
const TRAVEL_STYLE_LABELS = { solo: 'Solo 🧳', couple: 'Couple 💑', family: 'Gia đình 👨‍👩‍👧', group: 'Nhóm 👫' };

// ── Geocode địa chỉ → tọa độ (dùng Nominatim miễn phí) ─────────────────
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

export default function AddScreen({ navigation }) {
  const { user } = useAuth();

  const [type, setType]         = useState('place'); // 'place' | 'event'
  const [title, setTitle]       = useState('');
  const [address, setAddress]   = useState('');
  const [description, setDesc]  = useState('');
  const [category, setCategory] = useState('');
  const [targetStyle, setTargetStyle] = useState([]);

  // Event only
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate]     = useState(new Date(Date.now() + 3600000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [price, setPrice]  = useState('');

  const [loading, setLoading] = useState(false);

  const toggleStyle = (s) =>
    setTargetStyle((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const validate = () => {
    if (!title.trim())   { Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề'); return false; }
    if (!address.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ'); return false; }
    if (!category)       { Alert.alert('Lỗi', 'Vui lòng chọn danh mục'); return false; }
    if (type === 'event' && endDate <= startDate) {
      Alert.alert('Lỗi', 'Ngày kết thúc phải sau ngày bắt đầu');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      // Geocode
      const coords = await geocodeAddress(address);

      const base = {
        title:       title.trim(),
        address:     address.trim(),
        description: description.trim(),
        category,
        targetStyle,
        authorId:    user.uid,
        authorName:  user.displayName || user.email,
        rating:      0,
        ratingCount: 0,
        createdAt:   serverTimestamp(),
        location:    coords ? new GeoPoint(coords.lat, coords.lng) : null,
        lat:         coords?.lat || null,
        lng:         coords?.lng || null,
        type,
      };

      if (type === 'event') {
        Object.assign(base, {
          startDate: startDate.toISOString(),
          endDate:   endDate.toISOString(),
          price:     price.trim() || 'Miễn phí',
          status:    new Date() < startDate ? 'incoming' : 'ongoing',
        });
        await addDoc(collection(db, 'events'), base);
      } else {
        await addDoc(collection(db, 'places'), base);
      }

      Alert.alert(
        '✅ Đăng thành công!',
        type === 'event' ? 'Sự kiện đã được tạo.' : 'Địa điểm đã được thêm.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) =>
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F0FDF9' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Type selector */}
        <Text style={styles.sectionTitle}>Loại đăng</Text>
        <View style={styles.typeRow}>
          {[
            { key: 'place', label: '📍 Địa điểm chú ý' },
            { key: 'event', label: '🎉 Sự kiện' },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
              onPress={() => setType(t.key)}
            >
              <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.label}>Tiêu đề *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={type === 'event' ? 'Tên sự kiện' : 'Tên địa điểm'}
          placeholderTextColor="#9CA3AF"
        />

        {/* Address */}
        <Text style={styles.label}>Địa chỉ *</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="VD: 1 Nguyễn Huệ, Quận 1, TP.HCM"
          placeholderTextColor="#9CA3AF"
        />

        {/* Description */}
        <Text style={styles.label}>Mô tả</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDesc}
          placeholder="Mô tả ngắn về địa điểm / sự kiện..."
          placeholderTextColor="#9CA3AF"
          multiline
        />

        {/* Category */}
        <Text style={styles.label}>Danh mục *</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, category === c.key && styles.chipActive]}
              onPress={() => setCategory(category === c.key ? '' : c.key)}
            >
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Target travel style */}
        <Text style={styles.label}>Phù hợp với</Text>
        <View style={styles.chipGrid}>
          {TRAVEL_STYLES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, targetStyle.includes(s) && styles.chipActive]}
              onPress={() => toggleStyle(s)}
            >
              <Text style={[styles.chipText, targetStyle.includes(s) && styles.chipTextActive]}>
                {TRAVEL_STYLE_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Event-only fields */}
        {type === 'event' && (
          <>
            <Text style={styles.label}>Thời gian bắt đầu *</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateText}>🗓 {formatDate(startDate)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.label}>Thời gian kết thúc *</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowEndPicker(true)}>
              <Text style={[styles.dateText, endDate <= startDate && { color: ERROR }]}>
                🗓 {formatDate(endDate)}
              </Text>
            </TouchableOpacity>
            {endDate <= startDate && (
              <Text style={styles.errorText}>Ngày kết thúc phải sau ngày bắt đầu</Text>
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                minimumDate={startDate}
              />
            )}

            <Text style={styles.label}>Giá vé</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="VD: 50.000đ hoặc bỏ trống nếu miễn phí"
              placeholderTextColor="#9CA3AF"
              keyboardType="default"
            />
          </>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.btnSubmit} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSubmitText}>
                {type === 'event' ? '🎉 Đăng sự kiện' : '📍 Đăng địa điểm'}
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  typeRow:      { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  typeBtnActive:    { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  typeBtnText:      { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive:{ color: TEAL },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  chipActive:    { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  chipText:      { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextActive:{ color: TEAL },

  datePicker: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fff',
  },
  dateText:  { fontSize: 15, color: '#111827' },
  errorText: { fontSize: 12, color: ERROR, marginTop: 4 },

  btnSubmit: {
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  btnSubmitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});