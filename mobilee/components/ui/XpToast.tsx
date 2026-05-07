// mobile/components/ui/XpToast.tsx
/**
 * Animated XP gain toast that appears at the top after a workout.
 * - Slides down with spring overshoot
 * - Number counts up from 0 → N
 * - Shimmer sweeps across the badge
 * - Sparkle particles fly outward
 * - Holds ~1.4s, then slides up & fades out
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../../constants/theme';

interface Props {
  xp:       number;
  visible:  boolean;
  onHide:   () => void;
}

const HOLD_MS = 2000;

function IZap() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Svg>
  );
}

// Sparkle particle that flies outward and fades
function Sparkle({ angle, delay, parentVisible }: { angle: number; delay: number; parentVisible: boolean }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (parentVisible) {
      t.setValue(0);
      Animated.timing(t, {
        toValue: 1,
        duration: 700,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [parentVisible, delay]);

  const dist = 40;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const opacity    = t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const scale      = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1, 0.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.sparkle,
        { opacity, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

export function XpToast({ xp, visible, onHide }: Props) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.85)).current;
  const shimmerX   = useRef(new Animated.Value(-1)).current;
  const counter    = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!visible) return;

    // Reset everything
    translateY.setValue(-80);
    opacity.setValue(0);
    scale.setValue(0.85);
    shimmerX.setValue(-1);
    counter.setValue(0);
    setDisplayed(0);

    // Listen to counter and update text
    const listenerId = counter.addListener(({ value }) => {
      setDisplayed(Math.round(value));
    });

    // ENTER: slide down + fade in + scale pop
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      ]),
      // Number count-up
      Animated.timing(counter, {
        toValue: xp,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,  // text content
      }),
      // Shimmer sweep across the badge
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 700,
        delay: 200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // EXIT after hold
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 280, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onHide();
      });
    }, HOLD_MS);

    return () => {
      clearTimeout(exitTimer);
      counter.removeListener(listenerId);
    };
  }, [visible, xp]);

  if (!visible) return null;

  // Shimmer position: -1 → 1 maps to translateX -120 → 120
  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-140, 140],
  });

  // 8 sparkles around the toast
  const sparkleAngles = [0, 45, 90, 135, 180, 225, 270, 315].map(d => (d * Math.PI) / 180);

  return (
    <View pointerEvents="none" style={s.root}>
      <Animated.View
        style={[
          s.toast,
          { opacity, transform: [{ translateY }, { scale }] },
        ]}
      >
        {/* Sparkles container — overlay around the badge */}
        <View pointerEvents="none" style={s.sparkleField}>
          {sparkleAngles.map((angle, i) => (
            <Sparkle key={i} angle={angle} delay={150 + i * 30} parentVisible={visible}/>
          ))}
        </View>

        {/* Shimmer line that sweeps across */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.shimmer,
            { transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }] },
          ]}
        />

        <View style={s.iconWrap}>
          <IZap/>
        </View>
        <Text style={s.label}>+{displayed}</Text>
        <Text style={s.unit}>XP</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.s2,
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.crBdr,
    shadowColor: Colors.cr,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    letterSpacing: -0.3,
    minWidth: 44,
    textAlign: 'right',
  },
  unit: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.cr,
    letterSpacing: 1.6,
    marginTop: 2,
  },
  shimmer: {
    position: 'absolute',
    top: -10,
    left: 0,
    width: 30,
    height: 80,
    backgroundColor: 'rgba(232, 224, 212, 0.18)',
  },
  sparkleField: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
  },
  sparkle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.cr,
    shadowColor: Colors.cr,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
