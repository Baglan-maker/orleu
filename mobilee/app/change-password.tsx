// mobile/app/change-password.tsx
import { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Path, Line } from 'react-native-svg';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { authApi } from '../services/api';

function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function IEye({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <Line x1="1" y1="1" x2="23" y2="23" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </Svg>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  returnKeyType?: 'done' | 'next';
  onSubmitEditing?: () => void;
}

function PasswordField({ label, value, onChange, placeholder, returnKeyType = 'done', onSubmitEditing }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.fieldBlock}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? '••••••'}
          placeholderTextColor={Colors.t3}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        <TouchableOpacity
          onPress={() => setVisible(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IEye hidden={!visible} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [oldPw,    setOldPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving,   setSaving]   = useState(false);

  const canSave = oldPw.length > 0 && newPw.length >= 6 && confirmPw.length >= 6;

  async function handleSave() {
    if (newPw !== confirmPw) {
      Alert.alert('Passwords do not match', 'New password and confirmation must be identical.');
      return;
    }
    if (newPw.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword({ old_password: oldPw, new_password: newPw });
      Alert.alert('Password changed', 'Your password has been updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert(
        'Failed',
        typeof detail === 'string' ? detail : 'Could not change password. Check your current password.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IBack />
        </TouchableOpacity>
        <Text style={s.pageTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card}>
          <PasswordField
            label="Current password"
            value={oldPw}
            onChange={setOldPw}
            returnKeyType="next"
          />
          <View style={s.divider} />
          <PasswordField
            label="New password"
            value={newPw}
            onChange={setNewPw}
            placeholder="Min. 6 characters"
            returnKeyType="next"
          />
          <View style={s.divider} />
          <PasswordField
            label="Confirm new password"
            value={confirmPw}
            onChange={setConfirmPw}
            returnKeyType="done"
            onSubmitEditing={canSave ? handleSave : undefined}
          />
        </View>

        <Text style={s.hint}>
          Use a strong password with at least 6 characters. You will stay signed in after changing it.
        </Text>

        <TouchableOpacity
          style={[s.saveButton, (!canSave || saving) && s.saveButtonDim]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveButtonText}>Update Password</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.t1 },

  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  divider: { height: 1, backgroundColor: Colors.line },

  fieldBlock:  { paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel:  { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.t3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input:       { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Colors.t1, paddingVertical: 4 },

  hint: {
    fontSize: 12, fontFamily: Fonts.regular,
    color: Colors.t3, lineHeight: 18,
    marginBottom: Spacing.xl,
  },

  saveButton: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDim:  { opacity: 0.65 },
  saveButtonText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },
});
