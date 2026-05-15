import { useState } from 'react';
import {
  Alert, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Path, Line } from 'react-native-svg';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function IWarning() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
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

export default function DeleteAccountScreen() {
  const router  = useRouter();
  const { logout } = useAuthStore();

  const [password, setPassword] = useState('');
  const [visible,  setVisible]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!password) return;
    setDeleting(true);
    try {
      await authApi.deleteMe({ password });
      await logout();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert(
        'Delete failed',
        typeof detail === 'string' ? detail : 'Could not delete account. Check your password.',
      );
    } finally {
      setDeleting(false);
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
        <Text style={s.pageTitle}>Delete Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.content}>
        <View style={s.warningCard}>
          <IWarning />
          <Text style={s.warningTitle}>This cannot be undone</Text>
          <Text style={s.warningBody}>
            Deleting your account will permanently remove all your workouts, nutrition logs, progress, achievements, and missions. This action is irreversible.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLbl}>CONFIRM WITH YOUR PASSWORD</Text>
          <View style={s.inputCard}>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={Colors.t3}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={password.length > 0 ? handleDelete : undefined}
            />
            <TouchableOpacity
              onPress={() => setVisible(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IEye hidden={!visible} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[s.deleteButton, (!password || deleting) && s.deleteButtonDim]}
          onPress={handleDelete}
          disabled={!password || deleting}
          activeOpacity={0.8}
        >
          {deleting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.deleteButtonText}>Delete My Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.cancelLink}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.s1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

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

  warningCard: {
    backgroundColor: Colors.crLo,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.crBdr,
    padding: 20,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: 10,
  },
  warningTitle: {
    fontSize: 16, fontFamily: Fonts.bold, color: Colors.cr,
  },
  warningBody: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2,
    textAlign: 'center', lineHeight: 20,
  },

  section:    { marginBottom: Spacing.xl },
  sectionLbl: {
    fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 1.8, color: Colors.t3,
    textTransform: 'uppercase', marginBottom: 8,
  },
  inputCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 10,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: Fonts.regular,
    color: Colors.t1, paddingVertical: 14,
  },

  deleteButton: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  deleteButtonDim:  { opacity: 0.45 },
  deleteButtonText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },

  cancelLink: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t2 },
});
