// mobile/app/workout/[id].tsx
import { useEffect, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Path, Polyline, Line, Rect } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import {
  workoutApi,
  type WorkoutResponse,
  type WorkoutExerciseResponse,
  type SetEntry,
} from '../../services/workoutApi';
import React from 'react';

// ─── Icons ────────────────────────────────────────────────────────
function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6"/>
    </Svg>
  );
}
function IClock() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 6v6l4 2"/>
    </Svg>
  );
}
function IDumbbell() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/>
      <Line x1="4" y1="9" x2="7.5" y2="9"/>
      <Line x1="4" y1="15" x2="7.5" y2="15"/>
      <Line x1="16.5" y1="9" x2="20" y2="9"/>
      <Line x1="16.5" y1="15" x2="20" y2="15"/>
      <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
    </Svg>
  );
}
function IFlame() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2c.5 3.5-1.5 6-1.5 6s2 1.5 2 4c0 2.5-2 4-4 4s-3-1.5-3-3.5c0-2 1.5-3.5 1.5-3.5s-1 2 1 3c.5-1 .5-2 0-3-.5-1.5-1-3 0-5C9 2 11 1 12 2z"/>
    </Svg>
  );
}
function ITrophy() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="#A89060" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <Path d="M4 22h16"/>
      <Path d="M10 22V18a2 2 0 0 1-2-2V4h8v12a2 2 0 0 1-2 2v4"/>
    </Svg>
  );
}
function ICheck() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke={Colors.up} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}
function IZap() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(vol)}`;
}

/** Get effective set data — use sets_data if available, otherwise build from legacy flat fields */
function getEffectiveSets(ex: WorkoutExerciseResponse): SetEntry[] {
  if (ex.sets_data && ex.sets_data.length > 0) return ex.sets_data;
  return Array.from({ length: ex.sets }, (_, i) => ({
    set_number: i + 1,
    reps: ex.reps,
    weight_kg: ex.weight_kg,
  }));
}

/** Compute unique muscle groups with volume share */
function getMuscleBreakdown(exercises: WorkoutExerciseResponse[]): { muscle: string; volume: number; pct: number }[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const ex of exercises) {
    const vol = ex.total_volume;
    total += vol;
    map.set(ex.muscle_group, (map.get(ex.muscle_group) ?? 0) + vol);
  }
  return Array.from(map.entries())
    .map(([muscle, volume]) => ({ muscle, volume, pct: total > 0 ? volume / total : 0 }))
    .sort((a, b) => b.volume - a.volume);
}

// ─── Skeleton ─────────────────────────────────────────────────────
function Skeleton({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  return (
    <Animated.View
      style={[{ width, height, borderRadius: Radius.sm, backgroundColor: Colors.s3 }, style, { opacity }]}
    />
  );
}

function SkeletonScreen() {
  return (
    <ScrollView contentContainerStyle={skS.wrap} showsVerticalScrollIndicator={false}>
      <Skeleton width="55%" height={22} style={{ marginBottom: 20 }} />
      <Skeleton width="40%" height={11} style={{ marginBottom: 10 }} />
      {[1, 2, 3].map(i => (
        <View key={i} style={skS.exRow}>
          <Skeleton width={44} height={44} style={{ borderRadius: Radius.md }} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
      <Skeleton width="40%" height={11} style={{ marginTop: 24, marginBottom: 10 }} />
      <View style={skS.grid}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width="47%" height={72} style={{ borderRadius: Radius.md }} />
        ))}
      </View>
    </ScrollView>
  );
}

const skS = StyleSheet.create({
  wrap:  { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 40 },
  exRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ─── Muscle distribution bar ──────────────────────────────────────
const MUSCLE_COLORS: Record<string, string> = {
  chest:     Colors.cr,
  back:      '#4A7FC1',
  legs:      Colors.up,
  shoulders: '#A89060',
  arms:      '#7C5BB5',
  core:      '#B87C3A',
  cardio:    Colors.flat,
};

function MuscleBar({ breakdown }: { breakdown: ReturnType<typeof getMuscleBreakdown> }) {
  if (breakdown.length === 0) return null;
  return (
    <View style={s.muscleBarWrap}>
      <Text style={s.sectionLabel}>MUSCLE DISTRIBUTION</Text>
      <View style={s.muscleBar}>
        {breakdown.map((m, i) => (
          <View
            key={m.muscle}
            style={{
              flex: m.pct,
              height: 6,
              backgroundColor: MUSCLE_COLORS[m.muscle.toLowerCase()] ?? Colors.t3,
              borderTopLeftRadius: i === 0 ? 3 : 0,
              borderBottomLeftRadius: i === 0 ? 3 : 0,
              borderTopRightRadius: i === breakdown.length - 1 ? 3 : 0,
              borderBottomRightRadius: i === breakdown.length - 1 ? 3 : 0,
            }}
          />
        ))}
      </View>
      <View style={s.muscleLegend}>
        {breakdown.map(m => (
          <View key={m.muscle} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: MUSCLE_COLORS[m.muscle.toLowerCase()] ?? Colors.t3 }]} />
            <Text style={s.legendTxt}>
              {m.muscle} {Math.round(m.pct * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Per-set volume mini chart (horizontal bars) ──────────────────
function SetVolumeChart({ sets }: { sets: SetEntry[] }) {
  const maxVol = Math.max(...sets.map(s => s.reps * s.weight_kg), 1);
  return (
    <View style={s.setChart}>
      {sets.map((set, i) => {
        const vol = set.reps * set.weight_kg;
        const pct = maxVol > 0 ? (vol / maxVol) * 100 : 0;
        return (
          <View key={i} style={s.setChartRow}>
            <Text style={s.setChartLabel}>S{set.set_number}</Text>
            <View style={s.setChartBarBg}>
              <View style={[s.setChartBarFill, { width: `${Math.max(pct, 4)}%` }]} />
            </View>
            <Text style={s.setChartVal}>{vol > 0 ? `${vol}` : '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Exercise card (expanded with per-set data) ───────────────────
function ExerciseDetailCard({ ex, index }: { ex: WorkoutExerciseResponse; index: number }) {
  const sets = getEffectiveSets(ex);
  const hasDifferentSets = sets.length > 1 && (
    new Set(sets.map(s => `${s.weight_kg}-${s.reps}`)).size > 1
  );

  return (
    <View style={s.exCard}>
      {/* Header */}
      <View style={s.exCardHead}>
        <View style={s.exNumBadge}>
          <Text style={s.exNum}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.exName}>{ex.exercise_name}</Text>
          <Text style={s.exMuscle}>{ex.muscle_group}</Text>
        </View>
        <View style={s.exVolBadge}>
          <Text style={s.exVolVal}>{formatVolume(ex.total_volume)}</Text>
          <Text style={s.exVolUnit}>kg</Text>
        </View>
      </View>

      {/* Per-set table */}
      <View style={s.setTable}>
        <View style={s.setTableHead}>
          <Text style={[s.setColHdr, { width: 36 }]}>SET</Text>
          <Text style={[s.setColHdr, { flex: 1 }]}>WEIGHT</Text>
          <Text style={[s.setColHdr, { flex: 1 }]}>REPS</Text>
          <Text style={[s.setColHdr, { width: 56 }]}>VOL</Text>
        </View>
        {sets.map((set, i) => {
          const vol = set.reps * set.weight_kg;
          return (
            <View key={i} style={[s.setTableRow, i % 2 === 0 && s.setTableRowAlt]}>
              <View style={[s.setNumCircle, { width: 36 }]}>
                <View style={s.setNumDot}>
                  <Text style={s.setNumTxt}>{set.set_number}</Text>
                </View>
              </View>
              <Text style={[s.setVal, { flex: 1 }]}>{set.weight_kg} kg</Text>
              <Text style={[s.setVal, { flex: 1 }]}>×{set.reps}</Text>
              <Text style={[s.setValVol, { width: 56 }]}>{vol > 0 ? `${vol}` : '—'}</Text>
            </View>
          );
        })}
      </View>

      {/* Mini volume chart if sets differ */}
      {hasDifferentSets && <SetVolumeChart sets={sets} />}
    </View>
  );
}

// ─── Stat card with icon ──────────────────────────────────────────
function StatCard({ icon, label, value, unit, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <View style={[s.statCard, accent && s.statCardAccent]}>
      <View style={[s.statIconBox, accent && s.statIconBoxAccent]}>{icon}</View>
      <Text style={[s.statCardVal, accent && s.statCardValAccent]}>
        {value}
        {unit ? <Text style={s.statCardUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.statCardLbl}>{label}</Text>
    </View>
  );
}

// ─── XP/Level badge ───────────────────────────────────────────────
function XpBadge({ xp, leveledUp, newLevel }: {
  xp: number | null;
  leveledUp: boolean;
  newLevel: number | null;
}) {
  if (!xp) return null;
  return (
    <View style={[s.xpBadge, leveledUp && s.xpBadgeLevelUp]}>
      <IZap />
      <Text style={s.xpBadgeVal}>+{xp} XP</Text>
      {leveledUp && newLevel != null && (
        <View style={s.levelUpChip}>
          <Text style={s.levelUpTxt}>LEVEL {newLevel}</Text>
        </View>
      )}
    </View>
  );
}

// ─── PR badges ────────────────────────────────────────────────────
function PrBadges({ prs }: { prs: WorkoutResponse['new_prs'] }) {
  if (!prs || prs.length === 0) return null;
  return (
    <View style={s.prSection}>
      <Text style={s.sectionLabel}>PERSONAL RECORDS</Text>
      {prs.map((pr, i) => (
        <View key={i} style={s.prCard}>
          <View style={s.prIconBox}><ITrophy /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.prName}>{pr.exercise_name}</Text>
            <Text style={s.prDelta}>
              {pr.prev_weight > 0 ? `${pr.prev_weight} → ` : ''}{pr.new_weight} kg
              {pr.delta > 0 ? ` (+${pr.delta})` : ''}
            </Text>
          </View>
          <View style={s.prBadge}>
            <Text style={s.prBadgeTxt}>PR</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function WorkoutDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const [workout,   setWorkout]   = useState<WorkoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await workoutApi.getById(id);
        setWorkout(data);
      } catch {
        setError('Could not load session. Try again.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const totalReps = workout?.exercises.reduce((sum, ex) => {
    const sets = getEffectiveSets(ex);
    return sum + sets.reduce((a, s) => a + s.reps, 0);
  }, 0) ?? 0;

  const totalSets = workout?.exercises.reduce((sum, ex) => {
    return sum + getEffectiveSets(ex).length;
  }, 0) ?? 0;

  const muscleBreakdown = workout ? getMuscleBreakdown(workout.exercises) : [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IBack/>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.lbl}>SESSION DETAILS</Text>
          <Text style={s.pageTitle} numberOfLines={1}>
            {workout ? formatDate(workout.workout_date) : '—'}
          </Text>
        </View>

        {workout?.duration_minutes != null ? (
          <View style={s.durationBadge}>
            <IClock/>
            <Text style={s.durationText}>{workout.duration_minutes} min</Text>
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {isLoading ? (
        <SkeletonScreen />
      ) : error || !workout ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error ?? 'Session not found.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── XP/Level banner ── */}
          <XpBadge
            xp={workout.xp_gained}
            leveledUp={workout.leveled_up}
            newLevel={workout.new_level}
          />

          {/* ── Summary stats grid ── */}
          <View style={s.statsGrid}>
            <StatCard
              icon={<IFlame />}
              label="Volume"
              value={formatVolume(workout.total_volume)}
              unit="kg"
              accent
            />
            <StatCard
              icon={<IDumbbell />}
              label="Total Sets"
              value={String(totalSets)}
            />
            <StatCard
              icon={<Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round">
                <Path d="M4 12h4l3-9 4 18 3-9h4"/>
              </Svg>}
              label="Total Reps"
              value={String(totalReps)}
            />
            <StatCard
              icon={<IClock />}
              label="Duration"
              value={workout.duration_minutes != null ? String(workout.duration_minutes) : '—'}
              unit={workout.duration_minutes != null ? 'min' : undefined}
            />
          </View>

          {/* ── Muscle distribution ── */}
          <MuscleBar breakdown={muscleBreakdown} />

          {/* ── PR badges ── */}
          <PrBadges prs={workout.new_prs} />

          {/* ── Exercises ── */}
          <Text style={[s.sectionLabel, { marginTop: 4 }]}>
            EXERCISES ({workout.exercises.length})
          </Text>
          {workout.exercises.map((ex, i) => (
            <ExerciseDetailCard key={ex.id} ex={ex} index={i} />
          ))}

          {/* ── Notes ── */}
          {workout.notes ? (
            <>
              <Text style={s.sectionLabel}>NOTES</Text>
              <View style={s.notesCard}>
                <Text style={s.notesText}>{workout.notes}</Text>
              </View>
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  lbl: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.8,
    color: Colors.t3, textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 17, fontFamily: Fonts.displayBold,
    color: Colors.t1, letterSpacing: -0.3,
  },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.s3, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.line,
    minWidth: 60, justifyContent: 'center',
  },
  durationText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: Spacing.lg },
  errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2, textAlign: 'center' },
  retryBtn:  { backgroundColor: Colors.s3, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: Colors.line },
  retryText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },

  // XP badge
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.crLo,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.crBdr,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, marginTop: 4,
  },
  xpBadgeLevelUp: {
    borderColor: Colors.cr,
    backgroundColor: Colors.crMid,
  },
  xpBadgeVal: {
    fontSize: 15, fontFamily: Fonts.monoBold, color: Colors.cr,
    flex: 1,
  },
  levelUpChip: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  levelUpTxt: {
    fontSize: 10, fontFamily: Fonts.bold,
    color: '#fff', letterSpacing: 1,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, marginBottom: 16,
  },
  statCard: {
    flex: 1, minWidth: '46%',
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: 14,
  },
  statCardAccent: {
    borderColor: Colors.crBdr,
    backgroundColor: Colors.crLo,
  },
  statIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.s4,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statIconBoxAccent: {
    backgroundColor: Colors.crMid,
  },
  statCardVal: {
    fontSize: 22, fontFamily: Fonts.monoBold,
    color: Colors.bone, marginBottom: 2,
  },
  statCardValAccent: { color: Colors.cr },
  statCardUnit: {
    fontSize: 13, fontFamily: Fonts.mono, color: Colors.t2,
  },
  statCardLbl: {
    fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2,
    color: Colors.t3, textTransform: 'uppercase',
  },

  // Section labels
  sectionLabel: {
    fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8,
    color: Colors.t3, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 8,
  },

  // Muscle distribution
  muscleBarWrap: { marginBottom: 16 },
  muscleBar: {
    flexDirection: 'row', height: 6,
    borderRadius: 3, overflow: 'hidden',
    backgroundColor: Colors.s4,
    marginBottom: 8,
  },
  muscleLegend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  legendDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  legendTxt: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t2,
    textTransform: 'capitalize',
  },

  // PR section
  prSection: { marginBottom: 16 },
  prCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(168,144,96,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.2)',
    padding: 12, marginBottom: 6,
  },
  prIconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(168,144,96,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  prName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1 },
  prDelta: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.flat, marginTop: 1 },
  prBadge: {
    backgroundColor: 'rgba(168,144,96,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.3)',
  },
  prBadgeTxt: {
    fontSize: 10, fontFamily: Fonts.bold, color: Colors.flat,
    letterSpacing: 1,
  },

  // Exercise detail card
  exCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    marginBottom: 10, overflow: 'hidden',
  },
  exCardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  exNumBadge: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.crLo,
    borderWidth: 1, borderColor: Colors.crBdr,
    alignItems: 'center', justifyContent: 'center',
  },
  exNum: {
    fontSize: 13, fontFamily: Fonts.monoBold, color: Colors.cr,
  },
  exName: {
    fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 1,
  },
  exMuscle: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textTransform: 'capitalize',
  },
  exVolBadge: {
    alignItems: 'flex-end',
  },
  exVolVal: {
    fontSize: 18, fontFamily: Fonts.monoBold, color: Colors.bone,
  },
  exVolUnit: {
    fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3,
  },

  // Set table
  setTable: {
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  setTableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.s3,
  },
  setColHdr: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1,
    color: Colors.t3, textTransform: 'uppercase', textAlign: 'center',
  },
  setTableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  setTableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  setNumCircle: {
    alignItems: 'center', justifyContent: 'center',
  },
  setNumDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.s4,
    alignItems: 'center', justifyContent: 'center',
  },
  setNumTxt: {
    fontSize: 11, fontFamily: Fonts.monoBold, color: Colors.t2,
  },
  setVal: {
    fontSize: 13, fontFamily: Fonts.mono, color: Colors.t1, textAlign: 'center',
  },
  setValVol: {
    fontSize: 12, fontFamily: Fonts.monoBold, color: Colors.t2, textAlign: 'center',
  },

  // Set volume chart
  setChart: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.line,
    gap: 4,
  },
  setChartRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  setChartLabel: {
    fontSize: 10, fontFamily: Fonts.monoBold, color: Colors.t3, width: 22,
  },
  setChartBarBg: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: Colors.s4, overflow: 'hidden',
  },
  setChartBarFill: {
    height: 6, borderRadius: 3, backgroundColor: Colors.cr,
  },
  setChartVal: {
    fontSize: 10, fontFamily: Fonts.mono, color: Colors.t2, width: 36, textAlign: 'right',
  },

  // Notes
  notesCard: {
    backgroundColor: Colors.s2, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: 14, marginBottom: 16,
  },
  notesText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20 },
});
