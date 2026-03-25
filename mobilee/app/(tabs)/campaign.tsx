// mobile/app/(tabs)/campaign.tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import {
  progressApi, campaignApi, coachApi,
  type ProgressResponse, type CampaignResponse,
  type ChapterResponse, type CoachMessage,
} from '../../services/gamificationApi';

// ─── Icons ───────────────────────────────────────────────────────
function ICheck()    { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }
function IZap()      { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ILock()     { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="11" width="18" height="11" rx="2"/><Path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>; }
function ITrendUp()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IFlat()     { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={2} strokeLinecap="round"><Line x1="5" y1="12" x2="19" y2="12"/><Polyline points="14 7 19 12 14 17"/></Svg>; }
function IBrain()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/><Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/></Svg>; }
function ICheck2()   { return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }
function IDumbbell() { return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h11"/><Path d="M6.5 17.5h11"/><Path d="M3 9.5h2v5H3z"/><Path d="M19 9.5h2v5h-2z"/><Path d="M5 7.5v9"/><Path d="M19 7.5v9"/></Svg>; }
function ITarget()   { return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="10"/><Circle cx="12" cy="12" r="6"/><Circle cx="12" cy="12" r="2"/></Svg>; }
function IStar()     { return <Svg width={12} height={12} viewBox="0 0 24 24" fill={Colors.flat} stroke={Colors.flat} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></Svg>; }
function ICoin()     { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="10"/><Path d="M12 6v2m0 8v2m-4-6h8"/></Svg>; }
function ITrophy()   { return <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><Path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><Path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><Path d="M12 17v4"/><Path d="M8 21h8"/></Svg>; }

type NodeStatus = 'done' | 'active' | 'locked';

interface DisplayNode {
  id:      string;
  label:   string;
  sub:     string;
  status:  NodeStatus;
  chapter: ChapterResponse | null;
}

// ── Chapter conditions definition (mirrors backend gamification_service.py) ──
interface Condition { label: string; key: 'workouts' | 'missions' | 'path'; target: number; }

function getChapterConditions(chapterNumber: number): Condition[] {
  switch (chapterNumber) {
    case 1: return [{ label: 'Log workouts', key: 'workouts', target: 3 }];
    case 2: return [{ label: 'Log workouts', key: 'workouts', target: 6 }, { label: 'Complete missions', key: 'missions', target: 1 }];
    case 3: return [{ label: 'Choose your path', key: 'path', target: 1 }];
    case 4: return [{ label: 'Log workouts', key: 'workouts', target: 12 }, { label: 'Complete missions', key: 'missions', target: 3 }];
    case 5: return [{ label: 'Log workouts', key: 'workouts', target: 20 }, { label: 'Complete missions', key: 'missions', target: 6 }];
    default: return [];
  }
}

function getConditionValue(condition: Condition, progress: ProgressResponse, pathChosen: boolean): number {
  if (condition.key === 'workouts')  return progress.total_workouts ?? 0;
  if (condition.key === 'missions')  return progress.missions_completed_count ?? 0;
  if (condition.key === 'path')      return pathChosen ? 1 : 0;
  return 0;
}

// ── Chapter condition description strings ──
function chapterRequirementSummary(chapterNumber: number): string {
  switch (chapterNumber) {
    case 1: return '3 workouts';
    case 2: return '6 workouts · 1 mission';
    case 3: return 'Choose your path';
    case 4: return '12 workouts · 3 missions · path chosen';
    case 5: return '20 workouts · 6 missions';
    default: return '';
  }
}

// ── Campaign completion XP bonus (mirrors backend CAMPAIGN_COMPLETION_BONUS) ──
const CAMPAIGN_BONUS_XP    = 500;
const CAMPAIGN_BONUS_COINS = 200;

export default function CampaignScreen() {
  const [progress,    setProgress]    = useState<ProgressResponse | null>(null);
  const [campaign,    setCampaign]    = useState<CampaignResponse | null>(null);
  const [chapters,    setChapters]    = useState<ChapterResponse[]>([]);
  const [coachMsg,    setCoachMsg]    = useState<CoachMessage | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [branch,      setBranch]      = useState<'A' | 'B' | null>(null);
  const [confirming,  setConfirming]  = useState(false);
  const [confirmed,   setConfirmed]   = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [campaignBanner, setCampaignBanner] = useState<string | null>(null);

  const lastSeenCampaignId = useRef<string | null>(null);
  const bannerTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [progRes, campaignsRes] = await Promise.all([
            progressApi.get(),
            campaignApi.list(),
          ]);
          if (cancelled) return;

          const prog = progRes.data;
          setProgress(prog);
          if (prog.campaign_path) {
            setBranch(prog.campaign_path as 'A' | 'B');
            setConfirmed(true);
          } else {
            setBranch(null);
            setConfirmed(false);
          }

          const campaigns = campaignsRes.data;
          const current =
            campaigns.find(c => c.id === prog.current_campaign_id) ??
            campaigns[0] ??
            null;
          setCampaign(current);

          if (current && lastSeenCampaignId.current !== null && current.id !== lastSeenCampaignId.current) {
            setCampaignBanner(current.name);
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
            bannerTimerRef.current = setTimeout(() => setCampaignBanner(null), 4000);
          }
          lastSeenCampaignId.current = current?.id ?? null;

          if (current) {
            const [chapRes, coachRes] = await Promise.all([
              campaignApi.chapters(current.id),
              coachApi.getMessages().catch(() => ({ data: [] as CoachMessage[] })),
            ]);
            if (!cancelled) {
              setChapters(chapRes.data);
              const msgs = coachRes.data;
              setCoachMsg(msgs.length > 0 ? msgs[0] : null);
            }
          }
        } catch {
          // fall through to defaults
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  function getChapterStatus(chapter: ChapterResponse): NodeStatus {
    if (progress?.current_campaign_id && !progress.current_chapter_id) return 'done';
    if (!progress?.current_chapter_id) return 'locked';
    const currentChapter = chapters.find(c => c.id === progress.current_chapter_id);
    if (!currentChapter) return 'locked';
    if (chapter.chapter_number < currentChapter.chapter_number) return 'done';
    if (chapter.id === progress.current_chapter_id) return 'active';
    return 'locked';
  }

  async function confirmPath() {
    if (!branch || confirming) return;
    setConfirming(true);
    try {
      await progressApi.patch({ campaign_path: branch });
      setConfirmed(true);
      setProgress(prev => prev ? { ...prev, campaign_path: branch } : prev);
    } catch {
      // silent — user can retry
    } finally {
      setConfirming(false);
    }
  }

  const allComplete   = !!(progress?.current_campaign_id && !progress?.current_chapter_id);
  const doneCount     = chapters.filter(c => getChapterStatus(c) === 'done').length;
  const totalChapters = campaign?.total_chapters ?? chapters.length;
  const pct           = totalChapters > 0 ? Math.round(doneCount / totalChapters * 100) : 0;
  const pathChosen    = !!(progress?.campaign_path);

  const startDone = doneCount > 0 || !!progress?.current_chapter_id || allComplete;
  const nodes: DisplayNode[] = [
    { id: 'start', label: 'Journey Begins', sub: '', status: startDone ? 'done' : 'active', chapter: null },
    ...chapters.map(c => ({
      id:      c.id,
      label:   c.title,
      sub:     getChapterStatus(c) === 'done' ? 'Complete' : chapterRequirementSummary(c.chapter_number),
      status:  getChapterStatus(c),
      chapter: c,
    })),
  ];

  const toGo = totalChapters - doneCount;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={Colors.cr} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.lbl}>Campaign</Text>
            <Text style={s.pageTitle} numberOfLines={2}>
              {campaign?.name ?? 'No Active Campaign'}
            </Text>
          </View>
          <Text style={s.pct}>{pct}%</Text>
        </View>

        {/* ── Campaign transition banner ── */}
        {campaignBanner && (
          <View style={s.campaignBanner}>
            <Text style={s.campaignBannerText}>New Campaign Unlocked: {campaignBanner}</Text>
          </View>
        )}

        {/* ── Progress bar ── */}
        <View style={{ paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xl }}>
          <ProgressBar
            value={pct}
            color={Colors.up}
            height={3}
            leftText={`${doneCount} chapter${doneCount !== 1 ? 's' : ''} done`}
            rightText={toGo > 0 ? `${toGo} to go` : 'Complete!'}
          />
        </View>

        {/* ── All Campaigns Complete ── */}
        {allComplete ? (
          <View style={s.completedCard}>
            <View style={s.completedTrophyWrap}>
              <ITrophy/>
            </View>
            <Text style={s.completedTitle}>All Campaigns Complete</Text>
            <Text style={s.completedSub}>
              You've reached the summit. New campaigns coming soon.
            </Text>

            {/* Campaign completion rewards summary */}
            <View style={s.rewardRow}>
              <View style={s.rewardPill}>
                <IStar/>
                <Text style={s.rewardPillText}>+{CAMPAIGN_BONUS_XP} XP Bonus</Text>
              </View>
              <View style={s.rewardPill}>
                <ICoin/>
                <Text style={s.rewardPillText}>+{CAMPAIGN_BONUS_COINS} Coins Bonus</Text>
              </View>
            </View>

            <View style={s.completedStats}>
              <View style={s.completedStat}>
                <Text style={s.completedStatNum}>{chapters.length}</Text>
                <Text style={s.completedStatLabel}>chapters done</Text>
              </View>
              <View style={s.completedStatDivider}/>
              <View style={s.completedStat}>
                <Text style={s.completedStatNum}>{progress?.total_sessions ?? 0}</Text>
                <Text style={s.completedStatLabel}>workouts logged</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: Spacing.xxl }}>
            {nodes.map((node, i) => (
              <View key={node.id}>
                {/* Node row — tappable */}
                <TouchableOpacity
                  style={s.nodeRow}
                  activeOpacity={node.status === 'locked' ? 0.5 : 0.75}
                  onPress={() => setExpandedId(expandedId === node.id ? null : node.id)}
                >
                  <View style={[
                    s.nodeCircle,
                    node.status === 'done'   && s.nodeDone,
                    node.status === 'active' && s.nodeActive,
                    node.status === 'locked' && s.nodeLocked,
                  ]}>
                    {node.status === 'done'   && <ICheck/>}
                    {node.status === 'active' && <IZap/>}
                    {node.status === 'locked' && <ILock/>}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[s.nodeLabel, node.status === 'locked' && { color: Colors.t3 }]}>
                      {node.label}
                    </Text>
                    {node.sub ? (
                      <Text style={[
                        s.nodeSub,
                        node.status === 'done'   && { color: Colors.up },
                        node.status === 'active' && { color: Colors.t2 },
                        node.status === 'locked' && { color: Colors.t3 },
                      ]}>
                        {node.sub}
                      </Text>
                    ) : null}
                  </View>

                  {/* Chevron */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                    stroke={expandedId === node.id ? Colors.t2 : Colors.t3}
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  >
                    {expandedId === node.id
                      ? <Polyline points="18 15 12 9 6 15"/>
                      : <Polyline points="6 9 12 15 18 9"/>}
                  </Svg>
                </TouchableOpacity>

                {/* Inline expansion panel */}
                {expandedId === node.id && (
                  <View style={s.expandPanel}>
                    {node.chapter ? (
                      <>
                        <Text style={s.expandChapterNum}>Chapter {node.chapter.chapter_number}</Text>

                        {/* Narrative */}
                        {node.chapter.narrative_text ? (
                          <Text style={s.expandNarrative}>{node.chapter.narrative_text}</Text>
                        ) : (
                          <Text style={s.expandNarrative}>
                            {node.status === 'locked'
                              ? 'Complete previous chapters to unlock this one.'
                              : 'Keep pushing — your journey continues.'}
                          </Text>
                        )}

                        {/* ── Conditions ── */}
                        {getChapterConditions(node.chapter.chapter_number).length > 0 && (
                          <View style={s.conditionsBlock}>
                            <Text style={s.conditionsTitle}>Requirements</Text>
                            {getChapterConditions(node.chapter.chapter_number).map((cond, ci) => {
                              if (cond.key === 'path') {
                                // Path condition — just a label, no number progress
                                const done = node.status === 'done' || pathChosen;
                                return (
                                  <View key={ci} style={s.condRow}>
                                    <View style={[s.condDot, done && s.condDotDone]}/>
                                    <Text style={[s.condLabel, done && s.condLabelDone]}>
                                      Choose your path below
                                    </Text>
                                    {done && (
                                      <View style={s.condCheck}><ICheck2/></View>
                                    )}
                                  </View>
                                );
                              }
                              const current = progress
                                ? getConditionValue(cond, progress, pathChosen)
                                : 0;
                              const capped   = Math.min(current, cond.target);
                              const pctCond  = Math.round(capped / cond.target * 100);
                              const isDone   = node.status === 'done' || capped >= cond.target;
                              return (
                                <View key={ci} style={s.condBlock}>
                                  <View style={s.condRow}>
                                    <View style={cond.key === 'workouts' ? {} : {}}>
                                      {cond.key === 'workouts' ? <IDumbbell/> : <ITarget/>}
                                    </View>
                                    <Text style={[s.condLabel, isDone && s.condLabelDone]}>
                                      {cond.label}
                                    </Text>
                                    <Text style={[s.condProgress, isDone && { color: Colors.up }]}>
                                      {isDone && node.status === 'done'
                                        ? `${cond.target}/${cond.target}`
                                        : `${capped}/${cond.target}`}
                                    </Text>
                                  </View>
                                  {node.status !== 'done' && (
                                    <View style={s.condBarBg}>
                                      <View style={[s.condBarFill, { width: `${pctCond}%`, backgroundColor: isDone ? Colors.up : Colors.cr }]}/>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* ── Rewards ── */}
                        <View style={s.rewardBlock}>
                          <Text style={s.conditionsTitle}>
                            {node.status === 'done' ? 'Rewards Earned' : 'Chapter Reward'}
                          </Text>
                          <View style={s.rewardRow}>
                            <View style={[s.rewardPill, node.status === 'done' && s.rewardPillEarned]}>
                              <IStar/>
                              <Text style={[s.rewardPillText, node.status === 'done' && s.rewardPillTextEarned]}>
                                +{node.chapter.reward_xp} XP
                              </Text>
                            </View>
                            <View style={[s.rewardPill, node.status === 'done' && s.rewardPillEarned]}>
                              <ICoin/>
                              <Text style={[s.rewardPillText, node.status === 'done' && s.rewardPillTextEarned]}>
                                +{node.chapter.reward_coins} Coins
                              </Text>
                            </View>
                            {/* Campaign completion bonus on final chapter */}
                            {node.chapter.chapter_number === totalChapters && (
                              <View style={s.rewardPillBonus}>
                                <Text style={s.rewardPillBonusText}>+{CAMPAIGN_BONUS_XP} XP Campaign Bonus</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Branch hint for locked chapters */}
                        {node.chapter.has_branch && node.status === 'locked' && (
                          <View style={s.expandBranchHint}>
                            <Text style={s.expandBranchLabel}>This chapter has a path choice</Text>
                            {node.chapter.branch_a_label && (
                              <Text style={s.expandBranchOption}>A · {node.chapter.branch_a_label}</Text>
                            )}
                            {node.chapter.branch_b_label && (
                              <Text style={s.expandBranchOption}>B · {node.chapter.branch_b_label}</Text>
                            )}
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={s.expandNarrative}>
                        Your journey begins here. Log your first session to advance to Chapter 1.
                      </Text>
                    )}
                  </View>
                )}

                {/* Branch selector — shown on active chapter with branch */}
                {node.status === 'active' && node.chapter?.has_branch && !confirmed && (
                  <View style={s.branchWrap}>
                    <View style={s.branchConnector}/>
                    <Text style={s.branchTitle}>Choose your path</Text>
                    <Text style={s.branchSubtitle}>Your choice shapes the next chapter's missions</Text>
                    <View style={s.branchRow}>
                      {([
                        {
                          k:       'A' as const,
                          icon:    <ITrendUp/>,
                          label:   node.chapter.branch_a_label ?? 'Path A',
                          tc:      Colors.cr,
                          tag:     'Intensity',
                          desc:    'Heavy lifts, max effort, strength-focused missions ahead.',
                          req:     '12 workouts · 3 missions',
                        },
                        {
                          k:       'B' as const,
                          icon:    <IFlat/>,
                          label:   node.chapter.branch_b_label ?? 'Path B',
                          tc:      Colors.flat,
                          tag:     'Volume',
                          desc:    'Consistent reps, steady progress, endurance missions ahead.',
                          req:     '12 workouts · 3 missions',
                        },
                      ] as const).map(opt => (
                        <TouchableOpacity
                          key={opt.k}
                          onPress={() => setBranch(opt.k)}
                          style={[
                            s.branchCard,
                            branch === opt.k && { borderColor: opt.tc, backgroundColor: `${opt.tc}10` },
                          ]}
                          activeOpacity={0.8}
                        >
                          <View style={{ marginBottom: 6 }}>{opt.icon}</View>
                          <Text style={s.branchLabel}>{opt.label}</Text>
                          <Text style={[s.branchTag, { color: opt.tc }]}>{opt.tag}</Text>
                          <Text style={s.branchDesc}>{opt.desc}</Text>
                          <View style={s.branchReqRow}>
                            <Text style={s.branchReqText}>{opt.req}</Text>
                          </View>
                          {branch === opt.k && (
                            <View style={[s.branchCheck, { backgroundColor: opt.tc }]}>
                              <ICheck2/>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    {branch && (
                      <Button
                        label={confirming ? 'Saving...' : `Confirm Path ${branch}`}
                        onPress={confirmPath}
                        disabled={confirming}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </View>
                )}

                {confirmed && node.status === 'active' && node.chapter?.has_branch && (
                  <View style={s.confirmedBadge}>
                    <Text style={s.confirmedText}>Path {branch} selected</Text>
                  </View>
                )}

                {/* Connector line */}
                {i < nodes.length - 1 && (
                  <View style={[
                    s.connector,
                    node.status === 'done' && { backgroundColor: `${Colors.up}30` },
                  ]}/>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── AI Coach ── */}
        <Card variant="bone" style={{ marginTop: Spacing.lg }}>
          <View style={s.coachRow}>
            <View style={s.coachIcon}><IBrain/></View>
            <View style={{ flex: 1 }}>
              <Text style={s.coachLabel}>AI COACH</Text>
              <Text style={s.coachText}>
                {coachMsg?.message ?? 'Keep pushing — consistency is the key to your ascent.'}
              </Text>
            </View>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.xl, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
  },
  lbl:      { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle:{ fontSize: 24, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, lineHeight: 30 },
  pct:      { fontSize: 22, fontFamily: Fonts.monoBold, color: Colors.bone, marginTop: 4 },

  campaignBanner: {
    marginHorizontal: Spacing.xxl, marginBottom: Spacing.md,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.crLo, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.crBdr,
  },
  campaignBannerText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.cr, letterSpacing: 0.2 },

  nodeRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  nodeCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nodeDone:   { backgroundColor: `${Colors.up}15`,  borderWidth: 1.5, borderColor: `${Colors.up}35`  },
  nodeActive: { backgroundColor: Colors.crLo,        borderWidth: 1.5, borderColor: Colors.cr         },
  nodeLocked: { backgroundColor: Colors.s3,          borderWidth: 1.5, borderColor: Colors.line, opacity: 0.4 },
  nodeLabel:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, lineHeight: 20 },
  nodeSub:    { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },

  connector: { width: 2, height: 24, marginLeft: 21, backgroundColor: Colors.line },

  branchWrap:      { marginLeft: 21, marginBottom: 4 },
  branchConnector: { width: 2, height: 16, backgroundColor: `${Colors.cr}40`, marginLeft: 21, marginBottom: 12 },
  branchTitle:     { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.t3, textTransform: 'uppercase', paddingLeft: 44, marginBottom: 12 },
  branchRow:       { flexDirection: 'row', gap: 10 },
  branchCard: {
    flex: 1, backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 14,
    borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', position: 'relative',
  },
  branchLabel:    { fontSize: 13, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 4, textAlign: 'center' },
  branchTag:      { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.8, marginBottom: 6 },
  branchSubtitle: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, paddingLeft: 44, marginBottom: 10 },
  branchDesc:     { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', lineHeight: 16, marginBottom: 8 },
  branchReqRow:   { backgroundColor: Colors.s1, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  branchReqText:  { fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3, textAlign: 'center' },
  branchCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 19, height: 19, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  confirmedBadge: {
    marginLeft: 58, marginBottom: 4, marginTop: 2,
    backgroundColor: `${Colors.up}15`, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start',
  },
  confirmedText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.up, letterSpacing: 0.5 },

  coachRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  coachIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: Colors.s4, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  coachLabel:{ fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.bone, marginBottom: 5 },
  coachText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20 },

  // ── Expansion panel ───────────────────────────────────────────────
  expandPanel: {
    marginLeft: 58, marginBottom: 4, marginTop: -2,
    backgroundColor: Colors.s3, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, padding: 14,
  },
  expandChapterNum: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  expandNarrative:  { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20, marginBottom: 12 },
  expandBranchHint: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  expandBranchLabel:{ fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  expandBranchOption:{ fontSize: 12, fontFamily: Fonts.mono, color: Colors.t2, marginBottom: 3 },

  // ── Conditions block ──────────────────────────────────────────────
  conditionsBlock: {
    marginBottom: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  conditionsTitle: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.5,
    color: Colors.t3, textTransform: 'uppercase', marginBottom: 8,
  },
  condBlock:    { marginBottom: 8 },
  condRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  condDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.t3 },
  condDotDone:  { backgroundColor: Colors.up },
  condLabel:    { flex: 1, fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2 },
  condLabelDone:{ color: Colors.up },
  condProgress: { fontSize: 11, fontFamily: Fonts.monoBold, color: Colors.t3 },
  condCheck:    { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.up, alignItems: 'center', justifyContent: 'center' },
  condBarBg:    { height: 3, backgroundColor: Colors.s4, borderRadius: 2, overflow: 'hidden' },
  condBarFill:  { height: 3, borderRadius: 2 },

  // ── Reward block ──────────────────────────────────────────────────
  rewardBlock: {
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line,
  },
  rewardRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  rewardPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.s4, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.line,
  },
  rewardPillText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.t2 },
  rewardPillEarned: { backgroundColor: `${Colors.up}12`, borderColor: `${Colors.up}30` },
  rewardPillTextEarned: { color: Colors.up },
  rewardPillBonus: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${Colors.flat}12`, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: `${Colors.flat}30`,
  },
  rewardPillBonusText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.flat },

  // ── All Campaigns Complete ────────────────────────────────────────
  completedCard: {
    alignItems: 'center', paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl, marginBottom: Spacing.lg,
  },
  completedTrophyWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: `${Colors.flat}15`, borderWidth: 1.5,
    borderColor: `${Colors.flat}35`, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.bone,
    marginBottom: 10, letterSpacing: -0.5,
  },
  completedSub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2,
    textAlign: 'center', lineHeight: 20, marginBottom: 16,
  },
  completedStats: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    backgroundColor: Colors.s3, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 24, paddingVertical: 16, marginTop: 12,
  },
  completedStat:        { flex: 1, alignItems: 'center' },
  completedStatNum:     { fontSize: 28, fontFamily: Fonts.monoBold, color: Colors.bone, lineHeight: 34 },
  completedStatLabel:   { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },
  completedStatDivider: { width: 1, height: 36, backgroundColor: Colors.line, marginHorizontal: 16 },
});
