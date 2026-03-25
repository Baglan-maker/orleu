// mobile/app/(tabs)/stats.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Svg, { Line, Path, Polyline, Polygon } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes, getAvatarStage, type AvatarThemeId } from '../../constants/theme';
import { AvatarSVG }     from '../../components/avatar/AvatarSVG';
import { MomentumRing } from '../../components/avatar/MomentumRing';
import { Card }        from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuthStore } from '../../store/authStore';
import { useAchievementStore } from '../../store/achievementStore';
import { progressApi, type ProgressResponse } from '../../services/gamificationApi';
import { workoutApi, type WorkoutListItem } from '../../services/workoutApi';
import { AchievementIcon } from '../../components/achievement/AchievementIcon';

// ─── Icons ────────────────────────────────────────────────────────
function IUp() { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IChevron({ rotated }: { rotated: boolean }) {
  return (
    <Animated.View style={{ transform: [{ rotate: rotated ? '180deg' : '0deg' }] }}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="6 9 12 15 18 9"/>
      </Svg>
    </Animated.View>
  );
}

const STAGE_NAMES  = ['Rookie', 'Active', 'Athlete', 'Champion', 'Legend'];
const STAGE_THRESH = [0, 6, 16, 31, 51];

function xpForLevel(lvl: number) {
  return Math.floor(100 * Math.pow(1.15, lvl - 1));
}

// ─── Volume chart helpers ──────────────────────────────────────────
interface WeekData { label: string; volume: number; }

function buildWeeklyVolume(workouts: WorkoutListItem[]): WeekData[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + diff);
  currentMonday.setHours(0, 0, 0, 0);

  // 5 slots: index 0 = 4 weeks ago … index 4 = current week
  const weeks: WeekData[] = Array.from({ length: 5 }, (_, i) => ({
    label: i === 4 ? 'Now' : `W${i + 1}`,
    volume: 0,
  }));
  const starts = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() - (4 - i) * 7);
    return d;
  });

  for (const w of workouts) {
    const d = new Date(w.workout_date + 'T00:00:00');
    for (let i = 0; i < 5; i++) {
      const end = new Date(starts[i]);
      end.setDate(starts[i].getDate() + 7);
      if (d >= starts[i] && d < end) {
        weeks[i].volume += w.total_volume;
        break;
      }
    }
  }
  return weeks;
}

function computeMonthDelta(workouts: WorkoutListItem[]): number | null {
  const today = new Date();
  const thisStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  let thisVol = 0, lastVol = 0;
  for (const w of workouts) {
    const d = new Date(w.workout_date + 'T00:00:00');
    if (d >= thisStart) thisVol += w.total_volume;
    else if (d >= lastStart && d < thisStart) lastVol += w.total_volume;
  }
  if (lastVol === 0) return null;
  return Math.round((thisVol - lastVol) / lastVol * 100);
}

function fmtBarVol(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000)  return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

// ─── Screen ───────────────────────────────────────────────────────
export default function StatsScreen() {
  const { user }  = useAuthStore();
  const themeId   = (user?.avatar_theme_id ?? 0) as AvatarThemeId;
  const theme     = AvatarThemes[themeId];

  const [progress,       setProgress]       = useState<ProgressResponse | null>(null);
  const [totalWorkouts,  setTotalWorkouts]  = useState(0);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutListItem[]>([]);
  const [loading,        setLoading]        = useState(true);

  // Debug panel — 5-tap on level number
  const tapCountRef  = useRef(0);
  const tapTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleLevelTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      router.push('/debug');
      return;
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
  }

  // Achievements
  const { achievements: storeAchievements, fetchAchievements } = useAchievementStore();
  const [achExpanded, setAchExpanded] = useState(false);
  const achHeight = useRef(new Animated.Value(0)).current;

  // Volume chart animation
  const barAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [progRes, histRes] = await Promise.all([
            progressApi.get(),
            workoutApi.getHistory(50),
          ]);
          if (cancelled) return;
          setProgress(progRes.data);
          setTotalWorkouts(progRes.data.total_sessions ?? 0);
          const hist = (histRes.data as any).items ?? [];
          setWorkoutHistory(hist);
          fetchAchievements();
        } catch {
          // fallback — keep defaults
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const weeklyData = useMemo(() => buildWeeklyVolume(workoutHistory), [workoutHistory]);
  const volPct     = useMemo(() => computeMonthDelta(workoutHistory), [workoutHistory]);

  useEffect(() => {
    const maxVol = Math.max(...weeklyData.map(w => w.volume), 1);
    weeklyData.forEach((w, i) => {
      Animated.spring(barAnims[i], {
        toValue: w.volume > 0 ? Math.round((w.volume / maxVol) * 72) : 0,
        useNativeDriver: false,
        tension: 50,
        friction: 8,
      } as any).start();
    });
  }, [weeklyData]);

  // Derived stats
  const xp     = progress?.xp ?? 0;
  const level  = progress?.level ?? 1;
  const streak = progress?.current_streak ?? 0;
  const coins  = progress?.coins ?? 0;

  const xpNext  = xpForLevel(level);
  let xpUsed = 0;
  for (let l = 1; l < level; l++) xpUsed += xpForLevel(l);
  const xpInLevel = xp - xpUsed;
  const xpPct     = xpNext > 0 ? Math.round((xpInLevel / xpNext) * 100) : 0;

  const stage    = getAvatarStage(totalWorkouts);
  const momentum = Math.min(100, (totalWorkouts % 7) * 14 + 40);
  const stageNext = Math.min(stage + 1, 4);
  const stagePct  = stage < 4
    ? Math.round((totalWorkouts - STAGE_THRESH[stage]) / (STAGE_THRESH[stageNext] - STAGE_THRESH[stage]) * 100)
    : 100;
  const score = Math.round(totalWorkouts * 12 + stage * 80 + xp * 0.1);

  const achList     = storeAchievements.length > 0 ? storeAchievements : (progress?.achievements ?? []);
  const earnedAch   = achList.filter(a => a.earned);
  const earnedCount = earnedAch.length;

  function toggleAchExpanded() {
    const toExpanded = !achExpanded;
    setAchExpanded(toExpanded);
    Animated.spring(achHeight, {
      toValue: toExpanded ? 1 : 0,
      tension: 60,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }

  // Collapsed row height: icon (44) + label space (18) + margin = ~68
  // Grid: ceil(total/3) rows * 68
  const gridRows    = Math.ceil(achList.length / 3);
  const expandedH   = gridRows * 68;
  const collapsedH  = earnedCount > 0 ? 68 : 0;
  const animatedH   = achHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedH, expandedH],
  });

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={Colors.cr} size="large"/>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.lbl}>Overview</Text>
            <Text style={s.pageTitle}>Progress</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.lbl}>Ascent score</Text>
            <Text style={s.score}>{score}</Text>
          </View>
        </View>

        {/* ── Level card ── */}
        <Card variant="default">
          <View style={s.levelRow}>
            <View style={s.avatarContainer}>
              <MomentumRing pct={momentum} color={theme.color} size={82} />
              <View style={s.avatarAbsolute}>
                <AvatarSVG themeId={themeId} stage={stage} size={54} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stageName}>{theme.name} · {STAGE_NAMES[stage]}</Text>
              <TouchableOpacity onPress={handleLevelTap} activeOpacity={1}>
                <Text style={s.levelNum}>Level {level}</Text>
              </TouchableOpacity>
              <ProgressBar
                value={xpPct}
                color={Colors.cr}
                height={5}
                leftText={`${xpInLevel} / ${xpNext} XP`}
                rightText={`Lv.${level + 1}`}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
          {stage < 4 && (
            <View style={s.stageRow}>
              <Text style={s.stageLabel}>
                {totalWorkouts - STAGE_THRESH[stage]} / {STAGE_THRESH[stageNext] - STAGE_THRESH[stage]} sessions to {STAGE_NAMES[stageNext]}
              </Text>
              <ProgressBar value={stagePct} color={theme.color} height={3} style={{ marginTop: 6 }}/>
            </View>
          )}
        </Card>

        {/* ── Stat boxes ── */}
        <View style={s.statRow}>
          {[
            { val: String(totalWorkouts), label: 'Sessions', color: Colors.t1 },
            { val: String(streak),        label: 'Streak',   color: Colors.cr },
            { val: String(coins),         label: 'Coins',    color: Colors.bone },
          ].map((st, i) => (
            <View key={i} style={s.statBox}>
              <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Trend ── */}
        <Card variant="bone">
          <Text style={[s.lbl, { marginBottom: 8 }]}>Current trend</Text>
          <View style={s.trendRow}>
            <View style={s.trendIcon}><IUp/></View>
            <View>
              <Text style={s.trendTitle}>
                {streak >= 3 ? 'Improving' : streak >= 1 ? 'Active' : 'Getting Started'}
              </Text>
              <Text style={s.trendSub}>
                {streak} day streak · Level {level} · {coins} coins
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Weekly Volume Chart ── */}
        <Card variant="default">
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Weekly Volume</Text>
            {volPct !== null && (
              <View style={s.volChip}>
                <Text style={[s.volChipText, { color: volPct >= 0 ? Colors.cr : Colors.t3 }]}>
                  {volPct >= 0 ? '+' : ''}{volPct}% vs last month
                </Text>
              </View>
            )}
          </View>

          <View style={s.chartArea}>
            {weeklyData.map((week, i) => (
              <View key={i} style={s.barCol}>
                {week.volume > 0 && (
                  <Text style={[s.barVolText, { color: i === 4 ? Colors.cr : Colors.t3 }]}>
                    {fmtBarVol(week.volume)}
                  </Text>
                )}
                <Animated.View style={[
                  s.bar,
                  {
                    height: barAnims[i],
                    backgroundColor: i === 4 ? Colors.cr : Colors.s4,
                  },
                ]}/>
              </View>
            ))}
          </View>

          <View style={s.weekLabels}>
            {weeklyData.map((week, i) => (
              <Text key={i} style={s.weekLabel}>{week.label}</Text>
            ))}
          </View>
        </Card>

        {/* ── Achievements (collapsible) ── */}
        <Card>
          <TouchableOpacity style={s.achHeader} onPress={toggleAchExpanded} activeOpacity={0.7}>
            <View style={s.achHeaderLeft}>
              <Text style={s.chartTitle}>Achievements</Text>
              {achList.length > 0 && (
                <Text style={s.achCountBadge}>{earnedCount} / {achList.length}</Text>
              )}
            </View>
            <IChevron rotated={achExpanded} />
          </TouchableOpacity>

          <Animated.View style={{ height: animatedH, overflow: 'hidden' }}>
            {!achExpanded ? (
              /* Collapsed: horizontal row of earned icons */
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.achScrollRow}>
                {earnedAch.slice(0, 5).map(a => (
                  <View key={a.id} style={s.achItemH}>
                    <View style={[s.achBox, { backgroundColor: Colors.crLo, borderColor: Colors.crBdr }]}>
                      <AchievementIcon iconKey={a.icon_key} color={Colors.cr} size={20} />
                    </View>
                    <Text style={s.achLabel} numberOfLines={1}>{a.name}</Text>
                  </View>
                ))}
                {earnedCount > 5 && (
                  <View style={s.achMoreWrap}>
                    <Text style={s.achMoreText}>+{earnedCount - 5} more</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              /* Expanded: 3-column grid of all achievements */
              <View style={s.achGrid}>
                {achList.map(a => (
                  <View key={a.id} style={[s.achItem, !a.earned && { opacity: 0.4 }]}>
                    <View style={[
                      s.achBox,
                      a.earned
                        ? { backgroundColor: Colors.crLo, borderColor: Colors.crBdr }
                        : { backgroundColor: Colors.s3,   borderColor: Colors.line  },
                    ]}>
                      <AchievementIcon
                        iconKey={a.icon_key}
                        color={a.earned ? Colors.cr : Colors.t3}
                        size={20}
                      />
                    </View>
                    <Text style={s.achLabel} numberOfLines={2}>{a.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.xl, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
  },
  lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase' },
  pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, marginTop: 3 },
  score:     { fontSize: 22, fontFamily: Fonts.monoBold, color: Colors.bone, marginTop: 3 },

  levelRow:       { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarContainer:{ width: 82, height: 82, position: 'relative', flexShrink: 0 },
  avatarAbsolute: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -27 }, { translateY: -35 }] },
  stageName:     { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3, marginBottom: 2, letterSpacing: 0.3 },
  levelNum:      { fontSize: 28, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -1, lineHeight: 32 },
  stageRow:      { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.line },
  stageLabel:    { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: 10 },
  statBox: {
    flex: 1, backgroundColor: Colors.s3,
    borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center',
  },
  statVal:   { fontSize: 26, fontFamily: Fonts.monoBold, lineHeight: 30, marginBottom: 4 },
  statLabel: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Colors.t3, textTransform: 'uppercase' },

  trendRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trendIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: `${Colors.up}15`, borderWidth: 1, borderColor: `${Colors.up}25`, alignItems: 'center', justifyContent: 'center' },
  trendTitle:{ fontSize: 17, fontFamily: Fonts.bold, color: Colors.up, letterSpacing: 0.2 },
  trendSub:  { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },

  // ── Volume chart ────────────────────────────────────────────────
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle:  { fontSize: 14, fontFamily: Fonts.bold, color: Colors.t1 },
  volChip:     { backgroundColor: Colors.s3, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.line },
  volChipText: { fontSize: 10, fontFamily: Fonts.mono },

  chartArea:  { flexDirection: 'row', alignItems: 'flex-end', height: 96 },
  barCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barVolText: { fontSize: 9, fontFamily: Fonts.mono, marginBottom: 4, textAlign: 'center' },
  bar:        { width: '72%', borderRadius: 3, minHeight: 2 },

  weekLabels: { flexDirection: 'row', marginTop: 8 },
  weekLabel:  { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3 },

  // ── Achievements ────────────────────────────────────────────────
  achHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  achHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achCountBadge: { fontSize: 12, fontFamily: Fonts.monoBold, color: Colors.cr },
  achScrollRow:  { flexDirection: 'row' },
  achItemH:      { alignItems: 'center', gap: 6, marginRight: 12, width: 56 },
  achMoreWrap:   { justifyContent: 'center', paddingHorizontal: 8 },
  achMoreText:   { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  achGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  achItem:       { width: '33.33%', alignItems: 'center', gap: 6, marginBottom: 12 },
  achBox:        { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  achLabel:      { fontSize: 9, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', width: 56, lineHeight: 13 },
});
