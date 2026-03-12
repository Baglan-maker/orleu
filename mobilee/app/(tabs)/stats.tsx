// mobile/app/(tabs)/stats.tsx
import {
    ScrollView, StyleSheet, Text, View,
  } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import Svg, { Line, Path, Polyline, Rect, Circle, Polygon } from 'react-native-svg';
  
  import { Colors, Fonts, Radius, Spacing, AvatarThemes } from '../../constants/theme';
  import { Card }        from '../../components/ui/Card';
  import { ProgressBar } from '../../components/ui/ProgressBar';
  import { useAuthStore } from '../../store/authStore';
  
  // ─── Icons ────────────────────────────────────────────────────────
  function IUp()     { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><Polyline points="17 6 23 6 23 12"/></Svg>; }
  function IFire()   { return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
  function IDumbbell({ c = Colors.cr }: { c?: string }){ return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }
  function ITrophy({ c = Colors.cr }: { c?: string }) { 
    return (
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
         <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><Path d="M4 22h16"/><Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </Svg>
    ); 
  }
  function IStar({ c = Colors.cr }: { c?: string })  { return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>; }
  function IMap({ c = Colors.cr }: { c?: string })   { return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z"/><Line x1="9" y1="3" x2="9" y2="17"/><Line x1="15" y1="7" x2="15" y2="21"/></Svg>; }
  
  // ─── Mock data (позже заменим на /api/progress) ───────────────────
  const WORKOUTS = 17;
  const XP       = 1250;
  const STAGE_NAMES = ['Rookie', 'Active', 'Athlete', 'Champion', 'Legend'];
  const STAGE_THRESH = [0, 6, 16, 31, 51];
  
  function getStage(w: number) {
    return w >= 51 ? 4 : w >= 31 ? 3 : w >= 16 ? 2 : w >= 6 ? 1 : 0;
  }
  
  const VOLUMES = [180, 220, 260, 285];
  const MAX_VOL = Math.max(...VOLUMES);
  
  const ACHIEVEMENTS = [
    { label: 'PR Trophy',  icon: (c: string) => <ITrophy c={c}/>, earned: true  },
    { label: '7-Day',      icon: (c: string) => <IFire/>,          earned: true  },
    { label: 'Vol. King',  icon: (c: string) => <IDumbbell c={c}/>,earned: true  },
    { label: 'Explorer',   icon: (c: string) => <IMap c={c}/>,     earned: false },
    { label: 'Legend',     icon: (c: string) => <IStar c={c}/>,    earned: false },
  ];
  
  export default function StatsScreen() {
    const { user }   = useAuthStore();
    const themeId    = user?.avatar_theme_id ?? 0;
    const theme      = AvatarThemes[themeId];
  
    const stage      = getStage(WORKOUTS);
    const level      = Math.floor(XP / 115) + 1;
    const xpNext     = Math.floor(100 * Math.pow(1.15, level));
    const xpPct      = Math.round((XP % xpNext) / xpNext * 100);
    const score      = Math.round(WORKOUTS * 12 + stage * 80 + XP * 0.1);
  
    const stageNext  = Math.min(stage + 1, 4);
    const stagePct   = stage < 4
      ? Math.round((WORKOUTS - STAGE_THRESH[stage]) / (STAGE_THRESH[stageNext] - STAGE_THRESH[stage]) * 100)
      : 100;
  
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
  
          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.lbl}>Overview</Text>
              <Text style={s.pageTitle}>Progress</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.lbl}>Ascent score</Text>
              <Text style={s.score}>{score}</Text>
            </View>
          </View>
  
          {/* ── Level card ── */}
          <Card variant="default">
            <View style={s.levelRow}>
              {/* Avatar color dot */}
              <View style={[s.avatarDot, { backgroundColor: theme.color }]}>
                <Text style={s.avatarInitial}>{STAGE_NAMES[stage][0]}</Text>
              </View>
  
              <View style={{ flex: 1 }}>
                <Text style={s.stageName}>{theme.name} · {STAGE_NAMES[stage]}</Text>
                <Text style={s.levelNum}>Level {level}</Text>
                <ProgressBar
                  value={xpPct}
                  color={Colors.cr}
                  height={5}
                  leftText={`${XP % xpNext} / ${xpNext} XP`}
                  rightText={`Lv.${level + 1}`}
                  style={{ marginTop: 10 }}
                />
              </View>
            </View>
  
            {/* Stage progress */}
            {stage < 4 && (
              <View style={s.stageRow}>
                <Text style={s.stageLabel}>
                  {WORKOUTS - STAGE_THRESH[stage]} / {STAGE_THRESH[stageNext] - STAGE_THRESH[stage]} sessions to {STAGE_NAMES[stageNext]}
                </Text>
                <ProgressBar value={stagePct} color={theme.color} height={3} style={{ marginTop: 6 }}/>
              </View>
            )}
          </Card>
  
          {/* ── Stat boxes ── */}
          <View style={s.statRow}>
            {[
              { val: String(WORKOUTS), label: 'Sessions', color: Colors.t1 },
              { val: '7',             label: 'Streak',    color: Colors.cr },
              { val: '3',             label: 'PRs Set',   color: Colors.bone },
            ].map((st, i) => (
              <View key={i} style={s.statBox}>
                <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
  
          {/* ── Trend ── */}
          <Card variant="bone">
            <Text style={[s.lbl, { marginBottom: 8 }]}>Current trend</Text>
            <View style={s.trendRow}>
              <View style={s.trendIcon}><IUp/></View>
              <View>
                <Text style={s.trendTitle}>Improving</Text>
                <Text style={s.trendSub}>Volume +15% · 4 sessions/wk · 3 PRs</Text>
              </View>
            </View>
          </Card>
  
          {/* ── Volume chart ── */}
          <Card>
            <View style={s.chartHeader}>
              <Text style={s.chartTitle}>Weekly Volume</Text>
              <Text style={s.chartDelta}>+58% this month</Text>
            </View>
            <View style={s.bars}>
              {VOLUMES.map((v, i) => {
                const isLast = i === VOLUMES.length - 1;
                return (
                  <View key={i} style={s.barCol}>
                    <Text style={[s.barVal, isLast && { color: Colors.bone }]}>{v}</Text>
                    <View style={[
                      s.bar,
                      { height: (v / MAX_VOL) * 48, backgroundColor: isLast ? Colors.cr : Colors.s4 },
                    ]}/>
                    <Text style={s.barWeek}>W{i + 1}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
  
          {/* ── Achievements ── */}
          <Card>
            <Text style={[s.chartTitle, { marginBottom: 16 }]}>Achievements</Text>
            <View style={s.achRow}>
              {ACHIEVEMENTS.map((a, i) => (
                <View key={i} style={[s.achItem, !a.earned && { opacity: 0.25 }]}>
                  <View style={[
                    s.achBox,
                    a.earned
                      ? { backgroundColor: Colors.crLo, borderColor: Colors.crBdr }
                      : { backgroundColor: Colors.s3,   borderColor: Colors.line  },
                  ]}>
                    {a.icon(a.earned ? Colors.cr : Colors.t3)}
                  </View>
                  <Text style={s.achLabel}>{a.label}</Text>
                </View>
              ))}
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
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
      paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
    },
    lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase' },
    pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, marginTop: 3 },
    score:     { fontSize: 22, fontFamily: Fonts.monoBold, color: Colors.bone, marginTop: 3 },
  
    levelRow:      { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    avatarDot:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarInitial: { fontSize: 20, fontFamily: Fonts.displayBold, color: '#fff' },
    stageName:     { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3, marginBottom: 2, letterSpacing: 0.3 },
    levelNum:      { fontSize: 28, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -1, lineHeight: 32 },
    stageRow:      { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.line },
    stageLabel:    { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3 },
  
    statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: 10 },
    statBox: {
      flex: 1, backgroundColor: Colors.s3,
      borderRadius: Radius.md, padding: 14,
      borderWidth: 1, borderColor: Colors.line,
      alignItems: 'center',
    },
    statVal:   { fontSize: 26, fontFamily: Fonts.monoBold, lineHeight: 30, marginBottom: 4 },
    statLabel: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Colors.t3, textTransform: 'uppercase' },
  
    trendRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
    trendIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: `${Colors.up}15`, borderWidth: 1, borderColor: `${Colors.up}25`, alignItems: 'center', justifyContent: 'center' },
    trendTitle:{ fontSize: 17, fontFamily: Fonts.bold, color: Colors.up, letterSpacing: 0.2 },
    trendSub:  { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2 },
  
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    chartTitle:  { fontSize: 14, fontFamily: Fonts.bold, color: Colors.t1 },
    chartDelta:  { fontSize: 11, fontFamily: Fonts.mono, color: Colors.up },
    bars:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 72 },
    barCol:      { flex: 1, alignItems: 'center', gap: 5 },
    barVal:      { fontSize: 9, fontFamily: Fonts.mono, color: Colors.t3 },
    bar:         { width: '100%', borderRadius: 4 },
    barWeek:     { fontSize: 9, fontFamily: Fonts.regular, color: Colors.t3 },
  
    achRow:  { flexDirection: 'row', justifyContent: 'space-around' },
    achItem: { alignItems: 'center', gap: 6 },
    achBox:  { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    achLabel:{ fontSize: 9, fontFamily: Fonts.regular, color: Colors.t2, textAlign: 'center', width: 50, lineHeight: 13 },
  });