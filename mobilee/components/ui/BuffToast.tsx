// mobile/components/ui/BuffToast.tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius } from '../../constants/theme';

const PROTEIN = '#9DD49B'; // soft green — same family as Colors.macroProtein
const HOLD_MS = 2600;

interface Props {
  title:   string;
  detail:  string;
  visible: boolean;
  onHide:  () => void;
}

function IShield({ size = 18, color = PROTEIN }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function BuffToast({ title, detail, visible, onHide }: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-100);
    opacity.setValue(0);
    scale.setValue(0.9);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 110, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,    duration: 280, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onHide();
      });
    }, HOLD_MS);

    return () => clearTimeout(exitTimer);
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={s.root}>
      <Animated.View
        style={[
          s.toast,
          { opacity, transform: [{ translateY }, { scale }] },
        ]}
      >
        <View style={s.iconWrap}>
          <IShield size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.detail}>{detail}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(157,212,155,0.35)',
    shadowColor: PROTEIN,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(157,212,155,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(157,212,155,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: PROTEIN,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  detail: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t1,
    lineHeight: 16,
  },
});
