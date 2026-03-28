// mobile/app/(tabs)/index.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Line, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes, getAvatarStage, type AvatarThemeId } from '../../constants/theme';
import { AvatarSVG }     from '../../components/avatar/AvatarSVG';
import { MomentumRing } from '../../components/avatar/MomentumRing';
import { Card }        from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { WorkoutLogScreen }          from '../../components/workout/WorkoutLogScreen';
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
function IFire()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
function IHistory() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3v5h5"/><Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><Path d="M12 7v5l4 2"/></Svg>; }
function IPlay()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill={Colors.bone} stroke="none"><Path d="M5 3l14 9-14 9V3z"/></Svg>; }

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
    submitWorkout,
    submitStatus,
    pendingCount,
  } = useWorkoutStore();

  const [showWorkoutLog, setShowWorkoutLog] = useState(false);
  const [isCelebrating,  setIsCelebrating]  = useState(false);

  // Progress state — fetched from server on focus
  const [totalWorkouts,    setTotalWorkouts]    = useState(0);
  const [streak,           setStreak]           = useState(0);
  const [activeMissions,   setActiveMissions]   = useState<UserMissionResponse[]>([]);
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
  const toNextStage = stage < 4 ? STAGE_THRESH[stageNext] - totalWorkouts : 0;
  const momentum    = Math.min(100, (totalWorkouts % 7) * 14 + 40);
  const themeColor  = avatarTheme.color;

  // Modals
  const [levelUpVisible,      setLevelUpVisible]      = useState(false);
  const [newLevel,            setNewLevel]            = useState(1);
  const [xpGained,            setXpGained]            = useState(0);
  const [missionVisible,      setMissionVisible]      = useState(false);
  const [stageUpVisible,      setStageUpVisible]      = useState(false);
  const [newStage,            setNewStage]            = useState<typeof stage>(0);
  const [achModalVisible,     setAchModalVisible]     = useState(false);
  const [newAchievements,     setNewAchievements]     = useState<AchievementEarned[]>([]);
  const [pendingAchievements, setPendingAchievements] = useState<AchievementEarned[]>([]);
  const [prModalVisible,      setPrModalVisible]      = useState(false);
  const [newPRs,              setNewPRs]              = useState<PRResult[]>([]);
  const [pendingPRs,          setPendingPRs]          = useState<PRResult[]>([]);

  const totalReps   = selectTotalReps(exercises);
  const totalVolume = selectTotalVolume(exercises);
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
      case 'muscle_sets':      return exercises.reduce((a, e) => a + e.setsData.length, 0);
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

  async function finishWorkout() {
    if (!hasExercises) return;
    const prevStage      = stage;
    const missionsBefore = activeMissions;
    const result         = await submitWorkout();
    if (result) {
      setShowWorkoutLog(false);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1000);

      const earned = result.achievements ?? [];
      const prs    = result.new_prs ?? [];

      if (earned.length > 0) {
        if (result.leveled_up) {
          setPendingAchievements(earned);
          if (prs.length > 0) setPendingPRs(prs);
        } else {
          setNewAchievements(earned);
          if (prs.length > 0) setPendingPRs(prs);
          setAchModalVisible(true);
        }
      } else if (prs.length > 0) {
        setNewPRs(prs);
        setPrModalVisible(true);
      }

      if (result.leveled_up && result.new_level != null) {
        setXpGained(result.xp_gained ?? 0);
        setNewLevel(result.new_level);
        setLevelUpVisible(true);
      }

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
        const beforeActiveIds = new Set(missionsBefore.map(m => m.id));
        const justCompleted   = (missionsRes.data.completed ?? []).filter(
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

        {/* ── In-progress summary (if session open) ── */}
        {hasExercises && (
          <TouchableOpacity
            style={s.inProgressBanner}
            onPress={() => setShowWorkoutLog(true)}
            activeOpacity={0.8}
          >
            <View style={s.inProgressDot}/>
            <View style={{ flex: 1 }}>
              <Text style={s.inProgressTitle}>Workout in progress</Text>
              <Text style={s.inProgressSub}>
                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {totalReps} reps · {totalVolume.toFixed(0)} kg
              </Text>
            </View>
            <Text style={s.inProgressResume}>Resume →</Text>
          </TouchableOpacity>
        )}

        {/* ── Start / Continue workout CTA ── */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            style={s.startBtn}
            onPress={() => setShowWorkoutLog(true)}
            activeOpacity={0.8}
          >
            <View style={s.startBtnIcon}><IPlay/></View>
            <Text style={s.startBtnText}>
              {hasExercises ? 'Continue workout' : 'Start workout'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── History shortcut ── */}
        <TouchableOpacity style={s.historyLink} onPress={() => router.push('/history')} activeOpacity={0.7}>
          <IHistory/>
          <Text style={s.historyText}>View workout history</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Workout log full-screen ── */}
      <WorkoutLogScreen
        visible={showWorkoutLog}
        onClose={() => setShowWorkoutLog(false)}
        onFinish={finishWorkout}
        submitStatus={submitStatus}
      />

      {/* ── Post-workout modals ── */}
      <LevelUpModal
        visible={levelUpVisible}
        level={newLevel}
        xpGained={xpGained}
        onClose={() => {
          setLevelUpVisible(false);
          if (pendingAchievements.length > 0) {
            setNewAchievements(pendingAchievements);
            setPendingAchievements([]);
            setTimeout(() => setAchModalVisible(true), 300);
          } else if (pendingPRs.length > 0) {
            setNewPRs(pendingPRs);
            setPendingPRs([]);
            setTimeout(() => setPrModalVisible(true), 300);
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
          if (pendingPRs.length > 0) {
            setNewPRs(pendingPRs);
            setPendingPRs([]);
            setTimeout(() => setPrModalVisible(true), 300);
          }
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
  scroll: { paddingTop: Spacing.xl, paddingBottom: 40 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  lbl:         { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle:   { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5 },
  streakRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  streakNum:   { fontSize: 20, fontFamily: Fonts.monoBold, color: Colors.bone },
  avatarBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  lblCr:     { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.cr, textTransform: 'uppercase', marginBottom: 3 },
  mHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mName:     { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  mSub:      { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, alignSelf: 'center' },
  badge:     { backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.cr, letterSpacing: 0.8 },

  inProgressBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    marginHorizontal: Spacing.lg,
    marginTop:       12,
    backgroundColor: Colors.s2,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.crBdr,
    padding:         14,
    gap:             12,
  },
  inProgressDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cr },
  inProgressTitle:  { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  inProgressSub:    { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  inProgressResume: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.cr },

  ctaWrap: { paddingHorizontal: Spacing.lg, marginTop: 16, marginBottom: 4 },
  startBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: Colors.cr,
    borderRadius:    Radius.lg,
    paddingVertical: 16,
  },
  startBtnIcon: {
    width:  28, height: 28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  startBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.bone },

  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', paddingVertical: 12, marginTop: 8 },
  historyText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3 },

  heroSection:      { alignItems: 'center', paddingBottom: 18 },
  ringContainer:    { position: 'relative', width: 120, height: 120 },
  avatarInRing:     { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -40 }, { translateY: -44 }] },
  heroStageName:    { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1, marginTop: 12, letterSpacing: 0.3 },
  heroSessionCount: { fontSize: 12, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 3 },
  heroBarWrap:      { width: '48%', marginTop: 10 },
});
