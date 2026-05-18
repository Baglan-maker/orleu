// mobile/app/achievements.tsx
import { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
  SafeAreaView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { useAchievementStore } from '../store/achievementStore';
import { AchievementIcon } from '../components/achievement/AchievementIcon';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_key: string;
  condition_type: string;
  condition_value: number;
  rarity: 'common' | 'rare' | 'epic';
  earned?: boolean;
  earned_at?: string;
}

function IChevronLeft() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6"/>
    </Svg>
  );
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'epic': return '#FFD700';
    case 'rare': return '#9DD49B';
    case 'common':
    default: return Colors.line;
  }
}

function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'epic': return 'EPIC';
    case 'rare': return 'RARE';
    case 'common':
    default: return 'COMMON';
  }
}

function getConditionText(conditionType: string, conditionValue: number): string {
  switch (conditionType) {
    case 'streak_days': return `Maintain a ${conditionValue}-day streak`;
    case 'total_sessions': return `Complete ${conditionValue} workouts`;
    case 'missions_completed': return `Complete ${conditionValue} missions`;
    default: return `Reach ${conditionValue} ${conditionType}`;
  }
}

export default function AchievementsScreen() {
  const router = useRouter();
  const { achievements, fetchAchievements } = useAchievementStore();
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAchievements().finally(() => setLoading(false));
    }, [fetchAchievements])
  );

  const earnedAch = achievements.filter(a => a.earned);
  const lockedAch = achievements.filter(a => !a.earned);

  // Sort by rarity (epic → rare → common)
  const rarityOrder = { epic: 0, rare: 1, common: 2 };
  const sortedEarned = [...earnedAch].sort((a, b) =>
    (rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 2) -
    (rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 2)
  );
  const sortedLocked = [...lockedAch].sort((a, b) =>
    (rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 2) -
    (rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 2)
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <IChevronLeft />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Achievements</Text>
          <Text style={s.subtitle}>{earnedAch.length} / {achievements.length}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Earned Section */}
        {sortedEarned.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>UNLOCKED ({sortedEarned.length})</Text>
            {sortedEarned.map(ach => (
              <View
                key={ach.id}
                style={[s.achCard, { borderColor: getRarityColor(ach.rarity) }]}
              >
                <View style={[s.achCardIcon, { backgroundColor: Colors.crLo }]}>
                  <AchievementIcon iconKey={ach.icon_key} color={Colors.cr} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={s.achCardName}>{ach.name}</Text>
                    <Text style={[s.rarityBadge, { color: getRarityColor(ach.rarity), borderColor: getRarityColor(ach.rarity) }]}>
                      {getRarityLabel(ach.rarity)}
                    </Text>
                  </View>
                  <Text style={s.achCardDesc}>{ach.description}</Text>
                  {ach.earned_at && (
                    <Text style={s.achCardDate}>
                      Unlocked on {new Date(ach.earned_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Locked Section */}
        {sortedLocked.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>LOCKED ({sortedLocked.length})</Text>
            {sortedLocked.map(ach => (
              <View
                key={ach.id}
                style={[s.achCard, s.achCardLocked, { borderColor: getRarityColor(ach.rarity) }]}
              >
                <View style={[s.achCardIcon, { backgroundColor: Colors.s3 }]}>
                  <AchievementIcon iconKey={ach.icon_key} color={Colors.t3} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={s.achCardName}>{ach.name}</Text>
                    <Text style={[s.rarityBadge, { color: getRarityColor(ach.rarity), borderColor: getRarityColor(ach.rarity) }]}>
                      {getRarityLabel(ach.rarity)}
                    </Text>
                  </View>
                  <Text style={s.achCardDesc}>{ach.description}</Text>
                  <Text style={s.achCardHow}>
                    <Text style={s.achCardHowBold}>How to unlock: </Text>
                    {getConditionText(ach.condition_type, ach.condition_value)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.s1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  backBtn: {
    marginRight: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.6,
    color: Colors.t3,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  achCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  achCardLocked: {
    opacity: 0.6,
  },
  achCardIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  achCardName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
  },
  rarityBadge: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  achCardDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    marginBottom: 6,
    lineHeight: 16,
  },
  achCardDate: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    fontStyle: 'italic',
  },
  achCardHow: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    lineHeight: 15,
  },
  achCardHowBold: {
    fontFamily: Fonts.semiBold,
    color: Colors.t2,
  },
});
