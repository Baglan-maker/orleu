// mobile/app/profile.tsx
import { useState } from 'react';
import {
  Alert, ScrollView, Share, StyleSheet, Switch, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Line, Path, Polyline, Circle, Rect } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';

import { Colors, Fonts, Radius, Spacing, AvatarThemes } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

// ─── Storage keys ──────────────────────────────────────────────────
const KEY_NOTIFS = 'pref_notifications';  // 'true' | 'false'

// ─── Icons ────────────────────────────────────────────────────────
function IBack()    { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="15 18 9 12 15 6"/></Svg>; }
function IChevron() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="9 18 15 12 9 6"/></Svg>; }
function ILogout()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><Polyline points="16 17 21 12 16 7"/><Line x1="21" y1="12" x2="9" y2="12"/></Svg>; }
function IBell()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><Path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>; }
function IShield()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>; }
function IInfo()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="10"/><Line x1="12" y1="8" x2="12" y2="12"/><Line x1="12" y1="16" x2="12.01" y2="16"/></Svg>; }
function ILeaf()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2C7 2 3 6 3 11c0 4 2.5 7.5 6 9.5C10.5 22 12 22 12 22s1.5 0 3-1.5C18.5 18.5 21 15 21 11c0-5-4-9-9-9z"/><Path d="M12 2 Q12 12 8 18"/></Svg>; }
function ILock()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><Path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>; }
function IEdit()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>; }
function ITarget()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="10"/><Circle cx="12" cy="12" r="6"/><Circle cx="12" cy="12" r="2"/></Svg>; }
function IWeight()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M2 20h20"/><Path d="M6 20V10l6-8 6 8v10"/><Path d="M10 20v-5h4v5"/></Svg>; }
function IDownload(){ return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><Polyline points="7 10 12 15 17 10"/><Line x1="12" y1="15" x2="12" y2="3"/></Svg>; }
function ITrash()   { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6"/><Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><Path d="M10 11v6"/><Path d="M14 11v6"/><Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>; }
function ICrown()   { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M2 7l4 9h12l4-9-6 4-4-7-4 7-6-4z"/><Line x1="6" y1="20" x2="18" y2="20"/></Svg>; }
function IChevronCr() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="9 18 15 12 9 6"/></Svg>; }

const GOAL_LABEL: Record<string, string> = {
  strength:    'Strength',
  hypertrophy: 'Hypertrophy',
  endurance:   'Endurance',
};
const LEVEL_LABEL: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

// ─── SettingRow ────────────────────────────────────────────────────
interface SettingRowProps {
  icon:    React.ReactNode;
  label:   string;
  value?:  string;
  onPress?: () => void;
  danger?: boolean;
  rightNode?: React.ReactNode;
}
function SettingRow({ icon, label, value, onPress, danger, rightNode }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={s.rowIcon}>{icon}</View>
      <Text style={[s.rowLabel, danger && { color: Colors.cr }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={s.rowValue}>{value}</Text>}
      {rightNode}
      {!rightNode && onPress && <IChevron />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router  = useRouter();
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [notifsOn,   setNotifsOn]   = useState(true);

  const theme   = AvatarThemes[user?.avatar_theme_id ?? 0];
  const initial = (user?.name ?? 'U')[0].toUpperCase();

  async function handleNotifsToggle(val: boolean) {
    setNotifsOn(val);
    await SecureStore.setItemAsync(KEY_NOTIFS, String(val)).catch(() => {});
  }

  // ── Logout ─────────────────────────────────────────────────────
  function confirmLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  }

  // ── Delete account ─────────────────────────────────────────────
  function confirmDelete() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue', style: 'destructive',
          onPress: () => router.push('/delete-account'),
        },
      ],
    );
  }

  // ── Export data ────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await authApi.exportData();
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        title: 'Orleu – My Data Export',
        message: json,
      });
    } catch (err: any) {
      Alert.alert('Export failed', 'Could not export your data. Try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IBack/>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Profile</Text>
          <View style={{ width: 36 }}/>
        </View>

        {/* Avatar card */}
        <View style={s.avatarCard}>
          <View style={[s.avatar, { backgroundColor: theme.color }]}>
            <Text style={s.avatarInitial}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name ?? '—'}</Text>
            <Text style={s.email}>{user?.email ?? '—'}</Text>
            <View style={s.tagRow}>
              <View style={s.tag}><Text style={s.tagText}>{theme.name}</Text></View>
              <View style={s.tag}><Text style={s.tagText}>{LEVEL_LABEL[user?.experience_level ?? 'beginner']}</Text></View>
            </View>
          </View>
        </View>

        {/* Pro upsell */}
        <TouchableOpacity
          style={s.proCard}
          activeOpacity={0.85}
          onPress={() => router.push('/paywall' as any)}
        >
          <View style={s.proIconBox}>
            <ICrown/>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.proTitle}>Upgrade to Pro</Text>
            <Text style={s.proSub}>30 days free, then $10/mo</Text>
          </View>
          <IChevronCr/>
        </TouchableOpacity>

        {/* Account */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>ACCOUNT</Text>
          <View style={s.card}>
            <SettingRow
              icon={<IEdit/>}
              label="Edit Profile"
              value={user?.name ?? ''}
              onPress={() => router.push('/edit-profile')}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<ITarget/>}
              label="Training Goal"
              value={GOAL_LABEL[user?.primary_goal ?? 'strength']}
              onPress={() => router.push('/edit-profile')}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<IWeight/>}
              label="Experience Level"
              value={LEVEL_LABEL[user?.experience_level ?? 'beginner']}
              onPress={() => router.push('/edit-profile')}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<ILock/>}
              label="Change Password"
              onPress={() => router.push('/change-password')}
            />
          </View>
        </View>

        {/* Nutrition */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>NUTRITION</Text>
          <View style={s.card}>
            <SettingRow
              icon={<ILeaf/>}
              label="Nutrition Goals"
              onPress={() => router.push('/nutrition-goals')}
            />
          </View>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>PREFERENCES</Text>
          <View style={s.card}>
            <SettingRow
              icon={<IBell/>}
              label="Notifications"
              rightNode={
                <Switch
                  value={notifsOn}
                  onValueChange={handleNotifsToggle}
                  trackColor={{ false: Colors.s4, true: Colors.crMid }}
                  thumbColor={notifsOn ? Colors.cr : Colors.t3}
                  ios_backgroundColor={Colors.s4}
                />
              }
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<IWeight/>}
              label="Units"
              value="kg"
            />
          </View>
        </View>

        {/* App info */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>APP</Text>
          <View style={s.card}>
            <SettingRow
              icon={<IShield/>}
              label="Privacy Policy"
              onPress={() => router.push('/privacy')}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<IInfo/>}
              label="About Orleu"
              value="v1.0.0"
              onPress={() => router.push('/about')}
            />
          </View>
        </View>

        {/* Data */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>DATA</Text>
          <View style={s.card}>
            <SettingRow
              icon={<IDownload/>}
              label={exporting ? 'Exporting…' : 'Export My Data'}
              onPress={exporting ? undefined : handleExport}
            />
          </View>
        </View>

        {/* Danger zone */}
        <View style={s.section}>
          <View style={s.card}>
            <SettingRow
              icon={<ILogout/>}
              label={loggingOut ? 'Logging out…' : 'Log out'}
              onPress={confirmLogout}
              danger
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<ITrash/>}
              label="Delete Account"
              onPress={confirmDelete}
              danger
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingBottom: 48 },

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

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarInitial: { fontSize: 26, fontFamily: Fonts.displayBold, color: '#fff' },
  name:  { fontSize: 18, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 2 },
  email: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginBottom: 8 },
  tagRow:  { flexDirection: 'row', gap: 6 },
  tag:     { backgroundColor: Colors.s4, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.line },
  tagText: { fontSize: 10, fontFamily: Fonts.semiBold, color: Colors.t3 },

  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.crLo,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  proIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.crMid,
    borderWidth: 1, borderColor: Colors.crBdr,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  proTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 2 },
  proSub:   { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2 },

  section:    { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionLbl: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 8 },

  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.line, marginHorizontal: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon:  { width: 28, alignItems: 'center' },
  rowLabel: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },
  rowValue: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginRight: 4 },
});
