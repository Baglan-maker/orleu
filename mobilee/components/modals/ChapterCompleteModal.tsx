// mobile/components/modals/ChapterCompleteModal.tsx
/**
 * Celebration modal when the user completes a campaign chapter.
 * - Big chapter number with scale-in animation
 * - "+N XP" and "+N coins" reward badges
 * - Special variant when the entire campaign is complete
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../../constants/theme';

interface Props {
  visible:           boolean;
  chapterNumber:     number;
  xp:                number;
  coins:             number;
  campaignComplete?: boolean;
  onClose:           () => void;
}

function IBookOpen() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </Svg>
  );
}

function ICrown() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 6l5 6 5-8 5 8 5-6-2 13H4z"/>
    </Svg>
  );
}

function IZap() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={Colors.bone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Svg>
  );
}

function ICoin() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={Colors.flat} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10"/>
      <Polyline points="12 6 12 12 16 14"/>
    </Svg>
  );
}

// Outward-radiating ray for celebration effect
function Ray({ angle, parentVisible, delay }: { angle: number; parentVisible: boolean; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (parentVisible) {
      t.setValue(0);
      Animated.timing(t, {
        toValue: 1,
        duration: 900,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [parentVisible, delay]);

  const dist = 75;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const opacity    = t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  const scale      = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1, 0.5] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.ray,
        { opacity, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

export function ChapterCompleteModal({
  visible,
  chapterNumber,
  xp,
  coins,
  campaignComplete = false,
  onClose,
}: Props) {
  const cardScale  = useRef(new Animated.Value(0.65)).current;
  const overlayOp  = useRef(new Animated.Value(0)).current;
  const numberPop  = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    cardScale.setValue(0.65);
    overlayOp.setValue(0);
    numberPop.setValue(0);
    ringRotate.setValue(0);

    Animated.parallel([
      Animated.timing(overlayOp, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(numberPop, { toValue: 1, tension: 90, friction: 6, useNativeDriver: true }),
      ]),
      // Slow rotating ring behind the number
      Animated.loop(
        Animated.timing(ringRotate, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]).start();
  }, [visible]);

  const numberScale = numberPop.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.4, 1.15, 1],
  });
  const numberOpacity = numberPop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });

  const ringSpin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 12 rays around the chapter number
  const rays = Array.from({ length: 12 }, (_, i) => (i * 30 * Math.PI) / 180);

  const isFinal = campaignComplete;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: overlayOp }]}>
        <Animated.View style={[s.card, { transform: [{ scale: cardScale }] }]}>
          {/* Top icon */}
          <View style={s.iconWrap}>
            {isFinal ? <ICrown/> : <IBookOpen/>}
          </View>

          <Text style={s.label}>
            {isFinal ? 'CAMPAIGN COMPLETE' : 'CHAPTER COMPLETE'}
          </Text>

          {/* Chapter number with rotating ring + rays */}
          <View style={s.numberWrap}>
            <Animated.View
              style={[s.ring, { transform: [{ rotate: ringSpin }] }]}
              pointerEvents="none"
            />
            <View style={s.raysField} pointerEvents="none">
              {rays.map((angle, i) => (
                <Ray key={i} angle={angle} parentVisible={visible} delay={180 + i * 25}/>
              ))}
            </View>
            <Animated.Text
              style={[
                s.chapterNum,
                { opacity: numberOpacity, transform: [{ scale: numberScale }] },
              ]}
            >
              {isFinal ? '★' : chapterNumber}
            </Animated.Text>
          </View>

          <Text style={s.sub}>
            {isFinal
              ? 'Every chapter conquered. The next saga awaits.'
              : 'Your story continues. New challenges ahead.'}
          </Text>

          {/* Rewards */}
          <View style={s.rewardsRow}>
            <View style={s.rewardBadge}>
              <IZap/>
              <Text style={s.rewardText}>+{xp} XP</Text>
            </View>
            {coins > 0 && (
              <View style={[s.rewardBadge, s.coinBadge]}>
                <ICoin/>
                <Text style={[s.rewardText, { color: Colors.flat }]}>+{coins}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>{isFinal ? 'Begin Next Saga' : 'Continue'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const RING_SIZE = 130;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    padding: 32,
    alignItems: 'center',
    width: 300,
    shadowColor: Colors.cr,
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.crLo,
    borderWidth: 1.5,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 2.6,
    color: Colors.cr,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  numberWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.crBdr,
    borderTopColor: Colors.cr,
    borderRightColor: 'transparent',
    borderBottomColor: Colors.crBdr,
    borderLeftColor: 'transparent',
  },
  raysField: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  ray: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cr,
    shadowColor: Colors.cr,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  chapterNum: {
    fontSize: 76,
    fontFamily: Fonts.displayBold,
    color: Colors.bone,
    letterSpacing: -3,
    lineHeight: 80,
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    textAlign: 'center',
    paddingHorizontal: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.s3,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  coinBadge: {
    borderColor: `${Colors.flat}25`,
    backgroundColor: `${Colors.flat}0A`,
  },
  rewardText: {
    fontSize: 13,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
  },
  btn: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 38,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
