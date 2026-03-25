// mobile/app/onboarding.tsx
/**
 * Onboarding — 3 слайда при первом входе.
 * По окончании → POST /api/auth/me (обновить onboarding_done) → (tabs)
 */
import { useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

const { width: W } = Dimensions.get('window');

// ─── Slides ───────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    emoji: '🏋️',
    title: 'Log Every Rep',
    subtitle: 'Track your sets, reps, and weight. Build a complete history of your training.',
    accent: Colors.cr,
  },
  {
    id: '2',
    emoji: '🎯',
    title: 'Complete Missions',
    subtitle: 'Weekly AI-powered missions adapt to your progress. The harder you train, the tougher the challenge.',
    accent: Colors.flat,
  },
  {
    id: '3',
    emoji: '📈',
    title: 'Watch Yourself Grow',
    subtitle: 'Your AI coach analyzes your data and gives you real insights — not generic advice.',
    accent: Colors.up,
  },
];

// ─── Icons ────────────────────────────────────────────────────────
function IArrow() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}
function ICheck() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [current, setCurrent] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const listRef = useRef<FlatList>(null);

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
      // Обновить onboarding_done на сервере
      await api.patch('/api/auth/me', { onboarding_done: true });
      if (user) setUser({ ...user, onboarding_done: true });
    } catch {
      // Если запрос не прошёл — всё равно пускаем в приложение
    } finally {
      router.replace('/(tabs)');
    }
  }

  const isLast = current === SLIDES.length - 1;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Slides */}
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
            <View style={[s.emojiWrap, { backgroundColor: `${item.accent}12`, borderColor: `${item.accent}25` }]}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === current
                ? { backgroundColor: Colors.cr, width: 20 }
                : { backgroundColor: Colors.s4 },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={s.footer}>
        {!isLast && (
          <TouchableOpacity style={s.skipBtn} onPress={finish}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: SLIDES[current].accent }]}
          onPress={goNext}
          activeOpacity={0.8}
          disabled={finishing}
        >
          {isLast ? (
            <>
              <Text style={s.nextText}>Get Started</Text>
              <ICheck/>
            </>
          ) : (
            <>
              <Text style={s.nextText}>Next</Text>
              <IArrow/>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.s1 },

  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl + 8,
    paddingBottom: 80,
  },
  emojiWrap: {
    width: 110,
    height: 110,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 36,
  },
  emoji:    { fontSize: 50 },
  title:    { fontSize: 30, fontFamily: Fonts.displayBold, color: Colors.t1, textAlign: 'center', letterSpacing: -0.8, marginBottom: 16, lineHeight: 36 },
  subtitle: { fontSize: 16, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center', lineHeight: 26 },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
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
    paddingBottom: Spacing.xxl,
    gap: 12,
  },
  skipBtn: {
    paddingHorizontal: 16,
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
