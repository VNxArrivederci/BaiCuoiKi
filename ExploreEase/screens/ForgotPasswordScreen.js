// screens/ForgotPasswordScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ForgotPasswordScreen({ navigation }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleReset = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email.');
      return;
    }
    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      Alert.alert('Lỗi', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.iconArea}>
          <Text style={styles.icon}>{sent ? '📬' : '🔑'}</Text>
        </View>

        {sent ? (
          <>
            <Text style={styles.title}>Email đã được gửi!</Text>
            <Text style={styles.desc}>
              Kiểm tra hộp thư của <Text style={styles.bold}>{email}</Text> và làm theo hướng dẫn để đặt lại mật khẩu.
            </Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Quên mật khẩu?</Text>
            <Text style={styles.desc}>
              Nhập email của bạn. Chúng tôi sẽ gửi link đặt lại mật khẩu.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email của bạn"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.btnPrimary, !validateEmail(email) && styles.btnDisabled]}
              onPress={handleReset}
              disabled={!validateEmail(email) || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Gửi email khôi phục</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const TEAL = '#0D9488';
const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 56 },
  backBtn:   { marginBottom: 16 },
  backIcon:  { fontSize: 22, color: '#0F766E' },
  iconArea:  { alignItems: 'center', marginVertical: 24 },
  icon:      { fontSize: 56 },
  title:     { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
  desc:      { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  bold:      { fontWeight: '700', color: '#374151' },
  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
    marginBottom: 18,
  },
  btnPrimary: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnDisabled: { backgroundColor: '#A7F3D0' },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});