// mobile/components/workout/RestTimerOverlay.tsx
/**
 * Floating rest-timer pill rendered at the app root so the countdown is
 * visible on any screen — profile, missions, stats, etc.
 *
 * Hidden when:
 *  - Timer isn't running
 *  - User is currently inside the workout-log modal (the inline widget
 *    there already shows the countdown — avoid duplicate UI)
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors, Fonts, Radius } from '../../constants/theme';
import { useRestTimerStore } from '../../store/restTimerStore';

function IClock({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 6v6l4 2"/>
    </Svg>
  );
}

export function RestTimerOverlay() {
  const insets    = useSafeAreaInsets();
  const running   = useRestTimerStore(s => s.running);
  const enabled   = useRestTimerStore(s => s.enabled);
  const inWorkout = useRestTimerStore(s => s.inWorkout);
  const duration  = useRestTimerStore(s => s.duration);
  const remaining = useRestTimerStore(s => s.remaining);
  const skip      = useRestTimerStore(s => s.skip);

  const visible = running && enabled && !inWorkout;

  // Slide-in / slide-out animation
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : -80,
        tension: 80, friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  // Pulsing glow as time runs out (last 25% of duration)
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const m   = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const pct = duration > 0 ? remaining / duration : 0;
  const tone = pct > 0.5 ? Colors.up : pct > 0.25 ? Colors.flat : Colors.cr;

  // Don't even mount when fully hidden — saves Animated subscriptions
  // but we still need to render during the slide-out, so guard on a tiny grace.
  if (!visible && remaining === 0) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[s.root, { top: insets.top + 8, opacity, transform: [{ translateY }] }]}
    >
      <Animated.View style={[s.pill, { borderColor: tone, transform: [{ scale: pulse }] }]}>
        <TouchableOpacity
          onPress={skip}
          activeOpacity={0.85}
          style={s.touch}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        >
          <IClock color={tone}/>
          <Text style={s.label}>REST</Text>
          <Text style={[s.time, { color: tone }]}>
            {m}:{String(sec).padStart(2, '0')}
          </Text>
          <Text style={s.skip}>skip</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  pill: {
    backgroundColor: Colors.s2,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  touch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.6,
    color: Colors.t3,
  },
  time: {
    fontSize: 16,
    fontFamily: Fonts.monoBold,
    letterSpacing: -0.4,
    minWidth: 46,
    textAlign: 'center',
  },
  skip: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.4,
    color: Colors.t2,
    textTransform: 'uppercase',
  },
});
