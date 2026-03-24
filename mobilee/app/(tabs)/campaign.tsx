// mobile/app/(tabs)/campaign.tsx
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';

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
function ICheck()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }
function IZap()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ILock()   { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="11" width="18" height="11" rx="2"/><Path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>; }
function ITrendUp(){ return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IFlat()   { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={2} strokeLinecap="round"><Line x1="5" y1="12" x2="19" y2="12"/><Polyline points="14 7 19 12 14 17"/></Svg>; }
function IBrain()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/><Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/></Svg>; }
function ICheck2() { return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }

type NodeStatus = 'done' | 'active' | 'locked';

interface DisplayNode {
  id:      string;
  label:   string;
  sub:     string;
  status:  NodeStatus;
  chapter: ChapterResponse | null;
}

export default function CampaignScreen() {
  const [progress,   setProgress]   = useState<ProgressResponse | null>(null);
  const [campaign,   setCampaign]   = useState<CampaignResponse | null>(null);
  const [chapters,   setChapters]   = useState<ChapterResponse[]>([]);
  const [coachMsg,   setCoachMsg]   = useState<CoachMessage | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [branch,     setBranch]     = useState<'A' | 'B' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);

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

  // Derived values
  const doneCount     = chapters.filter(c => getChapterStatus(c) === 'done').length;
  const totalChapters = campaign?.total_chapters ?? chapters.length;
  const pct           = totalChapters > 0 ? Math.round(doneCount / totalChapters * 100) : 0;

  const startDone = doneCount > 0 || !!progress?.current_chapter_id;
  const nodes: DisplayNode[] = [
    { id: 'start', label: 'Journey Begins', sub: '', status: startDone ? 'done' : 'active', chapter: null },
    ...chapters.map(c => ({
      id:      c.id,
      label:   c.title,
      sub:     getChapterStatus(c) === 'done' ? 'Complete' : '',
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

        {/* ── Node map ── */}
        <View style={{ paddingHorizontal: Spacing.xxl }}>
          {nodes.map((node, i) => (
            <View key={node.id}>
              {/* Node row */}
              <View style={s.nodeRow}>
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
                      node.status === 'active' && { color: Colors.cr },
                    ]}>
                      {node.sub}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Branch selector — shown on active chapter with branch */}
              {node.status === 'active' && node.chapter?.has_branch && !confirmed && (
                <View style={s.branchWrap}>
                  <View style={s.branchConnector}/>
                  <Text style={s.branchTitle}>Choose your path</Text>
                  <View style={s.branchRow}>
                    {([
                      {
                        k:    'A' as const,
                        icon: <ITrendUp/>,
                        label: node.chapter.branch_a_label ?? 'Path A',
                        tc:   Colors.cr,
                        tag:  'Hard',
                      },
                      {
                        k:    'B' as const,
                        icon: <IFlat/>,
                        label: node.chapter.branch_b_label ?? 'Path B',
                        tc:   Colors.flat,
                        tag:  'Moderate',
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
                        <View style={{ marginBottom: 8 }}>{opt.icon}</View>
                        <Text style={s.branchLabel}>{opt.label}</Text>
                        <Text style={[s.branchTag, { color: opt.tc }]}>{opt.tag}</Text>
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

  nodeRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  nodeCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nodeDone:   { backgroundColor: `${Colors.up}15`,  borderWidth: 1.5, borderColor: `${Colors.up}35`  },
  nodeActive: { backgroundColor: Colors.crLo,        borderWidth: 1.5, borderColor: Colors.cr         },
  nodeLocked: { backgroundColor: Colors.s3,          borderWidth: 1.5, borderColor: Colors.line, opacity: 0.4 },
  nodeLabel:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, lineHeight: 20 },
  nodeSub:    { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },

  connector: { width: 2, height: 24, marginLeft: 21, backgroundColor: Colors.line },

  branchWrap:      { marginLeft: 21, marginBottom: 4 },
  branchConnector: { width: 2, height: 16, backgroundColor: `${Colors.cr}40`, marginLeft: 21, marginBottom: 12 },
  branchTitle:     { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.t3, textTransform: 'uppercase', paddingLeft: 44, marginBottom: 12 },
  branchRow:       { flexDirection: 'row', gap: 10 },
  branchCard: {
    flex: 1, backgroundColor: Colors.s3,
    borderRadius: Radius.md, padding: 14,
    borderWidth: 1.5, borderColor: Colors.line,
    alignItems: 'center', position: 'relative',
  },
  branchLabel: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 8, textAlign: 'center' },
  branchTag:   { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.8 },
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
  coachIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: Colors.s4, borderWidth: 1, borderColor: Colors.lineH, alignItems: 'center', justifyContent: 'center' },
  coachLabel:{ fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.bone, marginBottom: 5 },
  coachText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, lineHeight: 20 },
});
