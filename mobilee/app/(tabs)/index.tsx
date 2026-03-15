// mobile/app/(tabs)/index.tsx
import { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ExerciseSearchModal, SetData } from '../../components/workout/ExerciseSearchModal';
import { LevelUpModal }          from '../../components/modals/LevelUpModal';
import { MissionCompleteModal }  from '../../components/modals/MissionCompleteModal';
import { SyncStatusIndicator }   from '../../components/SyncStatusIndicator';
import {
  useWorkoutStore,
  selectTotalReps,
  selectTotalVolume,
} from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
// ─── Icons ────────────────────────────────────────────────────────
function IPlus()     { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19"/><Line x1="5" y1="12" x2="19" y2="12"/></Svg>; }
function IFire()     { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
function IDumbbell() { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }
function ITrash()    { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6"/><Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><Path d="M10 11v6M14 11v6"/><Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>; }
function IHistory()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3v5h5"/><Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><Path d="M12 7v5l4 2"/></Svg>; }

// XP за тренировку (до подключения реального API)
const XP_PER_WORKOUT = 80;
const XP_PER_LEVEL   = 115;

export default function WorkoutScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const avatarTheme = AvatarThemes[user?.avatar_theme_id ?? 0];
  const initial = (user?.name ?? 'U')[0].toUpperCase();

  const {
    exercises,
    addExercise,
    removeExercise,
    submitWorkout,
    submitStatus,
    pendingCount,
  } = useWorkoutStore();

  const [showSearch, setShowSearch] = useState(false);

  // Modals
  const [levelUpVisible,  setLevelUpVisible]  = useState(false);
  const [newLevel,        setNewLevel]        = useState(1);
  const [missionVisible,  setMissionVisible]  = useState(false);

  const totalReps   = selectTotalReps(exercises);
  const totalVolume = selectTotalVolume(exercises);
  const missionPct  = Math.min(100, Math.round(totalReps / 350 * 100));
  const hasExercises = exercises.length > 0;

  function onExerciseAdd(data: SetData) {
    addExercise({
      exerciseId: data.exercise.id,
      name:       data.exercise.name,
      muscle:     data.exercise.muscle_group,
      sets:       data.sets,
      reps:       data.reps,
      weight:     data.weight,
    });
  }

  async function finishWorkout() {
    if (!hasExercises) return;
    const ok = await submitWorkout();
    if (ok) {
      // Простая симуляция level up (заменится на данные от API)
      const currentXp = XP_PER_WORKOUT;
      const prevLevel = Math.floor(0 / XP_PER_LEVEL) + 1;
      const nextLevel = Math.floor(currentXp / XP_PER_LEVEL) + 1;
      if (nextLevel > prevLevel) {
        setNewLevel(nextLevel);
        setLevelUpVisible(true);
      }
    }
  }

  const isLoading = submitStatus === 'loading';
  const isSuccess = submitStatus === 'success';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.lbl}>Today</Text>
            <Text style={s.pageTitle}>Workout Log</Text>
          </View>
          <View style={s.headerRight}>
            <SyncStatusIndicator pendingCount={pendingCount}/>
            <TouchableOpacity style={s.streakRow} onPress={() => router.push('/history')}>
              <IFire/>
              <Text style={s.streakNum}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.avatarBtn, { backgroundColor: avatarTheme.color }]}
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
            >
              <Text style={s.avatarInitial}>{initial}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Active mission ── */}
        <Card variant="crimson">
          <View style={s.mHead}>
            <View>
              <Text style={s.lblCr}>Active mission</Text>
              <Text style={s.mName}>Volume Crusher</Text>
            </View>
            <View style={s.badge}><Text style={s.badgeText}>HARD</Text></View>
          </View>
          <ProgressBar
            value={missionPct}
            color={Colors.cr}
            height={4}
            leftText={`${Math.min(350, totalReps)} / 350 reps`}
            rightText={`${missionPct}%`}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* ── Exercise list ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.lbl}>Exercises</Text>
            {hasExercises && <Text style={s.monoSm}>{totalReps} reps total</Text>}
          </View>

          {exercises.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🏋️</Text>
              <Text style={s.emptyTitle}>No exercises yet</Text>
              <Text style={s.emptySub}>Tap below to add your first exercise</Text>
            </View>
          ) : (
            exercises.map(ex => (
              <View key={ex.localId} style={s.exRow}>
                <View style={s.exIcon}><IDumbbell/></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{ex.name}</Text>
                  <Text style={s.exDetail}>
                    {ex.sets}×{ex.reps} @ {ex.weight}kg
                    <Text style={s.exVol}>  ·  {ex.sets * ex.reps * ex.weight} kg vol</Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeExercise(ex.localId)} style={s.trashBtn}>
                  <ITrash/>
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={s.addBtn}
            onPress={() => setShowSearch(true)}
            activeOpacity={0.7}
          >
            <IPlus/>
            <Text style={s.addBtnText}>
              {exercises.length === 0 ? 'Add exercise' : 'Add another exercise'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary ── */}
        {hasExercises && (
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{exercises.length}</Text>
              <Text style={s.summaryLbl}>Exercises</Text>
            </View>
            <View style={s.summaryDivider}/>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{totalReps}</Text>
              <Text style={s.summaryLbl}>Total reps</Text>
            </View>
            <View style={s.summaryDivider}/>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{totalVolume.toFixed(0)}</Text>
              <Text style={s.summaryLbl}>kg volume</Text>
            </View>
          </View>
        )}

        {/* ── History shortcut ── */}
        <TouchableOpacity style={s.historyLink} onPress={() => router.push('/history')} activeOpacity={0.7}>
          <IHistory/>
          <Text style={s.historyText}>View workout history</Text>
        </TouchableOpacity>

        {/* ── Finish ── */}
        <View style={{ paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: 32 }}>
          <Button
            label={isSuccess ? 'Session saved!' : isLoading ? 'Saving...' : 'Finish & log session'}
            onPress={finishWorkout}
            disabled={!hasExercises || isLoading}
          />
          {!hasExercises && (
            <Text style={s.hintText}>Add at least one exercise to log</Text>
          )}
        </View>

      </ScrollView>

      {/* ── Modals ── */}
      <ExerciseSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onAdd={onExerciseAdd}
      />

      <LevelUpModal
        visible={levelUpVisible}
        level={newLevel}
        xpGained={XP_PER_WORKOUT}
        onClose={() => setLevelUpVisible(false)}
      />

      <MissionCompleteModal
        visible={missionVisible}
        missionName="Volume Crusher"
        xpGained={150}
        coinsGained={30}
        onClose={() => setMissionVisible(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.xl },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  lbl:         { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle:   { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5 },
  streakRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  streakNum:   { fontSize: 20, fontFamily: Fonts.monoBold, color: Colors.bone },
  avatarBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  lblCr:  { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.cr, textTransform: 'uppercase', marginBottom: 3 },
  mHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mName:  { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  badge:  { backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.cr, letterSpacing: 0.8 },

  section:     { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monoSm:      { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon:  { fontSize: 32, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.t2, marginBottom: 4 },
  emptySub:   { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t3 },

  exRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 12, marginBottom: 7, borderWidth: 1, borderColor: Colors.line },
  exIcon:   { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.s4, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  exName:   { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  exDetail: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  exVol:    { color: Colors.t3 },
  trashBtn: { padding: 6 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.line, borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: 14, marginTop: 4 },
  addBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t2 },

  summary:        { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: 10, backgroundColor: Colors.s2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.line, padding: 16 },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryVal:     { fontSize: 20, fontFamily: Fonts.monoBold, color: Colors.bone, marginBottom: 3 },
  summaryLbl:     { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1, color: Colors.t3, textTransform: 'uppercase' },
  summaryDivider: { width: 1, backgroundColor: Colors.line, marginVertical: 4 },

  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', paddingVertical: 10, marginBottom: 4 },
  historyText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3 },

  hintText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', marginTop: 8 },
});
