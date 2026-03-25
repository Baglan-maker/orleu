// mobile/app/profile.tsx
/**
 * Profile / Settings screen.
 * Показывает: аватар, имя, уровень, кнопки настроек, logout.
 */
import { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Line, Path, Polyline, Circle } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

// ─── Icons ────────────────────────────────────────────────────────
function IBack()    { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="15 18 9 12 15 6"/></Svg>; }
function IChevron() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="9 18 15 12 9 6"/></Svg>; }
function ILogout()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><Polyline points="16 17 21 12 16 7"/><Line x1="21" y1="12" x2="9" y2="12"/></Svg>; }
function IBell()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><Path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>; }
function IShield()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>; }
function IInfo()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="10"/><Line x1="12" y1="8" x2="12" y2="12"/><Line x1="12" y1="16" x2="12.01" y2="16"/></Svg>; }

const GOAL_LABEL: Record<string, string> = {
  strength:     'Strength',
  hypertrophy:  'Hypertrophy',
  endurance:    'Endurance',
};
const LEVEL_LABEL: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

interface SettingRowProps {
  icon:    React.ReactNode;
  label:   string;
  value?:  string;
  onPress: () => void;
  danger?: boolean;
}
function SettingRow({ icon, label, value, onPress, danger }: SettingRowProps) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
      <View style={s.rowIcon}>{icon}</View>
      <Text style={[s.rowLabel, danger && { color: Colors.cr }]}>{label}</Text>
      <View style={{ flex: 1 }}/>
      {value && <Text style={s.rowValue}>{value}</Text>}
      <IChevron/>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router  = useRouter();
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const theme   = AvatarThemes[user?.avatar_theme_id ?? 0];
  const initial = (user?.name ?? 'U')[0].toUpperCase();

  function confirmLogout() {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
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
              <View style={s.tag}>
                <Text style={s.tagText}>{theme.name}</Text>
              </View>
              <View style={s.tag}>
                <Text style={s.tagText}>{LEVEL_LABEL[user?.experience_level ?? 'beginner']}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Goal */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>TRAINING</Text>
          <View style={s.card}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Goal</Text>
              <Text style={s.infoValue}>{GOAL_LABEL[user?.primary_goal ?? 'strength']}</Text>
            </View>
            <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: Colors.line }]}>
              <Text style={s.infoLabel}>Level</Text>
              <Text style={s.infoValue}>{LEVEL_LABEL[user?.experience_level ?? 'beginner']}</Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>SETTINGS</Text>
          <View style={s.card}>
            <SettingRow
              icon={<IBell/>}
              label="Notifications"
              value="On"
              onPress={() => {}}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<IShield/>}
              label="Privacy Policy"
              onPress={() => {}}
            />
            <View style={s.divider}/>
            <SettingRow
              icon={<IInfo/>}
              label="About Orleu"
              value="v1.0.0"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={s.section}>
          <View style={s.card}>
            <SettingRow
              icon={<ILogout/>}
              label={loggingOut ? 'Logging out...' : 'Log out'}
              onPress={confirmLogout}
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
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 26, fontFamily: Fonts.displayBold, color: '#fff' },
  name:  { fontSize: 18, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 2 },
  email: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginBottom: 8 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag:    { backgroundColor: Colors.s4, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.line },
  tagText:{ fontSize: 10, fontFamily: Fonts.semiBold, color: Colors.t3 },

  section:    { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionLbl: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 8 },

  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
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

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2 },
  infoValue: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },
});
