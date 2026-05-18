import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

const MUSCLE_COLORS: Record<string, string> = {
  chest:     Colors.cr,
  back:      '#4A7FC1',
  legs:      Colors.up,
  shoulders: '#D4A843',
  arms:      '#7C5BB5',
  core:      '#B87C3A',
  cardio:    Colors.flat,
};

const MUSCLE_LABELS: Record<string, string> = {
  chest:     'Chest',
  back:      'Back',
  legs:      'Legs',
  shoulders: 'Shoulders',
  arms:      'Arms',
  core:      'Core',
  cardio:    'Cardio',
};

export interface MuscleItem {
  group: string;
  volume: number;
  pct: number;
  color: string;
}

interface Props {
  data: MuscleItem[];
}

export function MuscleDistribution({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>Muscles Hit</Text>
        <Text style={st.subtitle}>Last 7 days</Text>
      </View>

      {/* Stacked bar */}
      <View style={st.barContainer}>
        {data.map((m, i) => (
          <View
            key={m.group}
            style={[
              st.barSegment,
              {
                flex: m.pct,
                backgroundColor: m.color,
                borderTopLeftRadius: i === 0 ? 6 : 0,
                borderBottomLeftRadius: i === 0 ? 6 : 0,
                borderTopRightRadius: i === data.length - 1 ? 6 : 0,
                borderBottomRightRadius: i === data.length - 1 ? 6 : 0,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend grid */}
      <View style={st.legend}>
        {data.map(m => (
          <View key={m.group} style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: m.color }]} />
            <Text style={st.legendLabel}>{MUSCLE_LABELS[m.group] ?? m.group}</Text>
            <Text style={st.legendPct}>{m.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function buildMuscleData(
  exercises: { muscle_group: string; total_volume: number }[],
): MuscleItem[] {
  const map: Record<string, number> = {};
  for (const ex of exercises) {
    const g = (ex.muscle_group || 'other').toLowerCase();
    map[g] = (map[g] || 0) + (ex.total_volume || 0);
  }

  const total = Object.values(map).reduce((s, v) => s + v, 0);
  if (total === 0) return [];

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([group, volume]) => ({
      group,
      volume,
      pct: Math.round((volume / total) * 100),
      color: MUSCLE_COLORS[group] ?? Colors.t3,
    }));
}

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
  subtitle: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  barContainer: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
    marginBottom: Spacing.lg,
  },
  barSegment: { minWidth: 6 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    marginRight: 4,
  },
  legendPct: {
    fontSize: 12,
    fontFamily: Fonts.monoBold,
    color: Colors.t1,
  },
});
