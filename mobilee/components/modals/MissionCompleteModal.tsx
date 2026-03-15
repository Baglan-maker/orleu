// mobile/components/modals/MissionCompleteModal.tsx
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../../constants/theme';

function ICheck() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}

function IZap() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.bone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Svg>
  );
}

function ICoin() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10"/>
      <Polyline points="12 6 12 12 16 14"/>
    </Svg>
  );
}

interface Props {
  visible:      boolean;
  missionName:  string;
  xpGained:     number;
  coinsGained?: number;
  onClose:      () => void;
}

export function MissionCompleteModal({ visible, missionName, xpGained, coinsGained = 0, onClose }: Props) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          {/* Icon */}
          <View style={s.iconWrap}>
            <ICheck/>
          </View>

          <Text style={s.label}>MISSION COMPLETE</Text>
          <Text style={s.name}>{missionName}</Text>
          <Text style={s.sub}>Keep the momentum going</Text>

          {/* Rewards row */}
          <View style={s.rewardsRow}>
            <View style={s.rewardBadge}>
              <IZap/>
              <Text style={s.rewardText}>+{xpGained} XP</Text>
            </View>
            {coinsGained > 0 && (
              <View style={[s.rewardBadge, s.coinBadge]}>
                <ICoin/>
                <Text style={[s.rewardText, { color: Colors.flat }]}>+{coinsGained}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.btnText}>Claim Reward</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,8,9,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: `${Colors.up}30`,
    padding: 32,
    alignItems: 'center',
    width: 290,
    shadowColor: Colors.up,
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 14,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${Colors.up}12`,
    borderWidth: 1.5,
    borderColor: `${Colors.up}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 2.5,
    color: Colors.up,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  name: {
    fontSize: 20,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    marginBottom: 22,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 26,
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
    backgroundColor: Colors.up,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
