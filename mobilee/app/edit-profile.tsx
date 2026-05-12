// mobile/app/edit-profile.tsx
import { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';
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

type Goal  = 'strength' | 'hypertrophy' | 'endurance';
type Level = 'beginner' | 'intermediate' | 'advanced';

const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: 'strength',    label: 'Strength',    desc: 'Lift heavier, build raw power' },
  { value: 'hypertrophy', label: 'Hypertrophy', desc: 'Grow muscle size and volume' },
  { value: 'endurance',   label: 'Endurance',   desc: 'Train longer, build conditioning' },
];

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Less than 1 year of training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years of consistent training' },
  { value: 'advanced',     label: 'Advanced',     desc: '3+ years of structured training' },
];

function OptionRow<T extends string>({
  item, selected, onSelect,
}: {
  item: { value: T; label: string; desc: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.optionRow, selected && s.optionRowSelected]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <View style={s.optionText}>
        <Text style={[s.optionLabel, selected && s.optionLabelSelected]}>{item.label}</Text>
        <Text style={s.optionDesc}>{item.desc}</Text>
      </View>
      <View style={[s.optionCheck, selected && s.optionCheckSelected]}>
        {selected && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="20 6 9 17 4 12" />
          </Svg>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function EditProfileScreen() {
  const router  = useRouter();
  const { user, setUser } = useAuthStore();

  const [name,  setName]  = useState(user?.name ?? '');
  const [goal,  setGoal]  = useState<Goal>(user?.primary_goal ?? 'strength');
  const [level, setLevel] = useState<Level>(user?.experience_level ?? 'beginner');
  const [saving, setSaving] = useState(false);

  const isDirty =
    name.trim() !== (user?.name ?? '') ||
    goal  !== user?.primary_goal ||
    level !== user?.experience_level;

  async function handleSave() {
    if (!isDirty) { router.back(); return; }
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your display name.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await authApi.updateMe({
        name: name.trim(),
        primary_goal: goal,
        experience_level: level,
      });
      setUser(data);
      router.back();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert('Save failed', typeof detail === 'string' ? detail : 'Could not save changes. Try again.');
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
        <Text style={s.pageTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.cr} />
            : <Text style={[s.saveBtn, !isDirty && s.saveBtnDim]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Display name */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>DISPLAY NAME</Text>
          <View style={s.inputCard}>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.t3}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={60}
            />
          </View>
        </View>

        {/* Goal */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>TRAINING GOAL</Text>
          <View style={s.card}>
            {GOALS.map((g, i) => (
              <View key={g.value}>
                {i > 0 && <View style={s.divider} />}
                <OptionRow item={g} selected={goal === g.value} onSelect={() => setGoal(g.value)} />
              </View>
            ))}
          </View>
        </View>

        {/* Experience level */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>EXPERIENCE LEVEL</Text>
          <View style={s.card}>
            {LEVELS.map((l, i) => (
              <View key={l.value}>
                {i > 0 && <View style={s.divider} />}
                <OptionRow item={l} selected={level === l.value} onSelect={() => setLevel(l.value)} />
              </View>
            ))}
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
  saveBtn:    { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.cr },
  saveBtnDim: { opacity: 0.4 },

  section:    { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionLbl: {
    fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 1.8, color: Colors.t3,
    textTransform: 'uppercase', marginBottom: 8,
  },

  inputCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 16, paddingVertical: 2,
  },
  input: {
    fontSize: 15, fontFamily: Fonts.regular,
    color: Colors.t1, paddingVertical: 14,
  },

  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.line },

  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  optionRowSelected: { backgroundColor: Colors.crLo },
  optionText:  { flex: 1 },
  optionLabel: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t2, marginBottom: 2 },
  optionLabelSelected: { color: Colors.t1 },
  optionDesc:  { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3 },
  optionCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.t3,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  optionCheckSelected: { backgroundColor: Colors.cr, borderColor: Colors.cr },
});
