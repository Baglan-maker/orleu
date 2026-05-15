import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '../../store/authStore';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Input  } from '../../components/ui/Input';
import { validateEmail } from '../../services/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, error, clearError } = useAuthStore();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const emailValidation = validateEmail(email);
  const isEmailValid = emailValidation.valid;

  async function handleLogin() {
    if (!isEmailValid || !password.trim()) return;
    clearError();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // Auth guard will redirect automatically
    } catch {
      // Error already saved in store
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <View style={styles.brand}>
            <Text style={styles.sub}>ӨРЛЕУ</Text>
            <Text style={styles.title}>Orleu</Text>
            <Text style={styles.tagline}>Track the ascent.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>
            {email.length > 0 && !isEmailValid && (
              <Text style={styles.fieldError}>{emailValidation.error}</Text>
            )}

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              containerStyle={{ marginBottom: 20 }}
            />

            {/* Global error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              label="Continue"
              loading={loading}
              onPress={handleLogin}
              disabled={!isEmailValid || !password.trim()}
            />

            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.switchText}>
                No account?{' '}
                <Text style={styles.switchLink}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.s1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 64,
    paddingBottom: 40,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 48,
  },
  sub: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 3,
    color: Colors.t3,
    marginBottom: 8,
  },
  title: {
    fontSize: 58,
    fontFamily: Fonts.displayBlack,
    color: Colors.t1,
    letterSpacing: -2,
    lineHeight: 60,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    letterSpacing: 0.3,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  statusIcon: {
    position: 'absolute',
    right: 12,
    top: 38,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValid: {
    backgroundColor: 'rgba(107,158,107,0.15)',
  },
  statusInvalid: {
    backgroundColor: 'rgba(200,52,58,0.15)',
  },
  statusX: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.cr,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.cr,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  errorBox: {
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: Colors.cr,
    fontSize: 13,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  switchRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t3,
  },
  switchLink: {
    color: Colors.cr,
    fontFamily: Fonts.semiBold,
  },
});