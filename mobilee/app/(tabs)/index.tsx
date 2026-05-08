// mobile/app/(tabs)/index.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated, Dimensions, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Line, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, AvatarThemes, stageFromLevel, getCharacterImage, xpForLevel, type AvatarThemeId, type AvatarStage } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { WorkoutLogScreen }          from '../../components/workout/WorkoutLogScreen';
import { LevelUpModal }          from '../../components/modals/LevelUpModal';
import { MissionCompleteModal }  from '../../components/modals/MissionCompleteModal';
import { ChapterCompleteModal }  from '../../components/modals/ChapterCompleteModal';
import { StageUpModal }          from '../../components/modals/StageUpModal';
import { CharacterInfoModal }    from '../../components/modals/CharacterInfoModal';
import { AchievementModal, type AchievementEarned } from '../../components/modals/AchievementModal';
import { PRModal, type PRResult } from '../../components/modals/PRModal';
import { XpToast }               from '../../components/ui/XpToast';
import { SyncStatusIndicator }   from '../../components/SyncStatusIndicator';
import {
  useWorkoutStore,
  selectTotalReps,
  selectTotalVolume,
} from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
import { progressApi, missionApi, coachApi, type UserMissionResponse, type CoachMessageResponse, type CoachTone } from '../../services/gamificationApi';

// ─── Icons ────────────────────────────────────────────────────────
function IFire()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
function IHistory() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3v5h5"/><Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><Path d="M12 7v5l4 2"/></Svg>; }
function IPlay()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill={Colors.bone} stroke="none"><Path d="M5 3l14 9-14 9V3z"/></Svg>; }
function IInfo()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><Path d="M12 8h.01M12 12v4"/></Svg>; }

const SCREEN_H = Dimensions.get('window').height;
const fmtXP    = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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

  // Progress state — fetched from server on focus
  const [streak,        setStreak]        = useState(0);
  const [xp,            setXp]            = useState(0);
  const [level,         setLevel]         = useState(1);
  const [activeMissions,   setActiveMissions]   = useState<UserMissionResponse[]>([]);
  const [completedMission, setCompletedMission] = useState<UserMissionResponse | null>(null);
  const [coachMsg,         setCoachMsg]         = useState<CoachMessageResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [progressRes, missionsRes, coachRes] = await Promise.all([
            progressApi.get(),
            missionApi.getAll(),
            coachApi.getMessages(5).catch(() => null),
          ]);
          if (!cancelled) {
            const d = progressRes.data;
            setStreak(d.current_streak ?? 0);
            setXp(d.xp ?? 0);
            setLevel(d.level ?? 1);
            setActiveMissions(missionsRes.data.active);
            const firstUnread = coachRes?.data?.find(m => !m.is_read) ?? null;
            setCoachMsg(firstUnread);
          }
        } catch {}
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // Character
  const characterId = user?.avatar_theme_id ?? 0;

  // Info modal
  const [infoVisible, setInfoVisible] = useState(false);

  // Stage = level - 1 (level 1 → Rookie, level 5 → Legend)
  const stage      = stageFromLevel(level);
  const isMaxLevel = level >= 5;

  // XP within current level
  let xpUsed = 0;
  for (let l = 1; l < level; l++) xpUsed += xpForLevel(l);
  const xpInLevel = isMaxLevel ? 0 : Math.max(0, xp - xpUsed);
  const xpNext    = xpForLevel(level); // 0 when max level
  const xpPct     = isMaxLevel ? 100 : (xpNext > 0 ? Math.min(100, Math.round(xpInLevel / xpNext * 100)) : 100);


  // ── Post-workout celebration queue ────────────────────────────
  // One modal shows at a time; dismissal advances the queue. Order:
  // levelUp → achievement → pr → chapter. No setTimeout chains.
  type ChapterReward = {
    chapter_number: number; xp: number; coins: number; campaign_complete: boolean;
  };
  type Celebration =
    | { kind: 'levelUp';     level: number; xpGained: number }
    | { kind: 'achievement'; achievements: AchievementEarned[] }
    | { kind: 'pr';          prs: PRResult[] }
    | { kind: 'chapter';     reward: ChapterReward };

  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([]);
  const activeCelebration = celebrationQueue[0] ?? null;
  const dismissCelebration = useCallback(() => {
    setCelebrationQueue(q => q.slice(1));
  }, []);

  // Other (non-sequenced) modals
  const [missionVisible, setMissionVisible] = useState(false);
  const [stageUpVisible, setStageUpVisible] = useState(false);
  const [newStage,       setNewStage]       = useState<typeof stage>(0);
  const [xpToastVisible, setXpToastVisible] = useState(false);
  const [xpToastAmount,  setXpToastAmount]  = useState(0);

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
      const earned = result.achievements ?? [];
      const prs    = result.new_prs ?? [];
      const chapter = result.chapter_completed ?? null;

      const queue: Celebration[] = [];
      if (result.leveled_up && result.new_level != null) {
        queue.push({ kind: 'levelUp', level: result.new_level, xpGained: result.xp_gained ?? 0 });
      }
      if (earned.length > 0) {
        queue.push({ kind: 'achievement', achievements: earned });
      }
      if (prs.length > 0) {
        queue.push({ kind: 'pr', prs });
      }
      if (chapter) {
        queue.push({ kind: 'chapter', reward: chapter });
      }

      if (queue.length > 0) {
        setCelebrationQueue(queue);
      } else if ((result.xp_gained ?? 0) > 0) {
        // No celebration modals at all → show the lightweight XP toast
        setXpToastAmount(result.xp_gained ?? 0);
        setXpToastVisible(true);
      }

      try {
        const [progressRes, missionsRes] = await Promise.all([
          progressApi.get(),
          missionApi.getAll(),
        ]);
        const d2       = progressRes.data;
        const nextLevel = d2.level ?? 1;
        setStreak(d2.current_streak ?? 0);
        setXp(d2.xp ?? 0);
        setLevel(nextLevel);
        const nextStage = stageFromLevel(nextLevel);
        if (nextStage > prevStage) {
          setNewStage(nextStage);
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
          <Image
            source={getCharacterImage(characterId, stage)}
            style={s.characterImg}
          />

          {/* Name + info */}
          <View style={s.charNameRow}>
            <Text style={s.charName}>{user?.name ?? ''}</Text>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setInfoVisible(true)}
            >
              <IInfo />
            </TouchableOpacity>
          </View>

          {/* Level + XP */}
          <View style={s.xpRow}>
            <View style={s.levelGroup}>
              <Text style={s.levelLabel}>LEVEL</Text>
              <Text style={s.levelNum}>{level}</Text>
            </View>
            <Text style={s.xpText}>
              {isMaxLevel ? 'MAX LEVEL' : `XP ${fmtXP(xpInLevel)} / ${fmtXP(xpNext)}`}
            </Text>
          </View>

          <ProgressBar value={xpPct} color={Colors.cr} height={4} />
        </View>

        {/* ── Coach insight banner — latest unread ML-driven message ── */}
        {coachMsg && (() => {
          const TONE_COLOR: Record<CoachTone, string> = {
            motivating: Colors.up,
            neutral:    Colors.bone,
            warning:    Colors.cr,
          };
          const c = TONE_COLOR[coachMsg.tone] ?? Colors.bone;
          return (
            <TouchableOpacity
              style={[s.coachBanner, { borderLeftColor: c }]}
              onPress={async () => {
                const id = coachMsg.id;
                setCoachMsg(null);                          // optimistic dismiss
                try { await coachApi.markRead(id); } catch {}
              }}
              activeOpacity={0.8}
            >
              <View style={[s.coachDot, { backgroundColor: c }]}/>
              <Text style={s.coachBannerText} numberOfLines={2}>
                {coachMsg.message_text}
              </Text>
              <Text style={s.coachDismiss}>Got it</Text>
            </TouchableOpacity>
          );
        })()}

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

      {/* ── Post-workout celebration queue ── */}
      <LevelUpModal
        visible={activeCelebration?.kind === 'levelUp'}
        level={activeCelebration?.kind === 'levelUp' ? activeCelebration.level : 1}
        xpGained={activeCelebration?.kind === 'levelUp' ? activeCelebration.xpGained : 0}
        onClose={dismissCelebration}
      />

      <AchievementModal
        visible={activeCelebration?.kind === 'achievement'}
        achievements={activeCelebration?.kind === 'achievement' ? activeCelebration.achievements : []}
        onClose={dismissCelebration}
      />

      <PRModal
        visible={activeCelebration?.kind === 'pr'}
        prs={activeCelebration?.kind === 'pr' ? activeCelebration.prs : []}
        onClose={dismissCelebration}
      />

      <ChapterCompleteModal
        visible={activeCelebration?.kind === 'chapter'}
        chapterNumber={activeCelebration?.kind === 'chapter' ? activeCelebration.reward.chapter_number : 0}
        xp={activeCelebration?.kind === 'chapter' ? activeCelebration.reward.xp : 0}
        coins={activeCelebration?.kind === 'chapter' ? activeCelebration.reward.coins : 0}
        campaignComplete={activeCelebration?.kind === 'chapter' ? activeCelebration.reward.campaign_complete : false}
        onClose={dismissCelebration}
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

      <XpToast
        xp={xpToastAmount}
        visible={xpToastVisible}
        onHide={() => setXpToastVisible(false)}
      />

      <CharacterInfoModal
        visible={infoVisible}
        characterId={characterId}
        currentStage={stage}
        onClose={() => setInfoVisible(false)}
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

  heroSection:  { paddingHorizontal: Spacing.xxl, paddingBottom: 20 },
  characterImg: { width: SCREEN_H / 3, height: SCREEN_H / 3, resizeMode: 'contain', alignSelf: 'center' },

  charNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 6, marginBottom: 16 },
  charName:    { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.bone, letterSpacing: -0.3 },

  xpRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  levelGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  levelLabel: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.t3, letterSpacing: 2, marginBottom: 7, textTransform: 'uppercase' },
  levelNum:   { fontSize: 44, fontFamily: Fonts.displayBold, color: Colors.bone, lineHeight: 46 },
  xpText:     { fontSize: 13, fontFamily: Fonts.mono, color: Colors.t2, marginBottom: 6 },

  // ── Coach banner ──
  coachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    borderLeftWidth: 3,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  coachDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  coachBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t1,
    lineHeight: 18,
  },
  coachDismiss: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    color: Colors.t3,
    textTransform: 'uppercase',
  },
});
