// mobile/app/(tabs)/missions.tsx
import { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Line } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';

// ─── Icons ────────────────────────────────────────────────────────
function IBrain()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/><Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/></Svg>; }
function IUp()     { return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
function IZap(c=Colors.t3)   { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ICheck()  { return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }

type MissionType = 'hard' | 'medium' | 'easy';

interface Mission {
  id:   string;
  type: MissionType;
  name: string;
  desc: string;
  note: string;
  xp:   number;
  prog: { c: number; m: number };
}

const MISSIONS: Mission[] = [
  {
    id: 'vol', type: 'hard',
    name: 'Volume Crusher',
    desc: 'Complete 350 total reps this week',
    note: 'Last week: 300 — up 17%.',
    xp: 150, prog: { c: 285, m: 350 },
  },
  {
    id: 'con', type: 'medium',
    name: 'Weekly Warrior',
    desc: 'Train 4 sessions this week',
    note: 'You average 3.8 — one extra push.',
    xp: 100, prog: { c: 3, m: 4 },
  },
  {
    id: 'bk', type: 'easy',
    name: 'Comeback Session',
    desc: 'Log any 1 workout this week',
    note: 'No minimum. Just show up.',
    xp: 80, prog: { c: 0, m: 1 },
  },
];

const TYPE_COLOR: Record<MissionType, string> = {
  hard:   Colors.cr,
  medium: Colors.flat,
  easy:   Colors.up,
};
const TYPE_LABEL: Record<MissionType, string> = {
  hard: 'HARD', medium: 'MODERATE', easy: 'EASY',
};
const TYPE_DOTS: Record<MissionType, number> = {
  hard: 4, medium: 3, easy: 1,
};

export default function MissionsScreen() {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev
    );
  }

  function startMissions() {
    // TODO Шаг 4.5: POST /api/missions/:id/select для каждого выбранного
    console.log('Starting missions:', selected);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.lbl}>Week 4</Text>
            <Text style={s.pageTitle}>Missions</Text>
          </View>
          <View style={s.trendBadge}>
            <IUp/>
            <Text style={s.trendText}>Improving</Text>
          </View>
        </View>

        {/* ── AI Coach insight ── */}
        <Card variant="bone">
          <View style={s.coachRow}>
            <View style={s.coachIcon}><IBrain/></View>
            <View style={{ flex: 1 }}>
              <Text style={s.coachLbl}>AI COACH · WEEK INSIGHT</Text>
              <Text style={s.coachText}>
                Volume is up 15%. Missions scaled harder — you've earned it.
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Mission cards ── */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <Text style={[s.lbl, { marginBottom: 12 }]}>Select up to 2 missions</Text>

          {MISSIONS.map(m => {
            const pct    = Math.round(m.prog.c / m.prog.m * 100);
            const isOn   = selected.includes(m.id);
            const tc     = TYPE_COLOR[m.type];

            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => toggle(m.id)}
                activeOpacity={0.85}
                style={[
                  s.mcard,
                  isOn && { borderColor: Colors.crBdr, backgroundColor: Colors.crLo },
                ]}
              >
                {/* Left accent stripe */}
                <View style={[s.stripe, { backgroundColor: tc }]}/>

                {/* Header row */}
                <View style={s.mHead}>
                  <View>
                    <Text style={s.mName}>{m.name}</Text>
                    <Text style={[s.mType, { color: tc }]}>{TYPE_LABEL[m.type]}</Text>
                  </View>
                  {/* Difficulty dots */}
                  <View style={s.dots}>
                    {[1, 2, 3, 4, 5].map(d => (
                      <View key={d} style={[
                        s.dot,
                        { backgroundColor: d <= TYPE_DOTS[m.type] ? tc : Colors.s5 },
                      ]}/>
                    ))}
                  </View>
                </View>

                <Text style={s.mDesc}>{m.desc}</Text>
                <Text style={s.mNote}>{m.note}</Text>

                {/* Progress */}
                <ProgressBar
                  value={pct}
                  color={tc}
                  height={4}
                  leftText={`${m.prog.c} / ${m.prog.m}`}
                  rightText={`${pct}%`}
                  style={{ marginBottom: 12 }}
                />

                {/* Footer */}
                <View style={s.mFoot}>
                  <View style={s.xpRow}>
                    {IZap(Colors.t3)}
                    <Text style={s.xpText}>{m.xp} XP</Text>
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

        {/* ── Start CTA ── */}
        {selected.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.lg, marginTop: 4 }}>
            <Button
              label={`Start ${selected.length} mission${selected.length > 1 ? 's' : ''}`}
              onPress={startMissions}
            />
            <Text style={s.resetNote}>Missions reset every Monday</Text>
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
  mDesc:    { fontSize: 14, fontFamily: Fonts.medium, color: Colors.t1, marginBottom: 3 },
  mNote:    { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginBottom: 12, lineHeight: 18 },
  mFoot:    { flexDirection: 'row', alignItems: 'center' },
  xpRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  xpText:   { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t2 },
  checkBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  resetNote: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', marginTop: 8 },
});