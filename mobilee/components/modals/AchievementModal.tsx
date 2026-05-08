import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { AchievementIcon } from '../achievement/AchievementIcon';

export interface AchievementEarned {
  id:          string;
  name:        string;
  description: string;
  icon_key:    string;
}

interface Props {
  achievements: AchievementEarned[];
  visible:      boolean;
  onClose:      () => void;
}

export function AchievementModal({ achievements, visible, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const total   = achievements.length;
  const current = achievements[index];

  useEffect(() => {
    if (visible) {
      setIndex(0);
      animateIn();
    }
  }, [visible]);

  function animateIn() {
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function handleNext() {
    if (index < total - 1) {
      setIndex(i => i + 1);
      animateIn();
    } else {
      onClose();
    }
  }

  if (!current) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Text style={s.label}>ACHIEVEMENT UNLOCKED</Text>

          <View style={s.iconWrap}>
            <AchievementIcon
              iconKey={current.icon_key}
              color={Colors.cr}
              size={36}
            />
          </View>

          {total > 1 && (
            <Text style={s.counter}>{index + 1} of {total}</Text>
          )}

          <Text style={s.name}>{current.name}</Text>
          <Text style={s.description}>{current.description}</Text>

          <TouchableOpacity style={s.btn} onPress={handleNext} activeOpacity={0.8}>
            <Text style={s.btnText}>
              {index < total - 1 ? 'Next' : 'Awesome!'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

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
    width: 290,
    shadowColor: Colors.cr,
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 2.4,
    color: Colors.cr,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.crLo,
    borderWidth: 1.5,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  counter: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginBottom: 8,
  },
  name: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: Colors.bone,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
