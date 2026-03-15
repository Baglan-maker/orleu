// mobile/app/history.tsx
/**
 * Workout History — список прошлых тренировок.
 * Данные: GET /api/workouts (пагинация)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { workoutApi, WorkoutListItem, WorkoutListResponse } from '../services/workoutApi';

// ─── Icons ────────────────────────────────────────────────────────
function IBack()     { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="15 18 9 12 15 6"/></Svg>; }
function IDumbbell() { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }
function IClock()    { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><Polyline points="12 6 12 12 16 14"/></Svg>; }

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function WorkoutCard({ workout }: { workout: WorkoutListItem }) {
  return (
    <View style={s.card}>
      {/* Date + duration */}
      <View style={s.cardHead}>
        <Text style={s.cardDate}>{formatDate(workout.workout_date)}</Text>
        {workout.duration_minutes != null && (
          <View style={s.durationRow}>
            <IClock/>
            <Text style={s.durationText}>{workout.duration_minutes} min</Text>
          </View>
        )}
      </View>

      {/* Stats footer */}
      <View style={s.cardFoot}>
        <View style={s.statPill}>
          <IDumbbell/>
          <Text style={s.statText}>{workout.total_exercises} exercises</Text>
        </View>
        {workout.total_volume > 0 && (
          <View style={s.statPill}>
            <Text style={s.statText}>{workout.total_volume.toFixed(0)} kg vol</Text>
          </View>
        )}
      </View>

      {workout.notes ? (
        <Text style={s.notes} numberOfLines={2}>{workout.notes}</Text>
      ) : null}
    </View>
  );
}

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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IBack/>
        </TouchableOpacity>
        <View>
          <Text style={s.lbl}>All time</Text>
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
          renderItem={({ item }) => <WorkoutCard workout={item}/>}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchWorkouts(0, true)}
              tintColor={Colors.cr}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No workouts yet</Text>
              <Text style={s.emptySub}>Log your first session to see it here</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && workouts.length > 0
              ? <ActivityIndicator size="small" color={Colors.t3} style={{ paddingVertical: 16 }}/>
              : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.s1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', textAlign: 'center' },
  pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, textAlign: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:  { backgroundColor: Colors.s3, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: Colors.line },
  retryText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },

  list: { padding: Spacing.lg, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardDate: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  durationText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  exList: { gap: 5, marginBottom: 12 },
  exRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.t3 },
  exName: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2 },
  exSets: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  moreText: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 2, marginLeft: 12 },

  cardFoot: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 4 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.s3, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.line,
  },
  statText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  notes: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 10, lineHeight: 18 },

  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.t2, marginBottom: 6 },
  emptySub:   { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t3 },
});
