// screens/AddScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { collection, addDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig'; // đảm bảo export storage từ firebaseConfig
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
const TRAVEL_STYLE_LABELS = {
  solo: 'Solo 🧳', couple: 'Couple 💑',
  family: 'Gia đình 👨‍👩‍👧', group: 'Nhóm 👫',
};

// ── Geocode ──────────────────────────────────────────────────────
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── Upload ảnh lên Firebase Storage ─────────────────────────────
async function uploadImage(uri) {
  const response = await fetch(uri);
  const blob     = await response.blob();
  const imgRef   = ref(storage, `uploads/${Date.now()}.jpg`);
  await uploadBytes(imgRef, blob);
  return await getDownloadURL(imgRef);
}

// ── Validation rules ─────────────────────────────────────────────
const validate = (fields) => {
  const errs = {};
  if (!fields.title.trim() || fields.title.trim().length < 3)
    errs.title = 'Tiêu đề phải có ít nhất 3 ký tự';
  if (fields.title.trim().length > 100)
    errs.title = 'Tiêu đề tối đa 100 ký tự';
  if (!fields.address.trim() || fields.address.trim().length < 5)
    errs.address = 'Địa chỉ phải có ít nhất 5 ký tự';
  if (fields.description.trim().length > 500)
    errs.description = 'Mô tả tối đa 500 ký tự';
  if (!fields.category)
    errs.category = 'Vui lòng chọn danh mục';
  if (fields.type === 'event' && fields.endDate <= fields.startDate)
    errs.date = 'Ngày kết thúc phải sau ngày bắt đầu';
  return errs;
};

export default function AddScreen({ navigation }) {
  const { user } = useAuth();

  const [type, setType]         = useState('place');
  const [title, setTitle]       = useState('');
  const [address, setAddress]   = useState('');
  const [description, setDesc]  = useState('');
  const [category, setCategory] = useState('');
  const [targetStyle, setTargetStyle] = useState([]);
  const [image, setImage]       = useState(null); // local URI
  const [coords, setCoords]     = useState(null); // { lat, lng }
  const [geocoding, setGeocoding] = useState(false);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate]     = useState(new Date(Date.now() + 3600000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [price, setPrice]  = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const toggleStyle = (s) =>
    setTargetStyle(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ── Chọn ảnh ────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền truy cập thư viện ảnh'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // ── Geocode khi blur address ─────────────────────────────────
  const handleAddressBlur = async () => {
    if (!address.trim() || address.trim().length < 5) return;
    setGeocoding(true);
    const c = await geocodeAddress(address);
    setCoords(c);
    setGeocoding(false);
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate({ title, address, description, category, type, startDate, endDate });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      // Geocode nếu chưa có
      let c = coords;
      if (!c) c = await geocodeAddress(address);

      // Upload ảnh nếu có
      let imageURL = null;
      if (image) imageURL = await uploadImage(image);

      const base = {
        title:       title.trim(),
        address:     address.trim(),
        description: description.trim(),
        category,
        targetStyle,
        imageURL,
        authorId:    user.uid,
        authorName:  user.displayName || user.email,
        rating:      0,
        ratingCount: 0,
        createdAt:   serverTimestamp(),
        location:    c ? new GeoPoint(c.lat, c.lng) : null,
        lat:         c?.lat || null,
        lng:         c?.lng || null,
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
    d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const charCount = description.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0FDF9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Type selector */}
        <Text style={styles.sectionTitle}>Loại đăng</Text>
        <View style={styles.typeRow}>
          {[{ key:'place', label:'📍 Địa điểm' }, { key:'event', label:'🎉 Sự kiện' }].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
              onPress={() => { setType(t.key); setErrors({}); }}
            >
              <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ảnh */}
        <Text style={styles.label}>Ảnh đại diện</Text>
        {image ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
              <Text style={styles.removeImageTxt}>✕ Xoá</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
            <Text style={styles.imagePickerIcon}>📷</Text>
            <Text style={styles.imagePickerText}>Chọn ảnh từ thư viện</Text>
          </TouchableOpacity>
        )}

        {/* Title */}
        <Text style={styles.label}>Tiêu đề *</Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          value={title}
          onChangeText={(v) => { setTitle(v); setErrors(e => ({ ...e, title: null })); }}
          placeholder={type === 'event' ? 'Tên sự kiện' : 'Tên địa điểm'}
          placeholderTextColor="#9CA3AF"
          maxLength={100}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

        {/* Address */}
        <Text style={styles.label}>Địa chỉ *</Text>
        <TextInput
          style={[styles.input, errors.address && styles.inputError]}
          value={address}
          onChangeText={(v) => { setAddress(v); setCoords(null); setErrors(e => ({ ...e, address: null })); }}
          onBlur={handleAddressBlur}
          placeholder="VD: 1 Nguyễn Huệ, Quận 1, TP.HCM"
          placeholderTextColor="#9CA3AF"
        />
        {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

        {/* Map Preview */}
        {geocoding && (
          <View style={styles.geocodingRow}>
            <ActivityIndicator size="small" color={TEAL} />
            <Text style={styles.geocodingText}>Đang tìm tọa độ...</Text>
          </View>
        )}
        {coords && !geocoding && (
          <View style={styles.mapPreviewWrapper} pointerEvents="box-none">
            <Text style={styles.mapPreviewLabel}>✅ Đã xác định vị trí</Text>
            <View style={styles.mapPreviewContainer}>
              <MapView
                style={styles.mapPreview}
                initialRegion={{
                  latitude:      coords.lat,
                  longitude:     coords.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} />
              </MapView>
            </View>
          </View>
        )}
        {!coords && !geocoding && address.trim().length >= 5 && (
          <Text style={styles.noCoords}>⚠️ Không tìm được tọa độ — vẫn có thể đăng</Text>
        )}

        {/* Description */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>Mô tả</Text>
          <Text style={[styles.charCount, charCount > 500 && { color: ERROR }]}>{charCount}/500</Text>
        </View>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }, errors.description && styles.inputError]}
          value={description}
          onChangeText={(v) => { setDesc(v); setErrors(e => ({ ...e, description: null })); }}
          placeholder="Mô tả ngắn..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

        {/* Category */}
        <Text style={styles.label}>Danh mục *</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, category === c.key && styles.chipActive]}
              onPress={() => { setCategory(category === c.key ? '' : c.key); setErrors(e => ({ ...e, category: null })); }}
            >
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

        {/* Travel style */}
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
                onChange={(_, d) => { setShowStartPicker(false); if (d) setStartDate(d); setErrors(e => ({ ...e, date: null })); }}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.label}>Thời gian kết thúc *</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowEndPicker(true)}>
              <Text style={[styles.dateText, errors.date && { color: ERROR }]}>
                🗓 {formatDate(endDate)}
              </Text>
            </TouchableOpacity>
            {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d); setErrors(e => ({ ...e, date: null })); }}
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
            />
          </>
        )}

        {/* Submit */}
        <TouchableOpacity style={[styles.btnSubmit, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
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
  typeBtnActive:     { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  typeBtnText:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive: { color: TEAL },

  label:    { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  charCount:{ fontSize: 12, color: '#9CA3AF' },

  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  inputError: { borderColor: ERROR },
  errorText:  { fontSize: 12, color: ERROR, marginTop: 4 },

  // ── Image picker ──
  imagePickerBtn: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    borderStyle: 'dashed', height: 110,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9FAFB', gap: 6,
  },
  imagePickerIcon: { fontSize: 28 },
  imagePickerText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  imageContainer: { position: 'relative' },
  imagePreview: { width: '100%', height: 160, borderRadius: 12 },
  removeImageBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#00000088', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  removeImageTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // ── Map preview ──
  geocodingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  geocodingText:{ fontSize: 12, color: TEAL, fontWeight: '600' },
  mapPreviewWrapper: { marginTop: 8 },
  mapPreviewLabel: { fontSize: 12, color: TEAL2, fontWeight: '600', marginBottom: 6 },
  mapPreviewContainer: { borderRadius: 12, overflow: 'hidden', height: 160 },
  mapPreview: { flex: 1 },
  noCoords: { fontSize: 12, color: '#F59E0B', marginTop: 4 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  chipActive:     { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: TEAL },

  datePicker: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fff',
  },
  dateText: { fontSize: 15, color: '#111827' },

  btnSubmit: {
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  btnSubmitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});