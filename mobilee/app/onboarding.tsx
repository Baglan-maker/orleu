import { useRef, useState, useEffect } from 'react';
import {
  Animated, Dimensions, FlatList, Image, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, getCharacterImage, type AvatarStage } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

const { width: W } = Dimensions.get('window');

const STAGE_NAMES = ['Rookie', 'Active', 'Athlete', 'Champion', 'Legend'];

// Campaign chapters (real data from The Foundation campaign)
const CHAPTERS = [
  { num: 1, title: 'First Steps',     req: '3 workouts'           },
  { num: 2, title: 'Building Habits', req: '6 workouts'           },
  { num: 3, title: 'The Crossroads',  req: 'Choose your path', fork: true },
  { num: 4, title: 'Momentum',        req: '12 workouts'          },
  { num: 5, title: 'The Ascent',      req: '20 workouts'          },
];

// AI chart: 5 data points on an ascending trend
const CHART_PTS = [
  { x: 26,  y: 110 },
  { x: 74,  y: 88  },
  { x: 122, y: 66  },
  { x: 170, y: 42  },
  { x: 218, y: 20  },
];

const SLIDES = [
  {
    id: 'welcome',
    accent: Colors.cr,
    title: 'Welcome to Orleu',
    sub: 'Your fitness journey, turned into a game. Train, level up, and watch yourself grow — with AI that gets your progress.',
  },
  {
    id: 'workout',
    accent: Colors.cr,
    title: 'Log every rep',
    sub: 'Add exercises, sets, and weight in seconds. Everything you log feeds your AI coach.',
  },
  {
    id: 'avatar',
    accent: Colors.cr,
    title: 'Your hero grows with you',
    sub: 'Show up consistently and your character levels up — from Rookie all the way to Legend.',
  },
  {
    id: 'campaign',
    accent: Colors.flat,
    title: 'Follow a real story',
    sub: 'Five chapters unlock as you actually train. No tapping buttons — every chapter is earned in the gym.',
  },
  {
    id: 'ai',
    accent: Colors.up,
    title: 'AI that tells the truth',
    sub: 'The app checks your progress every day. Improving? Missions get harder. Slipping? It backs off. Always honest.',
  },
  {
    id: 'ready',
    accent: Colors.cr,
    title: "You're all set",
    sub: 'Log your first workout, pick a mission, and start climbing. Every rep counts.',
  },
] as const;

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function IArrow() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}
function IFlag() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <Line x1="4" y1="22" x2="4" y2="15"/>
    </Svg>
  );
}

// ─── Slide illustrations ──────────────────────────────────────────────────────

function WelcomeIllustration({ fade, scale }: { fade: Animated.Value; scale: Animated.Value }) {
  return (
    <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
      <Svg width={200} height={160} viewBox="0 0 200 160">
        {/* Background peak (secondary) */}
        <Path
          d="M5,138 L55,62 L105,138"
          fill="none" stroke={`${Colors.cr}18`}
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Main mountain */}
        <Path
          d="M28,142 L100,16 L172,142"
          fill="none" stroke={Colors.cr}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Climbing path (dashed) */}
        <Path
          d="M28,142 L64,79 L100,16"
          fill="none" stroke={Colors.cr}
          strokeWidth={1.5} strokeDasharray="5,4" strokeLinecap="round"
        />
        {/* Summit glow */}
        <Circle cx={100} cy={16} r={14} fill={`${Colors.cr}15`}/>
        <Circle cx={100} cy={16} r={7}  fill={Colors.cr}/>
        {/* Base line */}
        <Line x1={0} y1={142} x2={200} y2={142} stroke={Colors.line} strokeWidth={1}/>
        {/* Accent dots */}
        <Circle cx={148} cy={44} r={2}   fill={`${Colors.cr}70`}/>
        <Circle cx={162} cy={76} r={1.5} fill={`${Colors.cr}45`}/>
        <Circle cx={42}  cy={60} r={1.5} fill={`${Colors.cr}35`}/>
      </Svg>
    </Animated.View>
  );
}

function WorkoutIllustration({ fades, xs }: { fades: Animated.Value[]; xs: Animated.Value[] }) {
  const rows = [
    { name: 'Bench Press',    sets: '3×8',  kg: '80 kg' },
    { name: 'Squat',          sets: '4×6',  kg: '100 kg'},
    { name: 'Overhead Press', sets: '3×10', kg: '50 kg' },
  ];
  return (
    <View style={{ gap: 8, width: W - Spacing.xxl * 2 - 8 }}>
      {rows.map((row, i) => (
        <Animated.View
          key={i}
          style={[il.wRow, { opacity: fades[i], transform: [{ translateX: xs[i] }] }]}
        >
          <View style={il.wDot}/>
          <Text style={il.wName}>{row.name}</Text>
          <Text style={il.wSets}>{row.sets}</Text>
          <Text style={il.wKg}>{row.kg}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function AvatarIllustration({
  characterId,
  avatarStage,
  opacity,
  scale,
}: {
  characterId: number;
  avatarStage: AvatarStage;
  opacity: Animated.Value;
  scale: Animated.Value;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Animated.View style={[il.avatarBox, { opacity, transform: [{ scale }] }]}>
        <Image
          source={getCharacterImage(characterId, avatarStage)}
          style={il.avatarImg}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[il.stagePill, { opacity }]}>
        <View style={[il.stageIndicator, { backgroundColor: Colors.cr }]}/>
        <Text style={il.stageName}>{STAGE_NAMES[avatarStage]}</Text>
        <Text style={il.stageLevel}>Lv {avatarStage + 1}</Text>
      </Animated.View>
    </View>
  );
}

function CampaignIllustration({ nodes }: { nodes: Animated.Value[] }) {
  return (
    <View style={{ gap: 7, width: '100%' }}>
      {CHAPTERS.map((ch, i) => (
        <Animated.View
          key={i}
          style={[
            il.chRow,
            ch.fork && il.chRowFork,
            {
              opacity: nodes[i],
              transform: [{
                translateX: nodes[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
              }],
            },
          ]}
        >
          {/* Chapter number pill */}
          <View style={[il.chNum, ch.fork && { backgroundColor: `${Colors.flat}25`, borderColor: `${Colors.flat}50` }]}>
            <Text style={[il.chNumText, ch.fork && { color: Colors.flat }]}>{ch.num}</Text>
          </View>
          {/* Title */}
          <Text style={il.chTitle} numberOfLines={1}>{ch.title}</Text>
          {/* Requirement tag */}
          {ch.fork ? (
            <View style={il.forkPill}>
              <Text style={il.forkText}>FORK</Text>
            </View>
          ) : (
            <Text style={il.chReq}>{ch.req}</Text>
          )}
        </Animated.View>
      ))}
    </View>
  );
}

function AIIllustration({
  segs,
  badge,
}: {
  segs: Animated.Value[];
  badge: Animated.Value;
}) {
  return (
    <View style={{ width: 260, height: 140, position: 'relative' }}>
      {/* Static grid + base line */}
      <Svg width={260} height={140} viewBox="0 0 260 140" style={{ position: 'absolute', top: 0, left: 0 }}>
        {[20, 50, 80, 110].map((y, i) => (
          <Line key={i} x1={16} y1={y} x2={244} y2={y} stroke={Colors.s3} strokeWidth={1}/>
        ))}
        {/* Faint reference path */}
        <Path
          d="M26,110 L74,88 L122,66 L170,42 L218,20"
          fill="none" stroke={`${Colors.up}25`}
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
      {/* Animated data points */}
      {CHART_PTS.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            il.chartPt,
            {
              left: p.x - 7, top: p.y - 7,
              opacity: segs[i],
              transform: [{ scale: segs[i] }],
            },
          ]}
        />
      ))}
      {/* Trend badge */}
      <Animated.View
        style={[
          il.trendBadge,
          { opacity: badge, transform: [{ scale: badge }] },
        ]}
      >
        <View style={il.trendDot}/>
        <Text style={il.trendLabel}>IMPROVING</Text>
      </Animated.View>
    </View>
  );
}

function ReadyIllustration({ pulse }: { pulse: Animated.Value }) {
  return (
    <Animated.View style={{ transform: [{ scale: pulse }], alignItems: 'center' }}>
      <Svg width={160} height={160} viewBox="0 0 160 160">
        {/* Concentric rings */}
        <Circle cx={80} cy={80} r={72} fill={`${Colors.cr}08`} stroke={`${Colors.cr}22`} strokeWidth={1}/>
        <Circle cx={80} cy={80} r={54} fill={`${Colors.cr}10`} stroke={`${Colors.cr}32`} strokeWidth={1.5}/>
        {/* Inner filled circle */}
        <Circle cx={80} cy={80} r={36} fill={`${Colors.cr}20`} stroke={Colors.cr} strokeWidth={2}/>
        {/* Upward arrow */}
        <Line x1={80} y1={100} x2={80} y2={58} stroke={Colors.cr} strokeWidth={2.5} strokeLinecap="round"/>
        <Polyline
          points="62,76 80,58 98,76"
          fill="none" stroke={Colors.cr}
          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [current, setCurrent] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [avatarStage, setAvatarStage] = useState<AvatarStage>(0);
  const listRef = useRef<FlatList>(null);

  const characterId = user?.avatar_theme_id ?? 0;

  // Per-slide animation values
  const welcomeFade  = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.88)).current;

  const rowFades = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const rowXs    = useRef([0, 1, 2].map(() => new Animated.Value(-18))).current;

  const stageOpacity = useRef(new Animated.Value(0)).current;
  const stageScale   = useRef(new Animated.Value(0.85)).current;

  const nodeAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  const chartSegs = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Slide 0: welcome fade-in ────────────────────────────────────────────────
  useEffect(() => {
    if (current !== 0) return;
    welcomeFade.setValue(0);
    welcomeScale.setValue(0.88);
    Animated.parallel([
      Animated.timing(welcomeFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(welcomeScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [current]);

  // ── Slide 1: workout rows stagger ───────────────────────────────────────────
  useEffect(() => {
    if (current !== 1) return;
    rowFades.forEach(a => a.setValue(0));
    rowXs.forEach(a => a.setValue(-18));
    Animated.stagger(130, rowFades.map((fade, i) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(rowXs[i], { toValue: 0, duration: 320, useNativeDriver: true }),
      ])
    )).start();
  }, [current]);

  // ── Slide 2: avatar cycling ─────────────────────────────────────────────────
  // Recursive sequence: each stage plays exactly once in order, no overlap or repeat.
  // `active` ref stops callbacks from firing after the user leaves this slide.
  useEffect(() => {
    if (current !== 2) return;
    let active = true;

    function showStage(s: number) {
      if (!active) return;
      setAvatarStage(s as AvatarStage);
      stageOpacity.setValue(0);
      stageScale.setValue(0.86);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(stageOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(stageScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        ]),
        Animated.delay(950),
        Animated.parallel([
          Animated.timing(stageOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(stageScale, { toValue: 0.86, duration: 220, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished && active) showStage((s + 1) % 5);
      });
    }

    showStage(0);
    return () => {
      active = false;
      stageOpacity.stopAnimation();
      stageScale.stopAnimation();
    };
  }, [current]);

  // ── Slide 3: campaign chapter cards slide in ────────────────────────────────
  useEffect(() => {
    if (current !== 3) return;
    nodeAnims.forEach(a => a.setValue(0));
    Animated.stagger(100, nodeAnims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true })
    )).start();
  }, [current]);

  // ── Slide 4: chart draws in then badge pops ─────────────────────────────────
  useEffect(() => {
    if (current !== 4) return;
    chartSegs.forEach(a => a.setValue(0));
    badgeAnim.setValue(0);
    Animated.sequence([
      Animated.delay(300),
      Animated.stagger(200, chartSegs.map(a =>
        Animated.spring(a, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true })
      )),
      Animated.spring(badgeAnim, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [current]);

  // ── Slide 5: pulsing ring ───────────────────────────────────────────────────
  useEffect(() => {
    if (current !== 5) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 950, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [current]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goNext() {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      finish();
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await api.patch('/api/auth/me', { onboarding_done: true });
      if (user) setUser({ ...user, onboarding_done: true });
    } catch { /* proceed anyway */ }
    finally { router.replace('/(tabs)'); }
  }

  const isLast = current === SLIDES.length - 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: W }]}>

            {/* ── Illustration ── */}
            <View style={s.illustBox}>
              {item.id === 'welcome' && (
                <WelcomeIllustration fade={welcomeFade} scale={welcomeScale}/>
              )}
              {item.id === 'workout' && (
                <WorkoutIllustration fades={rowFades} xs={rowXs}/>
              )}
              {item.id === 'avatar' && (
                <AvatarIllustration
                  characterId={characterId}
                  avatarStage={avatarStage}
                  opacity={stageOpacity}
                  scale={stageScale}
                />
              )}
              {item.id === 'campaign' && (
                <CampaignIllustration nodes={nodeAnims}/>
              )}
              {item.id === 'ai' && (
                <AIIllustration segs={chartSegs} badge={badgeAnim}/>
              )}
              {item.id === 'ready' && (
                <ReadyIllustration pulse={pulseAnim}/>
              )}
            </View>

            {/* ── Accent line above title ── */}
            <View style={[s.accentLine, { backgroundColor: item.accent }]}/>

            {/* ── Text ── */}
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.sub}>{item.sub}</Text>

          </View>
        )}
      />

      {/* ── Progress dots ── */}
      <View style={s.dots}>
        {SLIDES.map((sl, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === current
                ? { backgroundColor: sl.accent, width: 22 }
                : i < current
                  ? { backgroundColor: `${SLIDES[current].accent}50`, width: 10 }
                  : { backgroundColor: Colors.s4 },
            ]}
          />
        ))}
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        {current < 4 && (
          <TouchableOpacity style={s.skipBtn} onPress={finish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: SLIDES[current].accent }]}
          onPress={goNext}
          activeOpacity={0.82}
          disabled={finishing}
        >
          <Text style={s.nextText}>{isLast ? 'Start my ascent' : 'Next'}</Text>
          {isLast ? <IFlag/> : <IArrow/>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.s1 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 64,
  },

  illustBox: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    width: '100%',
  },

  accentLine: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },

  title: {
    fontSize: 28,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
    textAlign: 'left',
    alignSelf: 'flex-start',
    letterSpacing: -0.7,
    marginBottom: 12,
    lineHeight: 34,
  },

  sub: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    textAlign: 'left',
    alignSelf: 'flex-start',
    lineHeight: 24,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 22,
  },
  dot: {
    height: 4,
    borderRadius: 2,
    width: 8,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: 10,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.t3,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.md,
    paddingVertical: 15,
  },
  nextText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.2,
  },
});

// Illustration-specific styles (separate sheet for clarity)
const il = StyleSheet.create({
  // Workout rows
  wRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  wDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.cr,
  },
  wName: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
  },
  wSets: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: Colors.cr,
    minWidth: 32,
    textAlign: 'right',
  },
  wKg: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: Colors.bone,
    minWidth: 50,
    textAlign: 'right',
  },

  // Avatar
  avatarBox: {
    width: 130,
    height: 130,
    borderRadius: Radius.xl,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 112,
    height: 112,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.s3,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  stageIndicator: {
    width: 6, height: 6, borderRadius: 3,
  },
  stageName: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.cr,
    letterSpacing: 0.5,
  },
  stageLevel: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t2,
  },

  // Campaign chapter rows
  chRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  chRowFork: {
    borderColor: `${Colors.flat}30`,
    backgroundColor: `${Colors.flat}08`,
  },
  chNum: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chNumText: {
    fontSize: 10,
    fontFamily: Fonts.monoBold,
    color: Colors.cr,
  },
  chTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
  },
  chReq: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
  },
  forkPill: {
    backgroundColor: `${Colors.flat}22`,
    borderWidth: 1,
    borderColor: `${Colors.flat}45`,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  forkText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: Colors.flat,
    letterSpacing: 0.6,
  },

  // AI chart
  chartPt: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.up,
    borderWidth: 2,
    borderColor: Colors.s1,
  },
  trendBadge: {
    position: 'absolute',
    top: 4, right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.up}18`,
    borderWidth: 1,
    borderColor: `${Colors.up}45`,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.up,
  },
  trendLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.up,
    letterSpacing: 0.7,
  },
});
