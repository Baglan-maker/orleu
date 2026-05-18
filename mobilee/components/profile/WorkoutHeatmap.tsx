import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface WorkoutDay {
  id: string;
  workout_date: string;
  duration_minutes: number | null;
  total_exercises: number;
  total_volume: number;
}

interface Props {
  workouts: WorkoutDay[];
  onViewAll: () => void;
  onViewWorkout: (id: string) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function fmtVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WorkoutHeatmap({ workouts, onViewAll, onViewWorkout }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { prevWeek, currWeek, workoutMap, todayKey } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;

    const currMonday = new Date(now);
    currMonday.setDate(now.getDate() + mondayOffset);

    const prevMonday = new Date(currMonday);
    prevMonday.setDate(currMonday.getDate() - 7);

    const makeDays = (start: Date) =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
      });

    const map: Record<string, WorkoutDay[]> = {};
    for (const w of workouts) {
      const key = w.workout_date;
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }

    return {
      prevWeek: makeDays(prevMonday),
      currWeek: makeDays(currMonday),
      workoutMap: map,
      todayKey: toKey(now),
    };
  }, [workouts]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedWorkouts = selectedDate ? workoutMap[selectedDate] ?? [] : [];

  function renderDay(date: Date) {
    const key = toKey(date);
    const isFuture = date > today;
    const isToday = key === todayKey;
    const hasWorkout = !isFuture && (workoutMap[key]?.length ?? 0) > 0;
    const isSelected = selectedDate === key;

    return (
      <TouchableOpacity
        key={key}
        style={[
          st.dayCell,
          hasWorkout && st.dayCellActive,
          isToday && !hasWorkout && st.dayCellToday,
          isToday && hasWorkout && st.dayCellTodayActive,
          isFuture && st.dayCellFuture,
          isSelected && st.dayCellSelected,
        ]}
        onPress={() => {
          if (!isFuture && hasWorkout) {
            setSelectedDate(isSelected ? null : key);
          }
        }}
        activeOpacity={hasWorkout ? 0.7 : 1}
      >
        <Text style={[
          st.dayNum,
          hasWorkout && st.dayNumActive,
          isFuture && st.dayNumFuture,
          isToday && !hasWorkout && st.dayNumToday,
        ]}>
          {date.getDate()}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>Workouts</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7} hitSlop={8}>
          <Text style={st.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={st.row}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={st.dayLabelCell}>
            <Text style={st.dayLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Previous week */}
      <View style={st.row}>{prevWeek.map(renderDay)}</View>

      {/* Current week */}
      <View style={[st.row, { marginBottom: 0 }]}>{currWeek.map(renderDay)}</View>

      {/* Selected day detail */}
      {selectedWorkouts.length > 0 && (
        <View style={st.detailSection}>
          {selectedWorkouts.map(w => (
            <TouchableOpacity
              key={w.id}
              style={st.detailCard}
              onPress={() => onViewWorkout(w.id)}
              activeOpacity={0.7}
            >
              <View style={st.detailDot} />
              <View style={{ flex: 1 }}>
                <Text style={st.detailDate}>{formatDate(w.workout_date)}</Text>
                <Text style={st.detailSub}>
                  {w.duration_minutes ?? 0}m · {w.total_exercises} exercises · {fmtVol(w.total_volume)} kg
                </Text>
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Polyline points="9 18 15 12 9 6" />
              </Svg>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const CELL = 40;

const st = StyleSheet.create({
  container: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  seeAll: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.cr },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayLabelCell: { width: CELL, alignItems: 'center', marginBottom: 2 },
  dayLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: Colors.t3 },

  dayCell: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayCellActive: {
    backgroundColor: Colors.crLo,
    borderColor: Colors.crBdr,
  },
  dayCellToday: {
    borderColor: Colors.t3,
  },
  dayCellTodayActive: {
    backgroundColor: Colors.crLo,
    borderColor: Colors.cr,
  },
  dayCellFuture: {
    backgroundColor: 'transparent',
    opacity: 0.3,
  },
  dayCellSelected: {
    borderColor: Colors.cr,
    borderWidth: 2,
  },

  dayNum: { fontSize: 13, fontFamily: Fonts.monoBold, color: Colors.t3 },
  dayNumActive: { color: Colors.cr },
  dayNumFuture: { color: Colors.t3 },
  dayNumToday: { color: Colors.t1 },

  detailSection: { marginTop: Spacing.md, gap: 6 },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: 10,
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cr,
  },
  detailDate: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  detailSub: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
});
