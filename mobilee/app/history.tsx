// mobile/app/history.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator, Animated, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { workoutApi, type WorkoutListItem, type WorkoutListResponse } from '../services/workoutApi';

// ─── Icons ────────────────────────────────────────────────────────
function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6"/>
    </Svg>
  );
}
function IDumbbell() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/>
      <Line x1="4" y1="9" x2="7.5" y2="9"/>
      <Line x1="4" y1="15" x2="7.5" y2="15"/>
      <Line x1="16.5" y1="9" x2="20" y2="9"/>
      <Line x1="16.5" y1="15" x2="20" y2="15"/>
      <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
    </Svg>
  );
}
function IClock() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 6v6l4 2"/>
    </Svg>
  );
}
function IChevron() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}
function IFlame() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2c.5 3.5-1.5 6-1.5 6s2 1.5 2 4c0 2.5-2 4-4 4s-3-1.5-3-3.5c0-2 1.5-3.5 1.5-3.5s-1 2 1 3c.5-1 .5-2 0-3-.5-1.5-1-3 0-5C9 2 11 1 12 2z"/>
    </Svg>
  );
}
function ITrend() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.up} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <Polyline points="16 7 22 7 22 13"/>
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(d);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

function formatVolume(vol: number): string {
  return vol >= 1000
    ? `${(vol / 1000).toFixed(1).replace(/\.0$/, '')}k kg`
    : `${vol.toFixed(0)} kg`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === yesterday.toISOString().split('T')[0];
}

function getRelativeDay(dateStr: string): string | null {
  if (isToday(dateStr)) return 'Today';
  if (isYesterday(dateStr)) return 'Yesterday';
  return null;
}

// ─── Volume sparkline (inline SVG mini chart) ─────────────────────
function VolumeSparkline({ volumes }: { volumes: number[] }) {
  if (volumes.length < 2) return null;
  const maxV = Math.max(...volumes, 1);
  const W = 60;
  const H = 20;
  const step = W / (volumes.length - 1);

  const points = volumes
    .map((v, i) => `${i * step},${H - (v / maxV) * (H - 2)}`)
    .join(' ');

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polyline
        points={points}
        fill="none"
        stroke={Colors.cr}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── All-time stats banner ────────────────────────────────────────
function AllTimeStats({
  total, totalVolume, avgVolume,
}: { total: number; totalVolume: number; avgVolume: number }) {
  if (total === 0) return null;
  return (
    <View style={s.statsBanner}>
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{total}</Text>
          <Text style={s.statLbl}>sessions</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{formatVolume(totalVolume)}</Text>
          <Text style={s.statLbl}>total volume</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{formatVolume(avgVolume)}</Text>
          <Text style={s.statLbl}>avg / session</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Workout card ─────────────────────────────────────────────────
function WorkoutCard({ workout, onPress, rank, recentVolumes }: {
  workout: WorkoutListItem;
  onPress: () => void;
  rank: number;
  recentVolumes: number[];
}) {
  const relDay = getRelativeDay(workout.workout_date);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350,
      delay: Math.min(rank * 60, 300),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({
      inputRange: [0, 1], outputRange: [12, 0],
    }) }] }}>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
        {/* Top row: date + sparkline + chevron */}
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <View style={s.dateRow}>
              {relDay && (
                <View style={s.relDayChip}>
                  <Text style={s.relDayTxt}>{relDay}</Text>
                </View>
              )}
              <Text style={[s.cardDate, relDay ? s.cardDateSub : undefined]}>
                {relDay ? formatDateShort(workout.workout_date) : formatDate(workout.workout_date)}
              </Text>
            </View>
          </View>
          <View style={s.headRight}>
            {workout.duration_minutes != null && (
              <View style={s.durationRow}>
                <IClock/>
                <Text style={s.durationText}>{workout.duration_minutes}m</Text>
              </View>
            )}
            <IChevron/>
          </View>
        </View>

        {/* Volume highlight + stats */}
        <View style={s.cardBody}>
          <View style={s.volBlock}>
            <IFlame />
            <Text style={s.volVal}>
              {workout.total_volume >= 1000
                ? `${(workout.total_volume / 1000).toFixed(1).replace(/\.0$/, '')}k`
                : Math.round(workout.total_volume)}
            </Text>
            <Text style={s.volUnit}>kg</Text>
          </View>

          <View style={s.cardStats}>
            <View style={s.miniStat}>
              <IDumbbell />
              <Text style={s.miniStatTxt}>
                {workout.total_exercises} exercise{workout.total_exercises !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {recentVolumes.length >= 2 && (
            <VolumeSparkline volumes={recentVolumes} />
          )}
        </View>

        {/* Notes preview */}
        {workout.notes ? (
          <Text style={s.notes} numberOfLines={1}>{workout.notes}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none"
          stroke={Colors.t3} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/>
          <Line x1="4" y1="9" x2="7.5" y2="9"/>
          <Line x1="4" y1="15" x2="7.5" y2="15"/>
          <Line x1="16.5" y1="9" x2="20" y2="9"/>
          <Line x1="16.5" y1="15" x2="20" y2="15"/>
          <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
        </Svg>
      </View>
      <Text style={s.emptyTitle}>No workouts yet</Text>
      <Text style={s.emptySub}>Complete your first session{'\n'}and it will appear here</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const [workouts,     setWorkouts]     = useState<WorkoutListItem[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const fetchWorkouts = useCallback(async (offset = 0, refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else if (offset === 0) setIsLoading(true);

    try {
      const { data } = await workoutApi.getHistory(15, offset);
      const resp = data as unknown as WorkoutListResponse;
      const list = resp.items ?? [];
      if (refresh || offset === 0) {
        setWorkouts(list);
      } else {
        setWorkouts(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 15);
      setError(null);
    } catch {
      setError('Could not load workouts. Check your connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchWorkouts(0); }, [fetchWorkouts]);

  function loadMore() {
    if (!hasMore || isLoading) return;
    fetchWorkouts(workouts.length);
  }

  // Compute all-time stats from loaded workouts
  const totalVolume = workouts.reduce((a, w) => a + w.total_volume, 0);
  const avgVolume = workouts.length > 0 ? totalVolume / workouts.length : 0;

  // Build volume array for sparkline (most recent last)
  const volumesByDate = workouts.slice(0, 8).map(w => w.total_volume).reverse();

  // Get a sliding window of recent volumes for each card
  function getRecentVolumes(index: number): number[] {
    const end = Math.min(index + 5, workouts.length);
    return workouts.slice(index, end).map(w => w.total_volume).reverse();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IBack/>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerLbl}>ALL TIME</Text>
          <Text style={s.pageTitle}>History</Text>
        </View>
        <View style={{ width: 36 }}/>
      </View>

      {isLoading && workouts.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.cr}/>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchWorkouts(0)} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={w => w.id}
          renderItem={({ item, index }) => (
            <WorkoutCard
              workout={item}
              rank={index}
              recentVolumes={getRecentVolumes(index)}
              onPress={() => router.push(`/workout/${item.id}` as any)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AllTimeStats
              total={workouts.length}
              totalVolume={totalVolume}
              avgVolume={avgVolume}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchWorkouts(0, true)}
              tintColor={Colors.cr}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={
            hasMore && workouts.length > 0
              ? <ActivityIndicator size="small" color={Colors.t3} style={{ paddingVertical: 16 }}/>
              : workouts.length > 0
                ? <Text style={s.endTxt}>That's all your sessions</Text>
                : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.s1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  headerLbl: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.8,
    color: Colors.t3, textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 22, fontFamily: Fonts.displayBold,
    color: Colors.t1, letterSpacing: -0.5, textAlign: 'center',
  },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:  { backgroundColor: Colors.s3, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: Colors.line },
  retryText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },

  list: { padding: Spacing.lg, gap: 10, paddingBottom: 40 },

  // All-time stats banner
  statsBanner: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    padding: 16, marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  statItem: {
    flex: 1, alignItems: 'center',
  },
  statNum: {
    fontSize: 17, fontFamily: Fonts.monoBold, color: Colors.bone,
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1,
    color: Colors.t3, textTransform: 'uppercase',
  },
  statDivider: {
    width: 1, height: 28,
    backgroundColor: Colors.line,
  },

  // Workout card
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    padding: 14,
  },
  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  relDayChip: {
    backgroundColor: Colors.crLo,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.crBdr,
  },
  relDayTxt: {
    fontSize: 10, fontFamily: Fonts.bold, color: Colors.cr,
    letterSpacing: 0.5,
  },
  cardDate: {
    fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1,
  },
  cardDateSub: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2,
  },
  headRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  durationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  durationText: {
    fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3,
  },

  // Card body
  cardBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  volBlock: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
  },
  volVal: {
    fontSize: 20, fontFamily: Fonts.monoBold, color: Colors.bone,
  },
  volUnit: {
    fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3,
  },
  cardStats: {
    flex: 1,
  },
  miniStat: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  miniStatTxt: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t2,
  },

  notes: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3,
    marginTop: 8, lineHeight: 17,
  },

  // Empty state
  empty: {
    alignItems: 'center', paddingTop: 60, gap: 10,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18, fontFamily: Fonts.bold, color: Colors.t2,
  },
  emptySub: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.t3,
    textAlign: 'center', lineHeight: 20,
  },

  // End of list
  endTxt: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3,
    textAlign: 'center', paddingVertical: 20,
  },
});
