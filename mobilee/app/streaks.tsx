import React, { useCallback, useMemo, useState } from 'react';
import {
  Animated, Easing, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import {
  progressApi,
  STREAK_FREEZE_COST_COINS,
  STREAK_FREEZE_MAX_OWNED,
  type ProgressResponse,
} from '../services/gamificationApi';
import { workoutApi, type WorkoutListItem } from '../services/workoutApi';
import { StreakFreezeModal } from '../components/modals/StreakFreezeModal';

// ─── Chest milestone definitions ─────────────────────────────────
interface ChestMilestone {
  streak: number;
  label: string;
  tier: 'wooden' | 'iron' | 'silver' | 'gold' | 'diamond';
  xp: number;
  coins: number;
  color: string;
}

const CHESTS: ChestMilestone[] = [
  { streak: 7,  label: 'Wooden',  tier: 'wooden',  xp: 50,  coins: 25,  color: '#8B6914' },
  { streak: 14, label: 'Iron',    tier: 'iron',    xp: 100, coins: 50,  color: '#7A7570' },
  { streak: 30, label: 'Silver',  tier: 'silver',  xp: 200, coins: 100, color: '#A8B2BD' },
  { streak: 60, label: 'Gold',    tier: 'gold',    xp: 400, coins: 200, color: '#D4A843' },
  { streak: 90, label: 'Diamond', tier: 'diamond', xp: 750, coins: 500, color: '#6BB8E0' },
];

// ─── SVG Icons ───────────────────────────────────────────────────
function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function IFire({ size = 14, color = Colors.cr }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
    </Svg>
  );
}

function ISnowflake({ size = 28, color = '#7BC4E8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2v20" />
      <Path d="M3.5 7l17 10" />
      <Path d="M3.5 17l17-10" />
      <Path d="M9 4l3 3 3-3" />
      <Path d="M9 20l3-3 3 3" />
      <Path d="M2 9l3 3-3 3" />
      <Path d="M22 9l-3 3 3 3" />
    </Svg>
  );
}

function IChest({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="7" width="20" height="14" rx="2" />
      <Path d="M2 14h20" />
      <Path d="M12 7V4" />
      <Path d="M7 4h10" />
      <Circle cx="12" cy="14" r="1.5" fill={color} stroke="none" />
      <Path d="M12 15.5v2" />
    </Svg>
  );
}

function ILock({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

function ICheck({ size = 14, color = Colors.up }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthRange(): { year: number; month: number }[] {
  const now = new Date();
  const result: { year: number; month: number }[] = [];
  // From January 2026 to current month
  const startYear = 2026;
  const startMonth = 0; // January

  let y = startYear;
  let m = startMonth;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

// ─── Main Screen ─────────────────────────────────────────────────
export default function StreaksScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [freezeOpen, setFreezeOpen] = useState(false);

  // Chest open animation
  const [openedChest, setOpenedChest] = useState<ChestMilestone | null>(null);
  const chestScale = useMemo(() => new Animated.Value(0), []);
  const chestOpacity = useMemo(() => new Animated.Value(0), []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // allSettled so one failed endpoint doesn't blank out the whole screen.
        const [progRes, histRes] = await Promise.allSettled([
          progressApi.get(),
          workoutApi.getHistory(200),
        ]);
        if (cancelled) return;

        if (progRes.status === 'fulfilled') {
          setProgress(progRes.value.data);
        } else {
          console.warn('[streaks] /api/progress failed:', progRes.reason);
        }

        if (histRes.status === 'fulfilled') {
          setWorkoutHistory((histRes.value.data as { items: WorkoutListItem[] }).items ?? []);
        } else {
          console.warn('[streaks] /api/workouts failed:', histRes.reason);
        }

        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, []),
  );

  const streak = progress?.current_streak ?? 0;
  const longest = progress?.longest_streak ?? 0;
  const freezes = progress?.streak_freezes ?? 0;
  const coins = progress?.coins ?? 0;

  const workoutDates = useMemo(() => {
    return new Set(workoutHistory.map(w => w.workout_date));
  }, [workoutHistory]);

  const months = useMemo(() => getMonthRange(), []);

  // Find next chest & earned chests
  const nextChest = CHESTS.find(c => c.streak > streak) ?? null;
  const earnedChests = CHESTS.filter(c => c.streak <= streak);
  const prevChestStreak = earnedChests.length > 0 ? earnedChests[earnedChests.length - 1].streak : 0;

  // Progress to next chest (0-100)
  const chestProgress = nextChest
    ? Math.round(((streak - prevChestStreak) / (nextChest.streak - prevChestStreak)) * 100)
    : 100;

  function openChestAnimation(chest: ChestMilestone) {
    setOpenedChest(chest);
    chestScale.setValue(0);
    chestOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(chestScale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(chestOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }

  function closeChest() {
    Animated.timing(chestOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setOpenedChest(null));
  }

  const todayKey = toKey(new Date());

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={st.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IBack />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Streaks</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* ── Hero: Big streak number ── */}
        <View style={st.hero}>
          <View style={st.heroFireWrap}>
            <IFire size={56} color={Colors.cr} />
          </View>
          <Text style={st.heroNumber}>{streak}</Text>
          <Text style={st.heroLabel}>current streak!</Text>
          <View style={st.heroStatsRow}>
            <View style={st.heroStat}>
              <IFire size={16} color={Colors.cr} />
              <Text style={st.heroStatVal}>{streak}</Text>
              <Text style={st.heroStatLabel}>Earned</Text>
            </View>
            <View style={st.heroStatDivider} />
            <View style={st.heroStat}>
              <IFire size={16} color={Colors.flat} />
              <Text style={st.heroStatVal}>{nextChest ? nextChest.streak - streak : 0}</Text>
              <Text style={st.heroStatLabel}>To Next Chest</Text>
            </View>
          </View>
        </View>

        {/* ── Streak Freeze ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Streak Freeze</Text>
          <TouchableOpacity
            style={st.freezeCard}
            activeOpacity={0.85}
            onPress={() => setFreezeOpen(true)}
          >
            <View style={st.freezeIcon}>
              <ISnowflake size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.freezeTitle}>
                {freezes > 0
                  ? `${freezes} freeze${freezes === 1 ? '' : 's'} ready`
                  : 'Protect your streak'}
              </Text>
              <Text style={st.freezeSub}>
                {freezes >= STREAK_FREEZE_MAX_OWNED
                  ? `Inventory full · ${STREAK_FREEZE_MAX_OWNED}/${STREAK_FREEZE_MAX_OWNED}`
                  : `Skip a day without losing your streak · ${STREAK_FREEZE_COST_COINS} coins each`}
              </Text>
            </View>
            <View style={st.freezeCount}>
              <Text style={st.freezeCountVal}>{freezes}</Text>
              <Text style={st.freezeCountMax}>/{STREAK_FREEZE_MAX_OWNED}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Season Rewards (Chests) ── */}
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Season Rewards</Text>
            <Text style={st.sectionSub}>Best: {longest} days</Text>
          </View>

          {/* Chest progress track */}
          <View style={st.trackWrap}>
            <View style={st.track}>
              {CHESTS.map((chest, i) => {
                const earned = streak >= chest.streak;
                const pct = Math.min(100, Math.max(0,
                  ((streak) / chest.streak) * 100,
                ));
                const leftPct = ((i + 1) / CHESTS.length) * 100;

                return (
                  <View key={chest.tier} style={[st.trackNode, { left: `${leftPct - (100 / CHESTS.length / 2)}%` }]}>
                    <TouchableOpacity
                      onPress={() => earned ? openChestAnimation(chest) : undefined}
                      activeOpacity={earned ? 0.7 : 1}
                      style={[
                        st.chestCircle,
                        earned
                          ? { backgroundColor: chest.color + '20', borderColor: chest.color }
                          : { backgroundColor: Colors.s3, borderColor: Colors.line },
                      ]}
                    >
                      {earned ? (
                        <IChest color={chest.color} size={22} />
                      ) : (
                        <ILock size={16} />
                      )}
                    </TouchableOpacity>
                    <Text style={[st.trackLabel, earned && { color: Colors.t1 }]}>{chest.streak}</Text>
                  </View>
                );
              })}

              {/* Progress bar behind nodes */}
              <View style={st.trackBarBg}>
                <View style={[st.trackBarFill, {
                  width: `${Math.min(100, (streak / CHESTS[CHESTS.length - 1].streak) * 100)}%`,
                }]} />
              </View>
            </View>
          </View>

          {/* Next chest info */}
          {nextChest && (
            <View style={st.nextChestCard}>
              <View style={[st.nextChestIcon, { borderColor: nextChest.color }]}>
                <IChest color={nextChest.color} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.nextChestTitle}>{nextChest.label} Chest</Text>
                <Text style={st.nextChestSub}>
                  {nextChest.streak - streak} more days · +{nextChest.xp} XP · +{nextChest.coins} coins
                </Text>
                <View style={st.nextChestBar}>
                  <View style={[st.nextChestBarFill, {
                    width: `${chestProgress}%`,
                    backgroundColor: nextChest.color,
                  }]} />
                </View>
              </View>
            </View>
          )}

          {/* Earned chests list */}
          {earnedChests.length > 0 && (
            <View style={st.earnedRow}>
              {earnedChests.map(chest => (
                <TouchableOpacity
                  key={chest.tier}
                  style={[st.earnedChip, { borderColor: chest.color + '40' }]}
                  onPress={() => openChestAnimation(chest)}
                  activeOpacity={0.7}
                >
                  <IChest color={chest.color} size={16} />
                  <ICheck size={12} color={chest.color} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Calendar ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Season Calendar</Text>

          {months.map(({ year, month }) => (
            <View key={`${year}-${month}`} style={st.calMonth}>
              <Text style={st.calMonthTitle}>{MONTH_NAMES[month]} {year}</Text>

              {/* Day labels */}
              <View style={st.calRow}>
                {DAY_LABELS.map((d, i) => (
                  <View key={i} style={st.calCell}>
                    <Text style={st.calDayLabel}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Day grid */}
              {renderMonthGrid(year, month, workoutDates, todayKey)}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <StreakFreezeModal
        visible={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        coins={coins}
        owned={freezes}
        onPurchase={(next) => setProgress(next)}
      />

      {/* ── Chest Open Overlay ── */}
      {openedChest && (
        <TouchableOpacity
          style={st.overlay}
          activeOpacity={1}
          onPress={closeChest}
        >
          <Animated.View style={[
            st.chestModal,
            {
              opacity: chestOpacity,
              transform: [{ scale: chestScale }],
            },
          ]}>
            <View style={[st.chestModalIcon, { borderColor: openedChest.color }]}>
              <IChest color={openedChest.color} size={48} />
            </View>
            <Text style={[st.chestModalTitle, { color: openedChest.color }]}>
              {openedChest.label} Chest
            </Text>
            <Text style={st.chestModalSub}>{openedChest.streak}-day streak reward</Text>
            <View style={st.chestRewards}>
              <View style={st.chestRewardItem}>
                <Text style={st.chestRewardVal}>+{openedChest.xp}</Text>
                <Text style={st.chestRewardLabel}>XP</Text>
              </View>
              <View style={st.chestRewardDivider} />
              <View style={st.chestRewardItem}>
                <Text style={st.chestRewardVal}>+{openedChest.coins}</Text>
                <Text style={st.chestRewardLabel}>Coins</Text>
              </View>
            </View>
            <Text style={st.chestTap}>Tap anywhere to close</Text>
          </Animated.View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Calendar grid renderer ──────────────────────────────────────
function renderMonthGrid(
  year: number,
  month: number,
  workoutDates: Set<string>,
  todayKey: string,
) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: React.ReactNode[] = [];
  let cells: React.ReactNode[] = [];

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    cells.push(<View key={`empty-${i}`} style={st.calCell} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = toKey(d);
    const hasWorkout = workoutDates.has(key);
    const isToday = key === todayKey;
    const isFuture = d > today;

    cells.push(
      <View key={key} style={st.calCell}>
        <View style={[
          st.calDay,
          hasWorkout && st.calDayActive,
          isToday && !hasWorkout && st.calDayToday,
          isFuture && st.calDayFuture,
        ]}>
          <Text style={[
            st.calDayNum,
            hasWorkout && st.calDayNumActive,
            isFuture && st.calDayNumFuture,
            isToday && !hasWorkout && st.calDayNumToday,
          ]}>
            {day}
          </Text>
        </View>
      </View>,
    );

    if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
      // Pad trailing cells in last row
      if (day === daysInMonth) {
        const remaining = 7 - cells.length % 7;
        if (remaining < 7) {
          for (let i = 0; i < remaining; i++) {
            cells.push(<View key={`trail-${i}`} style={st.calCell} />);
          }
        }
      }
      rows.push(
        <View key={`row-${rows.length}`} style={st.calRow}>
          {cells}
        </View>,
      );
      cells = [];
    }
  }

  return <>{rows}</>;
}

// ─── Styles ──────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.t1,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    backgroundColor: Colors.cr + '12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.crBdr,
    marginBottom: Spacing.lg,
  },
  heroFireWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.crLo,
    borderWidth: 2,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroNumber: {
    fontSize: 64,
    fontFamily: Fonts.displayBlack,
    color: Colors.bone,
    lineHeight: 72,
    letterSpacing: -2,
  },
  heroLabel: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.t2,
    marginTop: 4,
    marginBottom: Spacing.xl,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    gap: 20,
  },
  heroStat: {
    alignItems: 'center',
    gap: 4,
  },
  heroStatVal: {
    fontSize: 20,
    fontFamily: Fonts.monoBold,
    color: Colors.t1,
    lineHeight: 24,
  },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    color: Colors.t3,
    textTransform: 'uppercase',
  },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.line,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    marginBottom: Spacing.md,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginBottom: Spacing.md,
  },

  // Streak Freeze card
  freezeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(123,196,232,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(123,196,232,0.30)',
    padding: Spacing.lg,
  },
  freezeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(123,196,232,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(123,196,232,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    marginBottom: 3,
  },
  freezeSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    lineHeight: 15,
  },
  freezeCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  freezeCountVal: {
    fontSize: 24,
    fontFamily: Fonts.monoBold,
    color: '#7BC4E8',
    lineHeight: 28,
  },
  freezeCountMax: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    color: Colors.t3,
  },

  // Track
  trackWrap: {
    marginBottom: Spacing.lg,
    paddingTop: 8,
  },
  track: {
    height: 80,
    position: 'relative',
  },
  trackBarBg: {
    position: 'absolute',
    top: 22,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Colors.s3,
    borderRadius: 2,
  },
  trackBarFill: {
    height: 4,
    backgroundColor: Colors.cr,
    borderRadius: 2,
  },
  trackNode: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    transform: [{ translateX: -22 }],
    zIndex: 1,
  },
  chestCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trackLabel: {
    fontSize: 10,
    fontFamily: Fonts.monoBold,
    color: Colors.t3,
  },

  // Next chest card
  nextChestCard: {
    flexDirection: 'row',
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.lg,
    gap: 14,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  nextChestIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextChestTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    marginBottom: 2,
  },
  nextChestSub: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginBottom: 8,
  },
  nextChestBar: {
    height: 6,
    backgroundColor: Colors.s3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  nextChestBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // Earned row
  earnedRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  earnedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.s2,
  },

  // Calendar
  calMonth: {
    marginBottom: Spacing.xl,
  },
  calMonthTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  calCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  calDayLabel: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.t3,
    marginBottom: 4,
  },
  calDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  calDayActive: {
    backgroundColor: Colors.crLo,
    borderWidth: 1.5,
    borderColor: Colors.crBdr,
  },
  calDayToday: {
    borderWidth: 1.5,
    borderColor: Colors.t3,
  },
  calDayFuture: {
    opacity: 0.25,
  },
  calDayNum: {
    fontSize: 13,
    fontFamily: Fonts.monoBold,
    color: Colors.t3,
  },
  calDayNumActive: {
    color: Colors.cr,
  },
  calDayNumFuture: {
    color: Colors.t3,
  },
  calDayNumToday: {
    color: Colors.t1,
  },

  // Chest overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  chestModal: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing['3xl'],
    alignItems: 'center',
    width: 280,
  },
  chestModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  chestModalTitle: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    marginBottom: 4,
  },
  chestModalSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    marginBottom: Spacing.xl,
  },
  chestRewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: Spacing.xl,
  },
  chestRewardItem: {
    alignItems: 'center',
  },
  chestRewardVal: {
    fontSize: 24,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    lineHeight: 28,
  },
  chestRewardLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    color: Colors.t3,
    textTransform: 'uppercase',
  },
  chestRewardDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.line,
  },
  chestTap: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
  },
});
