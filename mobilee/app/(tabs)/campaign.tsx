// mobile/app/(tabs)/campaign.tsx
import { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path, Polyline, Circle, Rect } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';

// ─── Icons ───────────────────────────────────────────────────────
function ICheck()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }
function IZap()    { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ILock()   { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="11" width="18" height="11" rx="2"/><Path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>; }
function ITrendUp(){ return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IFlat()   { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={2} strokeLinecap="round"><Line x1="5" y1="12" x2="19" y2="12"/><Polyline points="14 7 19 12 14 17"/></Svg>; }
function IBrain()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/><Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/></Svg>; }
function ICheck2() { return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }

type NodeStatus = 'done' | 'active' | 'locked';
interface CampaignNode {
  id:     string;
  label:  string;
  sub:    string;
  status: NodeStatus;
}

const NODES: CampaignNode[] = [
  { id: 's',    label: 'Journey Begins',            sub: '',                    status: 'done'   },
  { id: 'c1',   label: 'Ch.1 — Foundation',          sub: 'Complete · 300 XP',  status: 'done'   },
  { id: 'fork', label: 'Week 3 — Choose your path',  sub: 'Trend: Improving',   status: 'active' },
  { id: 'boss', label: 'Boss: Foundation Test',      sub: '4 sessions · 1 PR',  status: 'locked' },
  { id: 'next', label: 'Peak Performance',            sub: 'Next campaign',      status: 'locked' },
];

export default function CampaignScreen() {
  const [branch, setBranch] = useState<'A' | 'B' | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function confirm() {
    setConfirmed(true);
    // TODO Шаг 4.8: PATCH /api/progress { campaign_path: branch }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.lbl}>Campaign</Text>
            <Text style={s.pageTitle}>Foundation{'\n'}Building</Text>
          </View>
          <Text style={s.pct}>70%</Text>
        </View>

        {/* ── Progress bar ── */}
        <View style={{ paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xl }}>
          <ProgressBar
            value={70}
            color={Colors.up}
            height={3}
            leftText="7 missions done"
            rightText="3 to boss"
          />
        </View>

        {/* ── Node map ── */}
        <View style={{ paddingHorizontal: Spacing.xxl }}>
          {NODES.map((node, i) => (
            <View key={node.id}>
              {/* Node row */}
              <View style={s.nodeRow}>
                {/* Circle indicator */}
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

                {/* Text */}
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

              {/* Branch selector — только на active node */}
              {node.status === 'active' && !confirmed && (
                <View style={s.branchWrap}>
                  <View style={s.branchConnector}/>
                  <Text style={s.branchTitle}>Choose your path</Text>
                  <View style={s.branchRow}>
                    {[
                      { k: 'A' as const, icon: <ITrendUp/>, label: 'Push Intensity',  sub: '+20% volume',    tag: 'Hard',     tc: Colors.cr   },
                      { k: 'B' as const, icon: <IFlat/>,    label: 'Explore Variety', sub: '5 new exercises',tag: 'Moderate', tc: Colors.flat },
                    ].map(opt => (
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
                        <Text style={s.branchSub}>{opt.sub}</Text>
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
                      label={`Confirm Path ${branch}`}
                      onPress={confirm}
                      style={{ marginTop: 12 }}
                    />
                  )}
                </View>
              )}

              {confirmed && node.status === 'active' && (
                <View style={s.confirmedBadge}>
                  <Text style={s.confirmedText}>Path {branch} selected</Text>
                </View>
              )}

              {/* Connector line between nodes */}
              {i < NODES.length - 1 && (
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
                Volume up 18% this month. Path A challenges your ceiling — your trend says you're ready.
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
  branchLabel: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 3, textAlign: 'center' },
  branchSub:   { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, marginBottom: 8, textAlign: 'center' },
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