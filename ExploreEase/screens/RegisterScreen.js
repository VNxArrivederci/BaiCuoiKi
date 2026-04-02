// screens/RegisterScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

// ────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────
const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validatePassword = (v) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(v);

const PASSWORD_RULES = [
  { label: 'Ít nhất 8 ký tự',         test: (v) => v.length >= 8 },
  { label: 'Có chữ hoa',               test: (v) => /[A-Z]/.test(v) },
  { label: 'Có chữ thường',            test: (v) => /[a-z]/.test(v) },
  { label: 'Có số',                    test: (v) => /\d/.test(v) },
  { label: 'Có ký tự đặc biệt @$!%*?&', test: (v) => /[@$!%*?&]/.test(v) },
];

export default function RegisterScreen({ navigation }) {
  const { registerWithEmail } = useAuth();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [touched, setTouched]   = useState({ name: false, email: false, password: false, confirm: false });

  const blur = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const nameError    = touched.name    && name.trim().length < 2   ? 'Tên phải có ít nhất 2 ký tự' : null;
  const emailError   = touched.email   && !validateEmail(email)    ? 'Email không hợp lệ' : null;
  const passwordError= touched.password && !validatePassword(password) ? 'Mật khẩu chưa đủ mạnh' : null;
  const confirmError = touched.confirm  && password !== confirm    ? 'Mật khẩu xác nhận không khớp' : null;

  const canSubmit =
    name.trim().length >= 2 &&
    validateEmail(email) &&
    validatePassword(password) &&
    password === confirm;

  const handleRegister = useCallback(async () => {
    if (!canSubmit) return;
    // Đánh dấu tất cả field là touched để hiện lỗi
    setTouched({ name: true, email: true, password: true, confirm: true });
    setLoading(true);
    const result = await registerWithEmail(email.trim(), password, name.trim());
    setLoading(false);

    if (result.success) {
      Alert.alert(
        '🎉 Đăng ký thành công!',
        result.message,
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
      );
    } else {
      Alert.alert('Đăng ký thất bại', result.message);
    }
  }, [canSubmit, email, password, name, registerWithEmail, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerArea}>
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Tham gia ExploreEase và khám phá thế giới!</Text>
        </View>

        <View style={styles.card}>

          {/* Họ tên */}
          <Field
            label="Họ và tên"
            placeholder="Nguyễn Văn A"
            value={name}
            onChangeText={setName}
            onBlur={() => blur('name')}
            error={nameError}
          />

          {/* Email */}
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            onBlur={() => blur('email')}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Mật khẩu */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.inputFlex, passwordError && styles.inputError]}
                placeholder="Mật khẩu mạnh"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                onBlur={() => blur('password')}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {/* Password strength checklist */}
            {password.length > 0 && (
              <View style={styles.ruleList}>
                {PASSWORD_RULES.map((rule) => (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Text style={rule.test(password) ? styles.ruleOk : styles.ruleFail}>
                      {rule.test(password) ? '✓' : '✗'}
                    </Text>
                    <Text style={[styles.ruleLabel, rule.test(password) && styles.ruleLabelOk]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Xác nhận mật khẩu */}
          <Field
            label="Xác nhận mật khẩu"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChangeText={setConfirm}
            onBlur={() => blur('confirm')}
            error={confirmError}
            secureTextEntry={!showPass}
          />

          {/* Nút đăng ký */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Đăng ký</Text>
            }
          </TouchableOpacity>

          <Text style={styles.note}>
            Sau khi đăng ký, bạn sẽ nhận được email xác thực. Hãy kiểm tra hộp thư!
          </Text>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Reusable Field ──────────────────────────────
const Field = ({ label, error, ...props }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error && styles.inputError]}
      placeholderTextColor="#9CA3AF"
      {...props}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

// ────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────
const TEAL  = '#0D9488';
const TEAL2 = '#0F766E';
const ERROR = '#EF4444';
const GREEN = '#10B981';

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  backBtn:   { marginTop: 52, marginBottom: 8 },
  backIcon:  { fontSize: 22, color: TEAL2 },

  headerArea: { marginBottom: 24 },
  title:      { fontSize: 28, fontWeight: '800', color: TEAL2 },
  subtitle:   { fontSize: 14, color: '#6B7280', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },

  fieldGroup: { marginBottom: 16 },
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

  ruleList:     { marginTop: 8, paddingLeft: 4 },
  ruleRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  ruleOk:       { color: GREEN, fontWeight: '700', fontSize: 13, width: 18 },
  ruleFail:     { color: '#D1D5DB', fontWeight: '700', fontSize: 13, width: 18 },
  ruleLabel:    { fontSize: 12, color: '#9CA3AF', marginLeft: 4 },
  ruleLabelOk:  { color: '#374151' },

  btnPrimary: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
    shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnDisabled:    { backgroundColor: '#A7F3D0' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  note: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 14, lineHeight: 18 },

  loginRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginHint: { color: '#6B7280', fontSize: 14 },
  loginLink: { color: TEAL, fontWeight: '700', fontSize: 14 },
});