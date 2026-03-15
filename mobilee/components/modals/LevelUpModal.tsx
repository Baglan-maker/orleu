// mobile/components/modals/LevelUpModal.tsx
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../../constants/theme';

function IStar() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill={Colors.bone} stroke="none">
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </Svg>
  );
}

interface Props {
  visible:  boolean;
  level:    number;
  xpGained: number;
  onClose:  () => void;
}

export function LevelUpModal({ visible, level, xpGained, onClose }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <View style={s.iconWrap}>
            <IStar/>
          </View>
          <Text style={s.label}>LEVEL UP</Text>
          <Text style={s.level}>{level}</Text>
          <Text style={s.sub}>You're getting stronger</Text>
          <View style={s.xpBadge}>
            <Text style={s.xpText}>+{xpGained} XP earned</Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.btnText}>Continue</Text>
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
    borderColor: Colors.crBdr,
    padding: 36,
    alignItems: 'center',
    width: 290,
    shadowColor: Colors.cr,
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.crLo,
    borderWidth: 1.5,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 2.8,
    color: Colors.cr,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  level: {
    fontSize: 80,
    fontFamily: Fonts.displayBold,
    color: Colors.t1,
    letterSpacing: -5,
    lineHeight: 84,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    marginBottom: 22,
  },
  xpBadge: {
    backgroundColor: Colors.s3,
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: 26,
  },
  xpText: {
    fontSize: 13,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
  },
  btn: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 44,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
