// mobile/app/workout/[id].tsx
import { useEffect, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Polyline, Line } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { workoutApi, type WorkoutResponse, type WorkoutExerciseResponse } from '../../services/workoutApi';

// ─── Icons ────────────────────────────────────────────────────────
function IBack()    { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="15 18 9 12 15 6"/></Svg>; }
function IClock()   { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><Polyline points="12 6 12 12 16 14"/></Svg>; }
function IDumbbell(){ return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1).replace(/\.0$/, '')}k kg`;
  return `${Math.round(vol).toLocaleString()} kg`;
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
    <ScrollView contentContainerStyle={sk.wrap} showsVerticalScrollIndicator={false}>
      <Skeleton width="55%" height={22} style={{ marginBottom: 20 }} />

      <Skeleton width="40%" height={11} style={{ marginBottom: 10 }} />
      {[1, 2, 3].map(i => (
        <View key={i} style={sk.exRow}>
          <Skeleton width={44} height={44} style={{ borderRadius: Radius.md }} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}

      <Skeleton width="40%" height={11} style={{ marginTop: 24, marginBottom: 10 }} />
      <View style={sk.grid}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width="47%" height={72} style={{ borderRadius: Radius.md }} />
        ))}
      </View>
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  wrap:  { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 40 },
  exRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ─── Exercise row ─────────────────────────────────────────────────
function ExerciseRow({ ex }: { ex: WorkoutExerciseResponse }) {
  const vol = ex.sets * ex.reps * ex.weight_kg;
  return (
    <View style={s.exRow}>
      <View style={s.exIcon}><IDumbbell/></View>
      <View style={{ flex: 1 }}>
        <Text style={s.exName}>{ex.exercise_name}</Text>
        <Text style={s.exMuscle}>{ex.muscle_group}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.exSets}>{ex.sets} × {ex.reps} @ {ex.weight_kg} kg</Text>
        <Text style={s.exVol}>{formatVolume(vol)}</Text>
      </View>
    </View>
  );
}

// ─── Stat box ─────────────────────────────────────────────────────
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
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

  const totalReps = workout?.exercises.reduce((s, e) => s + e.sets * e.reps, 0) ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IBack/>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.lbl}>Session</Text>
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

          {/* ── Exercises ── */}
          <Text style={s.sectionLabel}>Exercises</Text>
          <View style={s.section}>
            {workout.exercises.map(ex => (
              <ExerciseRow key={ex.id} ex={ex} />
            ))}
          </View>

          {/* ── Summary ── */}
          <Text style={s.sectionLabel}>Session Summary</Text>
          <View style={s.grid}>
            <StatBox label="Total Volume"    value={formatVolume(workout.total_volume)} />
            <StatBox label="Total Reps"      value={totalReps.toString()} />
            <StatBox label="Exercises"       value={workout.exercises.length.toString()} />
            <StatBox label="Duration"
              value={workout.duration_minutes != null ? `${workout.duration_minutes} min` : '—'} />
          </View>

          {/* ── Notes ── */}
          {workout.notes ? (
            <>
              <Text style={s.sectionLabel}>Notes</Text>
              <View style={s.notesCard}>
                <Text style={s.notesText}>{workout.notes}</Text>
              </View>
            </>
          ) : null}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase' },
  pageTitle: { fontSize: 18, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.3 },
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

  sectionLabel: {
    fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8,
    color: Colors.t3, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  section: { marginBottom: 24 },

  exRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.s2, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.line },
  exIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  exName:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  exMuscle:{ fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textTransform: 'capitalize' },
  exSets:  { fontSize: 12, fontFamily: Fonts.mono, color: Colors.t2 },
  exVol:   { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 2 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24,
  },
  statBox: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.s2, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: 16, alignItems: 'center',
  },
  statVal: { fontSize: 24, fontFamily: Fonts.monoBold, color: Colors.bone, marginBottom: 4 },
  statLbl: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Colors.t3, textTransform: 'uppercase' },

  notesCard: {
    backgroundColor: Colors.s2, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: 14, marginBottom: 24,
  },
  notesText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20 },
});
