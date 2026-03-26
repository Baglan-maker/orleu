// mobile/app/(tabs)/index.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes, getAvatarStage, type AvatarThemeId } from '../../constants/theme';
import { AvatarSVG }     from '../../components/avatar/AvatarSVG';
import { MomentumRing } from '../../components/avatar/MomentumRing';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ExerciseSearchModal, SetData } from '../../components/workout/ExerciseSearchModal';
import { LevelUpModal }          from '../../components/modals/LevelUpModal';
import { MissionCompleteModal }  from '../../components/modals/MissionCompleteModal';
import { StageUpModal }          from '../../components/modals/StageUpModal';
import { AchievementModal, type AchievementEarned } from '../../components/modals/AchievementModal';
import { PRModal, type PRResult } from '../../components/modals/PRModal';
import { SyncStatusIndicator }   from '../../components/SyncStatusIndicator';
import {
  useWorkoutStore,
  selectTotalReps,
  selectTotalVolume,
} from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
import { progressApi, missionApi, type UserMissionResponse } from '../../services/gamificationApi';
// ─── Icons ────────────────────────────────────────────────────────
function IPlus()     { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19"/><Line x1="5" y1="12" x2="19" y2="12"/></Svg>; }
function IFire()     { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
function IDumbbell() { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }
function ITrash()    { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6"/><Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><Path d="M10 11v6M14 11v6"/><Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>; }
function IHistory()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3v5h5"/><Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><Path d="M12 7v5l4 2"/></Svg>; }

const STAGE_NAMES  = ['Rookie', 'Active', 'Athlete', 'Champion', 'Legend'];
const STAGE_THRESH = [0, 6, 16, 31, 51];

function RippleEffect({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }).start();
  }, []);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.4] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] });
  return (
    <Animated.View style={{
      position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
      borderRadius: 999,
      borderWidth: 1.5, borderColor: color,
      opacity, transform: [{ scale }],
    }} />
  );
}

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

  const [showSearch,    setShowSearch]    = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);

  // Progress state — fetched from server on focus
  const [totalWorkouts,   setTotalWorkouts]   = useState(0);
  const [streak,          setStreak]          = useState(0);
  const [activeMissions,  setActiveMissions]  = useState<UserMissionResponse[]>([]);
  const [completedMission, setCompletedMission] = useState<UserMissionResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [progressRes, missionsRes] = await Promise.all([
            progressApi.get(),
            missionApi.getAll(),
          ]);
          if (!cancelled) {
            setTotalWorkouts(progressRes.data.total_sessions ?? 0);
            setStreak(progressRes.data.current_streak ?? 0);
            setActiveMissions(missionsRes.data.active);
          }
        } catch {}
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // Hero derived values
  const stage         = getAvatarStage(totalWorkouts);
  const stageNext     = Math.min(stage + 1, 4) as typeof stage;
  const stageProgress = stage < 4
    ? Math.round((totalWorkouts - STAGE_THRESH[stage]) / (STAGE_THRESH[stageNext] - STAGE_THRESH[stage]) * 100)
    : 100;
  const toNextStage  = stage < 4 ? STAGE_THRESH[stageNext] - totalWorkouts : 0;
  const momentum     = Math.min(100, (totalWorkouts % 7) * 14 + 40);
  const themeColor   = avatarTheme.color;

  // Modals
  const [levelUpVisible,       setLevelUpVisible]       = useState(false);
  const [newLevel,             setNewLevel]             = useState(1);
  const [xpGained,             setXpGained]             = useState(0);
  const [missionVisible,       setMissionVisible]       = useState(false);
  const [stageUpVisible,       setStageUpVisible]       = useState(false);
  const [newStage,             setNewStage]             = useState<typeof stage>(0);
  const [achModalVisible,      setAchModalVisible]      = useState(false);
  const [newAchievements,      setNewAchievements]      = useState<AchievementEarned[]>([]);
  const [pendingAchievements,  setPendingAchievements]  = useState<AchievementEarned[]>([]);
  const [prModalVisible,       setPrModalVisible]       = useState(false);
  const [newPRs,               setNewPRs]               = useState<PRResult[]>([]);

  const totalReps    = selectTotalReps(exercises);
  const totalVolume  = selectTotalVolume(exercises);
  const hasExercises = exercises.length > 0;

  // ── Mission display helpers ────────────────────────────────────
  const firstMission = activeMissions[0] ?? null;

  function sessionContrib(mission: UserMissionResponse): number {
    if (!hasExercises) return 0;
    switch (mission.type) {
      case 'workout_count':    return 1;
      case 'total_reps':       return totalReps;
      case 'total_volume':     return totalVolume;
      case 'unique_exercises': return new Set(exercises.map(e => e.exerciseId)).size;
      case 'muscle_sets':      return exercises.reduce((a, e) => a + e.sets, 0);
      default:                 return 0;
    }
  }

  function missionProgressLabel(mission: UserMissionResponse, progress: number): string {
    const v = Math.round(progress);
    const t = Math.round(mission.adjusted_target);
    switch (mission.type) {
      case 'total_reps':       return `${v} / ${t} reps`;
      case 'total_volume':     return `${v} / ${t} kg`;
      case 'workout_count':    return `${v} / ${t} workouts`;
      case 'unique_exercises': return `${v} / ${t} exercises`;
      case 'muscle_sets':      return `${v} / ${t} sets`;
      default:                 return `${v} / ${t}`;
    }
  }

  function missionTypeLabel(type: string): string {
    switch (type) {
      case 'total_reps':       return 'REPS';
      case 'total_volume':     return 'VOLUME';
      case 'workout_count':    return 'SESSIONS';
      case 'unique_exercises': return 'VARIETY';
      case 'muscle_sets':      return 'SETS';
      default:                 return 'MISSION';
    }
  }

  const missionLiveProgress = firstMission
    ? Math.min(firstMission.adjusted_target, firstMission.current_progress + sessionContrib(firstMission))
    : 0;
  const missionPct = firstMission
    ? Math.min(100, Math.round(missionLiveProgress / firstMission.adjusted_target * 100))
    : 0;

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
    const prevStage = stage;
    const missionsBefore = activeMissions;
    const result = await submitWorkout();
    if (result) {
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1000);

      // Show PR modal if new personal records were set
      const prs = result.new_prs ?? [];
      if (prs.length > 0) {
        setNewPRs(prs);
        setPrModalVisible(true);
      }

      // Capture new achievements from response
      const earned = result.achievements ?? [];
      if (earned.length > 0) {
        if (result.leveled_up) {
          setPendingAchievements(earned);
        } else {
          setNewAchievements(earned);
          setAchModalVisible(true);
        }
      }

      if (result.leveled_up && result.new_level != null) {
        setXpGained(result.xp_gained ?? 0);
        setNewLevel(result.new_level);
        setLevelUpVisible(true);
      }

      // Refresh progress + missions together
      try {
        const [progressRes, missionsRes] = await Promise.all([
          progressApi.get(),
          missionApi.getAll(),
        ]);
        const sessions = progressRes.data.total_sessions ?? 0;
        setTotalWorkouts(sessions);
        setStreak(progressRes.data.current_streak ?? 0);
        const next = getAvatarStage(sessions);
        if (next > prevStage) {
          setNewStage(next);
          setStageUpVisible(true);
        }

        // Detect newly completed missions: present in completed list but weren't before
        const beforeActiveIds = new Set(missionsBefore.map(m => m.id));
        const justCompleted = (missionsRes.data.completed ?? []).filter(
          m => beforeActiveIds.has(m.id)
        );
        setActiveMissions(missionsRes.data.active);
        if (justCompleted.length > 0) {
          setCompletedMission(justCompleted[0]);
          setMissionVisible(true);
        }
      } catch {}
    }
  }

  const isLoading = submitStatus === 'loading';
  const isSuccess = submitStatus === 'success';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} pointerEvents={isLoading ? 'none' : 'auto'}>

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
              <Text style={s.streakNum}>{streak}</Text>
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

        {/* ── Hero ── */}
        <View style={s.heroSection}>
          <View style={s.ringContainer}>
            <MomentumRing pct={momentum} color={themeColor} size={120} />
            <View style={s.avatarInRing}>
              <AvatarSVG
                themeId={(user?.avatar_theme_id ?? 0) as AvatarThemeId}
                stage={stage}
                size={80}
                celebrating={isCelebrating}
              />
            </View>
            {isCelebrating && <RippleEffect color={themeColor} />}
          </View>

          <Text style={s.heroStageName}>{STAGE_NAMES[stage]}</Text>
          <Text style={s.heroSessionCount}>
            {totalWorkouts} sessions{toNextStage > 0 ? ` · ${toNextStage} to next stage` : ' · Max stage!'}
          </Text>
          <View style={s.heroBarWrap}>
            <ProgressBar value={stageProgress} color={themeColor} height={3} />
          </View>
        </View>

        {/* ── Active mission ── */}
        <Card variant="crimson">
          {firstMission ? (
            <>
              <View style={s.mHead}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.lblCr}>Active mission</Text>
                  <Text style={s.mName} numberOfLines={1}>{firstMission.name}</Text>
                </View>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{missionTypeLabel(firstMission.type)}</Text>
                </View>
              </View>
              <ProgressBar
                value={missionPct}
                color={Colors.cr}
                height={4}
                leftText={missionProgressLabel(firstMission, missionLiveProgress)}
                rightText={`${missionPct}%`}
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <View style={s.mHead}>
              <View>
                <Text style={s.lblCr}>Active mission</Text>
                <Text style={s.mName}>No active mission</Text>
              </View>
              <Text style={s.mSub}>Pick one on Missions tab</Text>
            </View>
          )}
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
            disabled={!hasExercises || isLoading || isSuccess}
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
        xpGained={xpGained}
        onClose={() => {
          setLevelUpVisible(false);
          // Show queued achievements after level-up modal closes
          if (pendingAchievements.length > 0) {
            setNewAchievements(pendingAchievements);
            setPendingAchievements([]);
            setTimeout(() => setAchModalVisible(true), 300);
          }
        }}
      />

      <MissionCompleteModal
        visible={missionVisible}
        missionName={completedMission?.name ?? ''}
        xpGained={completedMission?.xp_reward ?? 0}
        coinsGained={completedMission?.coins_reward ?? 0}
        onClose={() => { setMissionVisible(false); setCompletedMission(null); }}
      />

      <StageUpModal
        visible={stageUpVisible}
        stage={newStage}
        themeId={(user?.avatar_theme_id ?? 0) as AvatarThemeId}
        onClose={() => setStageUpVisible(false)}
      />

      <AchievementModal
        achievements={newAchievements}
        visible={achModalVisible}
        onClose={() => {
          setAchModalVisible(false);
          setNewAchievements([]);
        }}
      />

      <PRModal
        prs={newPRs}
        visible={prModalVisible}
        onClose={() => { setPrModalVisible(false); setNewPRs([]); }}
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
  mSub:   { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, alignSelf: 'center' },
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

  heroSection:     { alignItems: 'center', paddingBottom: 18 },
  ringContainer:   { position: 'relative', width: 120, height: 120 },
  avatarInRing:    { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -40 }, { translateY: -44 }] },
  heroStageName:   { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1, marginTop: 12, letterSpacing: 0.3 },
  heroSessionCount:{ fontSize: 12, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 3 },
  heroBarWrap:     { width: '48%', marginTop: 10 },

  hintText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', marginTop: 8 },
});
