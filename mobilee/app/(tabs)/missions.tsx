// mobile/app/(tabs)/missions.tsx
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import {
  missionApi,
  coachApi,
  UserMissionResponse,
  MissionTemplateResponse,
  MlTrend,
  CoachMessageResponse,
} from '../../services/gamificationApi';

// ─── Icons ────────────────────────────────────────────────────────
function IBrain()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/><Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/></Svg>; }
function IUp()     { return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IZap(c: string = Colors.t3) { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ICheck()  { return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }

type DifficultyLevel = 'hard' | 'medium' | 'easy';

function getDifficulty(xp: number): DifficultyLevel {
  if (xp >= 140) return 'hard';
  if (xp >= 100) return 'medium';
  return 'easy';
}

const TYPE_COLOR: Record<DifficultyLevel, string> = {
  hard:   Colors.cr,
  medium: Colors.flat,
  easy:   Colors.up,
};
const TYPE_LABEL: Record<DifficultyLevel, string> = {
  hard: 'HARD', medium: 'MODERATE', easy: 'EASY',
};
const TYPE_DOTS: Record<DifficultyLevel, number> = {
  hard: 4, medium: 3, easy: 1,
};

export default function MissionsScreen() {
  const [activeMissions,    setActiveMissions]    = useState<UserMissionResponse[]>([]);
  const [completedMissions, setCompletedMissions] = useState<UserMissionResponse[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<MissionTemplateResponse[]>([]);
  const [trend, setTrend]             = useState<MlTrend | null>(null);
  const [coachMsg, setCoachMsg]       = useState<CoachMessageResponse | null>(null);
  const [selected, setSelected]       = useState<string[]>([]);
  const [loading, setLoading]         = useState(true);
  const [accepting, setAccepting]     = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const fetchMissions = useCallback(async () => {
    try {
      const [missionsRes, coachRes] = await Promise.all([
        missionApi.getAll(),
        coachApi.getMessages(5).catch(() => null),  // coach is optional, don't break missions if it fails
      ]);
      setActiveMissions(missionsRes.data.active);
      setCompletedMissions(missionsRes.data.completed ?? []);
      setAvailableTemplates(missionsRes.data.available);
      setTrend(missionsRes.data.trend ?? null);
      // Prefer latest unread; fall back to latest read so the AI Coach card always has content
      const msgs = coachRes?.data ?? [];
      setCoachMsg(msgs.find(m => !m.is_read) ?? msgs[0] ?? null);
    } catch {
      // Keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [fetchMissions])
  );

  function toggle(id: string) {
    if (activeMissions.length >= 2) {
      Alert.alert('Mission limit reached', 'Complete or wait for an active mission to expire before starting a new one.');
      return;
    }
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      const slotsLeft = 2 - activeMissions.length;
      if (prev.length >= slotsLeft) {
        Alert.alert('Selection limit', `You can only start ${slotsLeft} more mission${slotsLeft === 1 ? '' : 's'} (you already have ${activeMissions.length} active).`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function startMissions() {
    if (selected.length === 0) return;
    setAccepting(true);
    try {
      for (const templateId of selected) {
        await missionApi.accept(templateId);
      }
      setSelected([]);
      await fetchMissions();
    } catch {
      // Error accepting
    } finally {
      setAccepting(false);
    }
  }

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
            <Text style={s.lbl}>Weekly</Text>
            <Text style={s.pageTitle}>Missions</Text>
          </View>
          {(() => {
            // ML trend badge in header — only when ML has signal; falls back to active count
            const TREND_LABEL = { improving: 'IMPROVING', plateau: 'PLATEAU', declining: 'DECLINING' } as const;
            const TREND_COLOR = { improving: Colors.up, plateau: Colors.flat, declining: Colors.dn } as const;
            if (trend) {
              const c = TREND_COLOR[trend];
              return (
                <View style={[s.trendBadge, { backgroundColor: `${c}15`, borderColor: `${c}25` }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }}/>
                  <Text style={[s.trendText, { color: c }]}>{TREND_LABEL[trend]}</Text>
                </View>
              );
            }
            return (
              <View style={s.trendBadge}>
                <IUp/>
                <Text style={s.trendText}>{activeMissions.length} active</Text>
              </View>
            );
          })()}
        </View>

        {/* ── AI Coach insight — real ML message when available, fallback otherwise ── */}
        <Card variant="bone">
          <View style={s.coachRow}>
            <View style={s.coachIcon}><IBrain/></View>
            <View style={{ flex: 1 }}>
              <Text style={s.coachLbl}>
                {coachMsg ? 'AI COACH · INSIGHT' : 'AI COACH · WEEK INSIGHT'}
              </Text>
              <Text style={s.coachText}>
                {coachMsg
                  ? coachMsg.message_text
                  : activeMissions.length > 0
                    ? 'Keep pushing — your missions scale with your progress.'
                    : 'Pick up to 2 missions to earn bonus XP and coins this week.'}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Active missions ── */}
        {activeMissions.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <Text style={[s.lbl, { marginBottom: 12 }]}>Active missions</Text>
            {activeMissions.map(m => {
              const diff = getDifficulty(m.xp_reward);
              const pct = m.adjusted_target > 0
                ? Math.min(100, Math.round((m.current_progress / m.adjusted_target) * 100))
                : 0;
              const tc = TYPE_COLOR[diff];

              return (
                <View key={m.id} style={s.mcard}>
                  <View style={[s.stripe, { backgroundColor: tc }]}/>
                  <View style={s.mHead}>
                    <View>
                      <Text style={s.mName}>{m.name}</Text>
                      <Text style={[s.mType, { color: tc }]}>{TYPE_LABEL[diff]}</Text>
                    </View>
                    <View style={s.dots}>
                      {[1, 2, 3, 4, 5].map(d => (
                        <View key={d} style={[
                          s.dot,
                          { backgroundColor: d <= TYPE_DOTS[diff] ? tc : Colors.s5 },
                        ]}/>
                      ))}
                    </View>
                  </View>
                  <Text style={s.mDesc}>{m.description}</Text>
                  <ProgressBar
                    value={pct}
                    color={tc}
                    height={4}
                    leftText={`${Math.round(m.current_progress)} / ${Math.round(m.adjusted_target)}`}
                    rightText={`${pct}%`}
                    style={{ marginBottom: 12 }}
                  />
                  <View style={s.mFoot}>
                    <View style={s.xpRow}>
                      {IZap(Colors.t3)}
                      <Text style={s.xpText}>{m.xp_reward} XP</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Completed this week (collapsed) ── */}
        {completedMissions.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <TouchableOpacity
              style={s.completedHeader}
              onPress={() => setCompletedOpen(o => !o)}
              activeOpacity={0.7}
            >
              <View style={s.completedHeaderLeft}>
                <View style={s.completedDot}/>
                <Text style={s.lbl}>Completed this week</Text>
                <View style={s.completedBadge}>
                  <Text style={s.completedBadgeText}>{completedMissions.length}</Text>
                </View>
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Polyline points={completedOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
              </Svg>
            </TouchableOpacity>

            {completedOpen && completedMissions.map(m => {
              const diff = getDifficulty(m.xp_reward);
              const pct = 100;

              return (
                <View key={m.id} style={[s.mcard, s.mcardCompleted]}>
                  <View style={[s.stripe, { backgroundColor: Colors.up }]}/>
                  <View style={s.mHead}>
                    <View>
                      <Text style={[s.mName, s.mNameCompleted]}>{m.name}</Text>
                      <Text style={[s.mType, { color: Colors.up }]}>COMPLETED</Text>
                    </View>
                    <View style={s.dots}>
                      {[1, 2, 3, 4, 5].map(d => (
                        <View key={d} style={[
                          s.dot,
                          { backgroundColor: d <= TYPE_DOTS[diff] ? Colors.up : Colors.s5 },
                        ]}/>
                      ))}
                    </View>
                  </View>
                  <Text style={s.mDesc}>{m.description}</Text>
                  <ProgressBar
                    value={pct}
                    color={Colors.up}
                    height={4}
                    leftText={`${Math.round(m.adjusted_target)} / ${Math.round(m.adjusted_target)}`}
                    rightText="100%"
                    style={{ marginBottom: 12 }}
                  />
                  <View style={s.mFoot}>
                    <View style={s.xpRow}>
                      {IZap(Colors.up)}
                      <Text style={[s.xpText, { color: Colors.up }]}>+{m.xp_reward} XP earned</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Available missions to pick ── */}
        {availableTemplates.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            {activeMissions.length >= 2 ? (
              <View style={s.limitBanner}>
                <Text style={s.limitBannerText}>Mission slots full — complete an active mission to start a new one.</Text>
              </View>
            ) : (
              <Text style={[s.lbl, { marginBottom: 12, marginTop: activeMissions.length > 0 ? 8 : 0 }]}>
                Select up to {2 - activeMissions.length} mission{2 - activeMissions.length === 1 ? '' : 's'}
              </Text>
            )}
            {availableTemplates.map((t, idx) => {
              const diff    = getDifficulty(t.base_xp);
              const tc      = TYPE_COLOR[diff];
              const isOn    = selected.includes(t.id);
              const locked  = activeMissions.length >= 2;
              const desc    = t.description_template.replace('{target}', String(Math.round(t.base_target)));
              // First mission carries the "Recommended" badge when ML reordered the list
              const isRecommended = idx === 0 && (trend === 'improving' || trend === 'declining');

              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => toggle(t.id)}
                  activeOpacity={locked ? 1 : 0.85}
                  style={[
                    s.mcard,
                    locked && s.mcardLocked,
                    isOn && { borderColor: Colors.crBdr, backgroundColor: Colors.crLo },
                  ]}
                >
                  <View style={[s.stripe, { backgroundColor: tc }]}/>
                  {isRecommended && (
                    <View style={s.recommendedBadge}>
                      <Text style={s.recommendedText}>
                        {trend === 'improving' ? 'CHALLENGE PICK' : 'EASY START'}
                      </Text>
                    </View>
                  )}
                  <View style={s.mHead}>
                    <View>
                      <Text style={s.mName}>{t.name}</Text>
                      <Text style={[s.mType, { color: tc }]}>{TYPE_LABEL[diff]}</Text>
                    </View>
                    <View style={s.dots}>
                      {[1, 2, 3, 4, 5].map(d => (
                        <View key={d} style={[
                          s.dot,
                          { backgroundColor: d <= TYPE_DOTS[diff] ? tc : Colors.s5 },
                        ]}/>
                      ))}
                    </View>
                  </View>
                  <Text style={s.mDesc}>{desc}</Text>
                  <View style={s.mFoot}>
                    <View style={s.xpRow}>
                      {IZap(Colors.t3)}
                      <Text style={s.xpText}>{t.base_xp} XP · {t.base_coins} coins</Text>
                    </View>
                    <View style={{ flex: 1 }}/>
                    {isOn && (
                      <View style={[s.checkBadge, { backgroundColor: Colors.cr }]}>
                        <ICheck/>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Start CTA ── */}
        {selected.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.lg, marginTop: 4 }}>
            <Button
              label={accepting ? 'Starting...' : `Start ${selected.length} mission${selected.length > 1 ? 's' : ''}`}
              onPress={startMissions}
              disabled={accepting || activeMissions.length >= 2}
            />
            <Text style={s.resetNote}>Missions reset every Monday</Text>
          </View>
        )}

        {activeMissions.length === 0 && availableTemplates.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 14, fontFamily: Fonts.regular, color: Colors.t3 }}>
              No missions available yet. Complete a workout first!
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.xl, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
  },
  lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase' },
  pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, marginTop: 3 },

  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${Colors.up}15`,
    borderWidth: 1, borderColor: `${Colors.up}25`,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  trendText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.up, letterSpacing: 0.4 },

  coachRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  coachIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: Colors.s4, borderWidth: 1, borderColor: Colors.lineH, alignItems: 'center', justifyContent: 'center' },
  coachLbl:  { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.5, color: Colors.bone, marginBottom: 5 },
  coachText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20 },

  mcard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.line,
    padding: 16, marginBottom: 9,
    overflow: 'hidden', position: 'relative',
  },
  stripe:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  mHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  mName:    { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 3 },
  mType:    { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.9 },
  dots:     { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot:      { width: 5, height: 5, borderRadius: 1.5 },
  mDesc:    { fontSize: 14, fontFamily: Fonts.medium, color: Colors.t1, marginBottom: 12 },
  mFoot:    { flexDirection: 'row', alignItems: 'center' },
  xpRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  xpText:   { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t2 },
  checkBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  resetNote: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', marginTop: 8 },

  completedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, marginBottom: 4,
  },
  completedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  completedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.up },
  completedBadge: {
    backgroundColor: `${Colors.up}20`, borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  completedBadgeText: { fontSize: 10, fontFamily: Fonts.monoBold, color: Colors.up },
  mcardCompleted: { opacity: 0.65 },
  mNameCompleted: { color: Colors.t2 },
  mcardLocked:    { opacity: 0.4 },

  limitBanner: {
    backgroundColor: `${Colors.cr}12`,
    borderWidth: 1, borderColor: Colors.crBdr,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12, marginTop: 8,
  },
  limitBannerText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.cr, lineHeight: 18 },

  recommendedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    color: Colors.cr,
  },
});
