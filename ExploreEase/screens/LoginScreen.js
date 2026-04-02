// screens/LoginScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function LoginScreen({ navigation }) {
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [loadingEmail, setLoadingEmail]   = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const emailValid = email.length === 0 || validateEmail(email);
  const canSubmit  = validateEmail(email) && password.length >= 6;

  // ────────────────────────────────────────────────
  // Đăng nhập Email/Password
  // ────────────────────────────────────────────────
  const handleEmailLogin = useCallback(async () => {
    if (!canSubmit) return;
    setLoadingEmail(true);
    const result = await loginWithEmail(email.trim(), password);
    setLoadingEmail(false);

    if (result.success) {
      navigation.replace('Home');
    } else {
      Alert.alert('Đăng nhập thất bại', result.message);
    }
  }, [email, password, canSubmit, loginWithEmail, navigation]);

  // ────────────────────────────────────────────────
  // Đăng nhập Google (Expo Web → dùng popup)
  // ────────────────────────────────────────────────
  const handleGoogleLogin = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      const authResult = await loginWithGoogle(credential.idToken);

      if (authResult.success) {
        if (authResult.isNewUser) {
          navigation.replace('Preferences');
        } else {
          navigation.replace('Home');
        }
      } else {
        Alert.alert('Đăng nhập Google thất bại', authResult.message);
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        Alert.alert('Lỗi', err.message);
      }
    } finally {
      setLoadingGoogle(false);
    }
  }, [loginWithGoogle, navigation]);

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🌍</Text>
          </View>
          <Text style={styles.appName}>ExploreEase</Text>
          <Text style={styles.tagline}>Khám phá thế giới theo cách của bạn</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, !emailValid && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!emailValid && (
              <Text style={styles.errorText}>Email không hợp lệ</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Tối thiểu 6 ký tự"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quên mật khẩu */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          {/* Nút đăng nhập */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleEmailLogin}
            disabled={!canSubmit || loadingEmail}
            activeOpacity={0.85}
          >
            {loadingEmail
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Đăng nhập</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={styles.btnGoogle}
            onPress={handleGoogleLogin}
            disabled={loadingGoogle}
            activeOpacity={0.85}
          >
            {loadingGoogle ? (
              <ActivityIndicator color="#4285F4" />
            ) : (
              <>
                <Text style={styles.googleLetter}>G</Text>
                <Text style={styles.btnGoogleText}>Tiếp tục với Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Chuyển sang đăng ký */}
        <View style={styles.registerRow}>
          <Text style={styles.registerHint}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Đăng ký</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────
const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';
const ERROR = '#EF4444';

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  // Logo
  logoArea: { alignItems: 'center', marginTop: 52, marginBottom: 28 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  logoEmoji: { fontSize: 38 },
  appName:   { fontSize: 28, fontWeight: '800', color: TEAL2, marginTop: 12, letterSpacing: 0.5 },
  tagline:   { fontSize: 13, color: '#6B7280', marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },

  // Fields
  fieldGroup: { marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  inputError:  { borderColor: ERROR },
  errorText:   { fontSize: 12, color: ERROR, marginTop: 4 },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: {
    flex: 1, borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  eyeBtn:  { position: 'absolute', right: 12 },
  eyeIcon: { fontSize: 18 },

  // Forgot
  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 18 },
  forgotText: { fontSize: 13, color: TEAL, fontWeight: '600' },

  // Primary button
  btnPrimary: {
    backgroundColor: TEAL, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnDisabled:    { backgroundColor: '#A7F3D0' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, color: '#9CA3AF', fontSize: 13 },

  // Google button
  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingVertical: 13, backgroundColor: '#fff',
  },
  googleLetter:  { fontSize: 18, fontWeight: '800', color: '#4285F4', marginRight: 10 },
  btnGoogleText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Register
  registerRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  registerHint: { color: '#6B7280', fontSize: 14 },
  registerLink: { color: TEAL, fontWeight: '700', fontSize: 14 },
});