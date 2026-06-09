import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { api } from '../services/api';
import { useAchievementStore } from '../store/achievementStore';

// ─── Back arrow SVG ───────────────────────────────────────────────
function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

// ─── Feedback state per action ────────────────────────────────────
type FeedbackState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string };

function useFeedback() {
  const [fb, setFb] = useState<FeedbackState>({ status: 'idle', message: '' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setSuccess(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFb({ status: 'success', message: msg });
    timerRef.current = setTimeout(() => setFb({ status: 'idle', message: '' }), 2000);
  }

  function setError(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFb({ status: 'error', message: msg });
    timerRef.current = setTimeout(() => setFb({ status: 'idle', message: '' }), 2000);
  }

  function setLoading() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFb({ status: 'loading', message: '' });
  }

  return { fb, setSuccess, setError, setLoading };
}

// ─── Inline feedback label ────────────────────────────────────────
function FeedbackLabel({ fb }: { fb: FeedbackState }) {
  if (fb.status === 'idle') return null;
  if (fb.status === 'loading') return <ActivityIndicator size="small" color={Colors.cr} style={{ marginTop: 6 }} />;
  const color = fb.status === 'success' ? Colors.up : Colors.dn;
  const prefix = fb.status === 'success' ? '✓ ' : '✗ ';
  return <Text style={[s.fbText, { color }]}>{prefix}{fb.message}</Text>;
}

// ─── Section header ───────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionLine} />
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

// ─── Action button ────────────────────────────────────────────────
interface ActionButtonProps {
  label: string;
  onPress: () => void;
  loading: boolean;
  variant?: 'default' | 'danger';
  flex?: number;
}
function ActionButton({ label, onPress, loading, variant = 'default', flex }: ActionButtonProps) {
  const bg = variant === 'danger' ? Colors.dn : Colors.s3;
  return (
    <TouchableOpacity
      style={[s.actionBtn, { backgroundColor: bg, flex: flex ?? undefined }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading
        ? <ActivityIndicator size="small" color={Colors.t1} />
        : <Text style={s.actionBtnText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────
export default function DebugScreen() {
  const { fetchAchievements } = useAchievementStore();

  // ── Workout seeding feedback
  const seedFb = useFeedback();

  // ── Set counters
  const [campaignWorkouts,  setCampaignWorkoutsVal]  = useState('0');
  const [streakDays,        setStreakDaysVal]         = useState('0');
  const [campaignMissions,  setCampaignMissionsVal]  = useState('0');
  const counterFb = useFeedback();

  // ── Campaign
  const campaignFb = useFeedback();

  // ── Advance chapter
  const chapterFb = useFeedback();

  // ── Achievements
  const clearAchFb = useFeedback();

  // ── Full reset
  const resetFb = useFeedback();

  // ── ML trend (demo)
  const trendFb   = useFeedback();
  const nightlyFb = useFeedback();

  // ─── Helpers ──────────────────────────────────────────────────
  async function timeTravelPost(payload: Record<string, unknown>, fb: ReturnType<typeof useFeedback>) {
    fb.setLoading();
    try {
      await api.post('/api/debug/time-travel', payload);
      return true;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Request failed';
      fb.setError(msg);
      return false;
    }
  }

  // ─── Workout seeding ──────────────────────────────────────────
  async function handleSeedWorkouts(count: 3 | 10 | 30) {
    seedFb.setLoading();
    try {
      const payloads: Record<number, object> = {
        3:  { count: 3,  consecutive: true },
        10: { count: 10, consecutive: true, exercises_per_workout: 4 },
        30: { count: 30, days_back: 60 },
      };
      await api.post('/api/debug/seed-workout-history', payloads[count]);
      seedFb.setSuccess(`Seeded ${count} workouts`);
      fetchAchievements();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Request failed';
      seedFb.setError(msg);
    }
  }

  // ─── Set counters ─────────────────────────────────────────────
  async function handleApplyCounters() {
    const ok = await timeTravelPost({
      set_campaign_workouts: parseInt(campaignWorkouts, 10) || 0,
      set_campaign_streak:   parseInt(streakDays, 10) || 0,
      set_campaign_missions: parseInt(campaignMissions, 10) || 0,
      check_achievements:    true,
      advance_chapter:       true,
    }, counterFb);
    if (ok) {
      counterFb.setSuccess('Applied — achievements checked');
      fetchAchievements();
    }
  }

  // ─── Campaign path ────────────────────────────────────────────
  async function handleSetPath(path: 'A' | 'B') {
    const ok = await timeTravelPost({
      set_campaign_path: path,
      advance_chapter: true,
    }, campaignFb);
    if (ok) campaignFb.setSuccess(`Path ${path} set`);
  }

  // ─── Advance chapter ──────────────────────────────────────────
  async function handleAdvanceChapter() {
    const ok = await timeTravelPost({ advance_chapter: true }, chapterFb);
    if (ok) chapterFb.setSuccess('Chapter advanced');
  }

  // ─── Reset path ───────────────────────────────────────────────
  async function handleResetPath() {
    const ok = await timeTravelPost({ clear_campaign_path: true, advance_chapter: false }, campaignFb);
    if (ok) campaignFb.setSuccess('Path cleared — choose again');
  }

  // ─── Clear achievements ───────────────────────────────────────
  async function handleClearAchievements() {
    const ok = await timeTravelPost({ clear_achievements: true }, clearAchFb);
    if (ok) {
      clearAchFb.setSuccess('Achievements cleared');
      fetchAchievements();
    }
  }

  // ─── Full reset ───────────────────────────────────────────────
  async function handleFullReset() {
    // full_reset=true deletes all workouts, missions, achievements and zeros all progress
    const ok = await timeTravelPost({ full_reset: true }, resetFb);
    if (ok) {
      resetFb.setSuccess('Full reset complete');
      fetchAchievements();
    }
  }

  // ─── ML trend (demo) ──────────────────────────────────────────
  async function handleSetTrend(trend: 'improving' | 'plateau' | 'declining') {
    trendFb.setLoading();
    try {
      await api.post('/api/debug/set-trend', { trend, make_eligible: true });
      trendFb.setSuccess(`Trend set: ${trend} — open Missions`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Request failed';
      trendFb.setError(msg);
    }
  }

  async function handleRunNightly() {
    nightlyFb.setLoading();
    try {
      const res = await api.post('/api/debug/run-ml');
      const n = (res.data as { processed_users?: number })?.processed_users ?? 0;
      nightlyFb.setSuccess(`Nightly ML ran — ${n} user(s) processed`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Request failed';
      nightlyFb.setError(msg);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <View style={s.headerTitles}>
          <Text style={s.title}>Debug Panel</Text>
          <Text style={s.subtitle}>Dev only — not for users</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── WORKOUT HISTORY ── */}
        <SectionLabel label="WORKOUT HISTORY" />
        <View style={s.row}>
          <ActionButton label="3 workouts"  onPress={() => handleSeedWorkouts(3)}  loading={seedFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="10 workouts" onPress={() => handleSeedWorkouts(10)} loading={seedFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="30 workouts" onPress={() => handleSeedWorkouts(30)} loading={seedFb.fb.status === 'loading'} flex={1} />
        </View>
        <FeedbackLabel fb={seedFb.fb} />

        {/* ── ML TREND (DEMO) ── */}
        <SectionLabel label="ML TREND (DEMO)" />
        <View style={s.row}>
          <ActionButton label="Improving" onPress={() => handleSetTrend('improving')} loading={trendFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="Plateau"   onPress={() => handleSetTrend('plateau')}   loading={trendFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="Declining" onPress={() => handleSetTrend('declining')} loading={trendFb.fb.status === 'loading'} flex={1} />
        </View>
        <FeedbackLabel fb={trendFb.fb} />
        <View style={s.spacer} />
        <ActionButton label="Run Nightly ML Now" onPress={handleRunNightly} loading={nightlyFb.fb.status === 'loading'} />
        <FeedbackLabel fb={nightlyFb.fb} />

        {/* ── SET COUNTERS ── */}
        <SectionLabel label="SET COUNTERS" />
        <View style={s.row}>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Workouts in Campaign</Text>
            <TextInput
              style={s.input}
              value={campaignWorkouts}
              onChangeText={setCampaignWorkoutsVal}
              keyboardType="number-pad"
              placeholderTextColor={Colors.t3}
            />
          </View>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Streak Days</Text>
            <TextInput
              style={s.input}
              value={streakDays}
              onChangeText={setStreakDaysVal}
              keyboardType="number-pad"
              placeholderTextColor={Colors.t3}
            />
          </View>
        </View>
        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>Missions in Campaign</Text>
          <TextInput
            style={s.input}
            value={campaignMissions}
            onChangeText={setCampaignMissionsVal}
            keyboardType="number-pad"
            placeholderTextColor={Colors.t3}
          />
        </View>
        <ActionButton
          label="Apply + Check Achievements"
          onPress={handleApplyCounters}
          loading={counterFb.fb.status === 'loading'}
        />
        <FeedbackLabel fb={counterFb.fb} />

        {/* ── CAMPAIGN ── */}
        <SectionLabel label="CAMPAIGN" />
        <View style={s.row}>
          <ActionButton label="Path A" onPress={() => handleSetPath('A')} loading={campaignFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="Path B" onPress={() => handleSetPath('B')} loading={campaignFb.fb.status === 'loading'} flex={1} />
          <ActionButton label="Reset Path" onPress={handleResetPath} loading={campaignFb.fb.status === 'loading'} flex={1} />
        </View>
        <FeedbackLabel fb={campaignFb.fb} />
        <View style={s.spacer} />
        <ActionButton label="Advance Chapter" onPress={handleAdvanceChapter} loading={chapterFb.fb.status === 'loading'} />
        <FeedbackLabel fb={chapterFb.fb} />

        {/* ── ACHIEVEMENTS ── */}
        <SectionLabel label="ACHIEVEMENTS" />
        <ActionButton label="Clear All Achievements" onPress={handleClearAchievements} loading={clearAchFb.fb.status === 'loading'} />
        <FeedbackLabel fb={clearAchFb.fb} />

        {/* ── RESET ── */}
        <SectionLabel label="RESET" />
        <ActionButton label="Full Reset" onPress={handleFullReset} loading={resetFb.fb.status === 'loading'} variant="danger" />
        <FeedbackLabel fb={resetFb.fb} />

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingHorizontal: Spacing.xxl, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.s3,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: { flex: 1 },
  title:    { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.cr, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionLine:  { flex: 1, height: 1, backgroundColor: Colors.line },
  sectionLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 1.8,
    color: Colors.t3,
    textTransform: 'uppercase',
  },

  row: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  spacer: { height: 8 },

  actionBtn: {
    borderRadius: Radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  actionBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1 },

  inputWrap:  { flex: 1, marginBottom: 8 },
  inputLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.t1,
    fontFamily: Fonts.mono,
    fontSize: 16,
  },

  fbText: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 6, marginBottom: 4 },
});
