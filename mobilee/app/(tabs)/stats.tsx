// mobile/app/(tabs)/stats.tsx — Unified Profile Page
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  Colors, Fonts, Radius, Spacing,
  AvatarThemes, stageFromLevel, getCharacterImage, xpForLevel, type AvatarThemeId,
} from '../../constants/theme';
import { ProgressBar }   from '../../components/ui/ProgressBar';
import { useAuthStore }  from '../../store/authStore';
import { useAchievementStore } from '../../store/achievementStore';
import { progressApi, mlApi, type ProgressResponse, type MlStatusResponse } from '../../services/gamificationApi';
import {
  workoutApi, prsApi,
  type WorkoutListItem, type PRCurrentItem,
} from '../../services/workoutApi';
import { AchievementIcon } from '../../components/achievement/AchievementIcon';
import { WorkoutHeatmap }  from '../../components/profile/WorkoutHeatmap';
import {
  MuscleDistribution, buildMuscleData, type MuscleItem,
} from '../../components/profile/MuscleDistribution';
import { getSeenPrs, markPrsSeen } from '../../services/storage';

// ─── SVG Icons (stroke-only) ─────────────────────────────────────
function IGear() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}
function IFire({ size = 14, color = Colors.cr }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
    </Svg>
  );
}
function IStar({ size = 14, color = Colors.t1 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}
function IDumbbell({ size = 14, color = Colors.t2 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z" />
      <Line x1="4" y1="9" x2="7.5" y2="9" /><Line x1="4" y1="15" x2="7.5" y2="15" />
      <Line x1="16.5" y1="9" x2="20" y2="9" /><Line x1="16.5" y1="15" x2="20" y2="15" />
      <Line x1="7.5" y1="12" x2="16.5" y2="12" />
    </Svg>
  );
}
function ICoin({ size = 14, color = Colors.bone }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 8v8M9 12h6" />
    </Svg>
  );
}
function ITrophy({ color = Colors.bone }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-0.85-3.25-2.03-3.79A1.07 1.07 0 0 1 14 17v-2.34" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </Svg>
  );
}

// ─── Constants ────────────────────────────────────────────────────
const STAGE_NAMES  = ['Rookie', 'Active', 'Athlete', 'Champion', 'Legend'];
const WEEK_DAYS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SCREEN_H     = Dimensions.get('window').height;


// ─── Volume chart helpers ─────────────────────────────────────────
interface WeekData { label: string; volume: number }

function buildWeeklyVolume(workouts: WorkoutListItem[]): WeekData[] {
  const today = new Date();
  const dow   = today.getDay();
  const diff  = dow === 0 ? -6 : 1 - dow;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + diff);
  currentMonday.setHours(0, 0, 0, 0);

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
  const today     = new Date();
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

// ─── Sub-components ───────────────────────────────────────────────

function StatPill({ icon, value, label, color }: {
  icon: React.ReactNode; value: number | string; label: string; color: string;
}) {
  return (
    <View style={s.pill}>
      {icon}
      <Text style={[s.pillValue, { color }]}>{value}</Text>
      <Text style={s.pillLabel}>{label}</Text>
    </View>
  );
}

function StreakDay({ label, active, isToday, isFuture }: {
  label: string; active: boolean; isToday: boolean; isFuture: boolean;
}) {
  return (
    <View style={s.streakDayCol}>
      <Text style={[s.streakDayLabel, isToday && s.streakDayLabelToday]}>{label}</Text>
      <View style={[
        s.streakCircle,
        active && s.streakCircleActive,
        isToday && !active && s.streakCircleToday,
        isFuture && s.streakCircleFuture,
      ]}>
        {active ? (
          <IFire size={16} color={Colors.cr} />
        ) : (
          <View style={[s.streakDot, isFuture && { opacity: 0.3 }]} />
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user } = useAuthStore();
  const themeId  = (user?.avatar_theme_id ?? 0) as AvatarThemeId;
  const theme    = AvatarThemes[themeId];

  const [progress,       setProgress]       = useState<ProgressResponse | null>(null);
  const [totalWorkouts,  setTotalWorkouts]  = useState(0);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutListItem[]>([]);
  const [prs,            setPrs]            = useState<PRCurrentItem[]>([]);
  const [muscleData,     setMuscleData]     = useState<MuscleItem[]>([]);
  const [mlStatus,       setMlStatus]       = useState<MlStatusResponse | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState<string | null>(null);
  const [newPrIds,       setNewPrIds]       = useState<Set<string>>(new Set());
  const [xpInfoOpen,     setXpInfoOpen]     = useState(false);

  const { achievements: storeAchievements, fetchAchievements } = useAchievementStore();

  // Debug: 5-tap on level badge
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Volume chart bar animations
  const barAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  // ── Data fetching ──────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [progRes, histRes, prsRes, mlRes] = await Promise.all([
            progressApi.get(),
            workoutApi.getHistory(50),
            prsApi.getAll(),
            mlApi.status().catch(() => null),   // ML may 401/500 on first run — don't block screen
          ]);
          if (cancelled) return;

          setProgress(progRes.data);
          setTotalWorkouts(progRes.data.total_sessions ?? 0);
          const hist: WorkoutListItem[] = progRes.data ? ((histRes.data as any).items ?? []) : [];
          setWorkoutHistory(hist);
          setPrs(prsRes.data);
          setMlStatus(mlRes?.data ?? null);
          fetchAchievements();

          // Detect PRs the user hasn't seen yet so we can highlight them.
          // Fingerprint includes achieved_at so beating an old PR re-fires the badge.
          const seen = await getSeenPrs();
          const seenSet = new Set(seen);
          const fresh = prsRes.data
            .map(pr => `${pr.exercise_id}:${pr.achieved_at}`)
            .filter(fp => !seenSet.has(fp));
          if (!cancelled && fresh.length > 0) {
            setNewPrIds(new Set(fresh));
            // Persist immediately so a hard refresh doesn't re-flag them, but keep
            // showing the badge until the user actually sees the screen.
            markPrsSeen(fresh);
          }

          // Fetch muscle data for last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);

          const recentIds = hist
            .filter(w => new Date(w.workout_date + 'T00:00:00') >= sevenDaysAgo)
            .map(w => w.id);

          if (recentIds.length > 0) {
            const details = await Promise.all(
              recentIds.slice(0, 10).map(id => workoutApi.getById(id)),
            );
            if (cancelled) return;
            const allExercises = details.flatMap(d => d.data.exercises);
            setMuscleData(buildMuscleData(allExercises));
          }
        } catch {
          if (!cancelled) setFetchError('Could not load profile data. Pull down to retry.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // ── Derived data ───────────────────────────────────────────────
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

  // Clear the NEW-PR highlight after the user has had time to notice it.
  useEffect(() => {
    if (newPrIds.size === 0) return;
    const t = setTimeout(() => setNewPrIds(new Set()), 6000);
    return () => clearTimeout(t);
  }, [newPrIds]);

  const xp       = progress?.xp ?? 0;
  const level    = progress?.level ?? 1;
  const streak   = progress?.current_streak ?? 0;
  const longest  = progress?.longest_streak ?? 0;
  const coins    = progress?.coins ?? 0;

  const isMaxLevel = level >= 5;
  const xpNext   = xpForLevel(level); // 0 when max level
  let xpUsed = 0;
  for (let l = 1; l < level; l++) xpUsed += xpForLevel(l);
  const xpInLevel = isMaxLevel ? 0 : Math.max(0, xp - xpUsed);
  const xpPct     = isMaxLevel ? 100 : (xpNext > 0 ? Math.min(100, Math.round((xpInLevel / xpNext) * 100)) : 0);

  const stage     = stageFromLevel(level);
  const score     = Math.round(totalWorkouts * 12 + stage * 80 + xp * 0.1);
  // ML-driven trend when available; fall back to streak-based heuristic for cold-start users
  const ML_TREND_COLOR = { improving: Colors.up, plateau: Colors.flat, declining: Colors.dn } as const;
  const ML_TREND_LABEL = { improving: 'Improving', plateau: 'Plateau', declining: 'Declining' } as const;
  const isMlTrend  = mlStatus?.available && mlStatus.trend;
  const trendLabel = isMlTrend
    ? ML_TREND_LABEL[mlStatus.trend!]
    : streak >= 3 ? 'Improving' : streak >= 1 ? 'Active' : 'Getting Started';
  const trendColor = isMlTrend
    ? ML_TREND_COLOR[mlStatus.trend!]
    : streak >= 3 ? Colors.up : streak >= 1 ? Colors.bone : Colors.t3;

  const achList     = storeAchievements.length > 0 ? storeAchievements : (progress?.achievements ?? []);
  const earnedAch   = achList.filter(a => a.earned);
  const earnedCount = earnedAch.length;

  // Streak week data
  const streakWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const workoutDates = new Set(workoutHistory.map(w => w.workout_date));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        label: WEEK_DAYS[i],
        active: workoutDates.has(key),
        isToday: d.getTime() === today.getTime(),
        isFuture: d > today,
      };
    });
  }, [workoutHistory]);

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={Colors.cr} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {fetchError && (
          <View style={{ backgroundColor: Colors.s3, borderRadius: Radius.md, padding: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
            <Text style={{ color: Colors.dn, fontFamily: Fonts.regular, fontSize: 13 }}>{fetchError}</Text>
          </View>
        )}

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.userName}>{user?.name ?? 'Athlete'}</Text>
            <Text style={s.userSub}>{theme.name} · {STAGE_NAMES[stage]}</Text>
          </View>
          <TouchableOpacity
            style={s.gearBtn}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <IGear />
          </TouchableOpacity>
        </View>

        {/* ── Hero Avatar ── */}
        <View style={s.heroSection}>
          <Image
            source={getCharacterImage(themeId, stage)}
            style={s.characterImg}
          />
          <View style={[s.trendBadge, { borderColor: trendColor + '40' }]}>
            <View style={[s.trendDot, { backgroundColor: trendColor }]} />
            <Text style={[s.trendText, { color: trendColor }]}>{trendLabel}</Text>
            {isMlTrend && mlStatus.confidence != null && (
              <Text style={[s.trendConf, { color: trendColor }]}>
                {Math.round(mlStatus.confidence * 100)}%
              </Text>
            )}
          </View>
          <Text style={s.scoreLabel}>ASCENT SCORE</Text>
          <Text style={s.scoreValue}>{score}</Text>
        </View>

        {/* ── Stat Pills ── */}
        <View style={s.pillRow}>
          <StatPill icon={<IStar size={14} color={Colors.t1} />}       value={level}          label="Level"    color={Colors.t1} />
          <StatPill icon={<IFire size={14} />}                          value={streak}         label="Streak"   color={Colors.cr} />
          <StatPill icon={<IDumbbell size={14} color={Colors.t2} />}    value={totalWorkouts}  label="Sessions" color={Colors.t1} />
          <StatPill icon={<ICoin size={14} />}                          value={coins}          label="Coins"    color={Colors.bone} />
        </View>

        {/* ── Workout Heatmap ── */}
        <WorkoutHeatmap
          workouts={workoutHistory}
          onViewAll={() => router.push('/history')}
          onViewWorkout={(id) => router.push(`/workout/${id}`)}
        />

        {/* ── Muscle Distribution ── */}
        <MuscleDistribution data={muscleData} />

        {/* ── Weekly Volume Chart ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Weekly Volume</Text>
            {volPct !== null && (
              <View style={s.volChip}>
                <Text style={[s.volChipText, { color: volPct >= 0 ? Colors.up : Colors.cr }]}>
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
                ]} />
              </View>
            ))}
          </View>
          <View style={s.weekLabels}>
            {weeklyData.map((week, i) => (
              <Text key={i} style={s.weekLabel}>{week.label}</Text>
            ))}
          </View>
        </View>

        {/* ── Streak ── */}
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.7}
          onPress={() => router.push('/streaks')}
        >
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <IFire size={18} />
              <Text style={s.cardTitle}>Streak</Text>
            </View>
          </View>
          <View style={s.streakRow}>
            {streakWeek.map((d, i) => (
              <StreakDay key={i} {...d} />
            ))}
          </View>
          <View style={s.streakStats}>
            <View style={s.streakStat}>
              <Text style={s.streakStatVal}>{streak}</Text>
              <Text style={s.streakStatLabel}>Current</Text>
            </View>
            <View style={s.streakDivider} />
            <View style={s.streakStat}>
              <Text style={s.streakStatVal}>{longest}</Text>
              <Text style={s.streakStatLabel}>Best</Text>
            </View>
          </View>
          <Text style={s.streakHint}>
            Work out every day to keep your streak. Missing a day resets it.
          </Text>
        </TouchableOpacity>

        {/* ── Level & XP ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Level</Text>
            <TouchableOpacity
              onPress={() => setXpInfoOpen(o => !o)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={s.xpInfoBtn}
              activeOpacity={0.7}
            >
              <Text style={s.xpInfoBtnText}>{xpInfoOpen ? '×' : 'i'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.levelRow}>
            <TouchableOpacity onPress={handleLevelTap} activeOpacity={1}>
              <View style={[s.levelBadge, { borderColor: theme.color }]}>
                <Text style={s.levelBadgeNum}>{level}</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <ProgressBar
                value={xpPct}
                color={theme.color}
                height={6}
                leftText={isMaxLevel ? 'MAX LEVEL' : `${xpInLevel} / ${xpNext} XP`}
                rightText={isMaxLevel ? '' : `Lv.${level + 1}`}
              />
              <Text style={s.totalXp}>{xp} total XP</Text>
            </View>
          </View>
          {xpInfoOpen && (
            <View style={s.xpInfoPanel}>
              <Text style={s.xpInfoTitle}>How to earn XP</Text>
              <Text style={s.xpInfoLine}>• <Text style={s.xpInfoBold}>+50 XP</Text> per workout completed</Text>
              <Text style={s.xpInfoLine}>• <Text style={s.xpInfoBold}>+10 XP</Text> per exercise logged</Text>
              <Text style={s.xpInfoLine}>• <Text style={s.xpInfoBold}>+15 XP</Text> per 1,000 kg of volume moved</Text>
              <Text style={s.xpInfoLine}>• Bonus XP from missions and personal records</Text>
            </View>
          )}
        </View>

        {/* ── Personal Records ── */}
        {prs.length > 0 && (
          <View style={s.sectionOuter}>
            <View style={s.sectionOuterHeader}>
              <View style={s.cardHeaderLeft}>
                <ITrophy />
                <Text style={s.cardTitle}>Personal Records</Text>
              </View>
              <Text style={s.prCountBadge}>{prs.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.prScroll}
            >
              {prs.slice(0, 20).map((pr) => {
                const d = new Date(pr.achieved_at);
                const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                const fp = `${pr.exercise_id}:${pr.achieved_at}`;
                const isNew = newPrIds.has(fp);
                return (
                  <View key={pr.exercise_id} style={[s.prCard, isNew && s.prCardNew]}>
                    {isNew && (
                      <View style={s.prNewBadge}>
                        <Text style={s.prNewBadgeText}>NEW</Text>
                      </View>
                    )}
                    <Text style={s.prMuscle}>{pr.muscle_group}</Text>
                    <Text style={s.prName} numberOfLines={1}>{pr.exercise_name}</Text>
                    <Text style={[s.prWeight, isNew && { color: Colors.cr }]}>{pr.weight_kg} <Text style={s.prUnit}>kg</Text></Text>
                    <Text style={s.prDate}>{dateStr}</Text>
                  </View>
                );
              })}
              {prs.length > 20 && (
                <View style={[s.prCard, s.prCardMore]}>
                  <Text style={s.prMoreText}>+{prs.length - 20}{'\n'}more</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Achievements ── */}
        <View style={s.sectionOuter}>
          <View style={s.sectionOuterHeader}>
            <Text style={s.cardTitle}>Achievements</Text>
            {achList.length > 0 && (
              <Text style={s.achBadge}>{earnedCount} / {achList.length}</Text>
            )}
          </View>
          {earnedCount === 0 ? (
            <View style={s.achEmpty}>
              {(() => {
                const preview = achList.find(a => !a.earned);
                return (
                  <>
                    <View style={[s.achBox, s.achEmptyIcon]}>
                      <AchievementIcon
                        iconKey={preview?.icon_key ?? 'trophy'}
                        color={Colors.t3}
                        size={26}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.achEmptyTitle}>
                        {preview ? `Up next: ${preview.name}` : 'No achievements yet'}
                      </Text>
                      <Text style={s.achEmptyText}>
                        Complete workouts and missions to unlock achievements.
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.achScroll}
            >
              {achList.map(a => (
                <View key={a.id} style={[s.achItem, !a.earned && { opacity: 0.35 }]}>
                  <View style={[
                    s.achBox,
                    a.earned
                      ? { backgroundColor: Colors.crLo, borderColor: Colors.crBdr }
                      : { backgroundColor: Colors.s3,   borderColor: Colors.line },
                  ]}>
                    <AchievementIcon
                      iconKey={a.icon_key}
                      color={a.earned ? Colors.cr : Colors.t3}
                      size={22}
                    />
                  </View>
                  <Text style={s.achLabel} numberOfLines={2}>{a.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.lg, paddingBottom: 40 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  userName: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
    letterSpacing: -0.5,
  },
  userSub: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.t3,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero Avatar ──
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  characterImg: {
    width: SCREEN_H / 4,
    height: SCREEN_H / 4,
    resizeMode: 'contain',
    marginBottom: Spacing.md,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.s2,
    marginBottom: Spacing.sm,
  },
  trendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trendText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
  trendConf: {
    fontSize: 10,
    fontFamily: Fonts.mono,
    opacity: 0.7,
    marginLeft: 4,
  },
  scoreLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    color: Colors.t3,
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 28,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    letterSpacing: -1,
  },

  // ── Stat Pills ──
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingVertical: 12,
    gap: 4,
  },
  pillValue: {
    fontSize: 20,
    fontFamily: Fonts.monoBold,
    lineHeight: 24,
  },
  pillLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    color: Colors.t3,
    textTransform: 'uppercase',
  },

  // ── Cards (generic) ──
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.t1,
  },

  // ── Volume Chart ──
  volChip: {
    backgroundColor: Colors.s3,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  volChipText: { fontSize: 10, fontFamily: Fonts.mono },
  chartArea:   { flexDirection: 'row', alignItems: 'flex-end', height: 80 },
  barCol:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barVolText:  { fontSize: 11, fontFamily: Fonts.mono, marginBottom: 4, textAlign: 'center' },
  bar:         { width: '68%', borderRadius: 4, minHeight: 2 },
  weekLabels:  { flexDirection: 'row', marginTop: 8 },
  weekLabel:   { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  // ── Streak ──
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  streakDayCol: {
    alignItems: 'center',
    gap: 6,
  },
  streakDayLabel: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.t3,
  },
  streakDayLabelToday: {
    color: Colors.t1,
  },
  streakCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.s3,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCircleActive: {
    backgroundColor: Colors.crLo,
    borderColor: Colors.crBdr,
  },
  streakCircleToday: {
    borderColor: Colors.t3,
  },
  streakCircleFuture: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    opacity: 0.3,
  },
  streakDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.t3,
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  streakStat: { alignItems: 'center' },
  streakStatVal: {
    fontSize: 22,
    fontFamily: Fonts.monoBold,
    color: Colors.cr,
    lineHeight: 26,
  },
  streakStatLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    color: Colors.t3,
    textTransform: 'uppercase',
  },
  streakDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.line,
  },

  // ── Level & XP ──
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeNum: {
    fontSize: 24,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
    lineHeight: 28,
  },
  totalXp: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginTop: 8,
  },

  // ── Personal Records ──
  sectionOuter: {
    marginBottom: Spacing.md,
  },
  sectionOuterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  prCountBadge: {
    fontSize: 12,
    fontFamily: Fonts.monoBold,
    color: Colors.cr,
  },
  prScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  prCard: {
    width: 130,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 12,
    justifyContent: 'space-between',
  },
  prCardMore: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    backgroundColor: Colors.s3,
  },
  prMuscle: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    color: Colors.t3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  prName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
    marginBottom: 8,
  },
  prWeight: {
    fontSize: 22,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    lineHeight: 26,
  },
  prUnit: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: Colors.t3,
  },
  prDate: {
    fontSize: 10,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginTop: 4,
  },
  prMoreText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.t3,
    textAlign: 'center',
  },

  // ── Achievements ──
  achBadge: {
    fontSize: 12,
    fontFamily: Fonts.monoBold,
    color: Colors.cr,
  },
  achScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  achItem: {
    alignItems: 'center',
    width: 60,
    gap: 6,
  },
  achBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achLabel: {
    fontSize: 9,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    textAlign: 'center',
    lineHeight: 12,
  },

  // Achievements empty state
  achEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  achEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.s3,
    borderColor: Colors.line,
  },
  achEmptyTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
    marginBottom: 3,
  },
  achEmptyText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    lineHeight: 15,
  },

  // PR NEW badge + glow
  prCardNew: {
    borderColor: Colors.crBdr,
    backgroundColor: Colors.crLo,
    shadowColor: Colors.cr,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  prNewBadge: {
    position: 'absolute',
    top: 8, right: 8,
    backgroundColor: Colors.cr,
    borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  prNewBadgeText: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 0.8, color: Colors.bone,
  },

  // Streak rule hint
  streakHint: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 16,
  },

  // XP info — toggle button + expandable panel
  xpInfoBtn: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.line,
    backgroundColor: Colors.s3,
    alignItems: 'center', justifyContent: 'center',
  },
  xpInfoBtnText: {
    fontSize: 12, fontFamily: Fonts.bold, color: Colors.t2, lineHeight: 14,
  },
  xpInfoPanel: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    gap: 4,
  },
  xpInfoTitle: {
    fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2,
    color: Colors.t3, textTransform: 'uppercase', marginBottom: 6,
  },
  xpInfoLine: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 18,
  },
  xpInfoBold: {
    fontFamily: Fonts.monoBold, color: Colors.bone,
  },
});
