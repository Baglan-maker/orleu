import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';
import Svg, { Path, Polyline } from 'react-native-svg';

export interface PRResult {
  exercise_id:   string;
  exercise_name: string;
  new_weight:    number;
  prev_weight:   number;
  delta:         number;
}

interface Props {
  prs:     PRResult[];
  visible: boolean;
  onClose: () => void;
}

function TrophyIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
      <Path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <Path d="M12 17v4"/>
      <Path d="M8 21h8"/>
      <Path d="M6 3h12v8a6 6 0 0 1-12 0V3z"/>
    </Svg>
  );
}

export function PRModal({ prs, visible, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const total   = prs.length;
  const current = prs[index];

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
          <Text style={s.label}>WEIGHT RECORD</Text>

          <View style={s.iconWrap}>
            <TrophyIcon />
          </View>

          {total > 1 && (
            <Text style={s.counter}>{index + 1} of {total}</Text>
          )}

          <Text style={s.exerciseName}>{current.exercise_name}</Text>

          <Text style={s.weight}>{current.new_weight} kg</Text>

          <View style={s.deltaRow}>
            <Text style={s.deltaText}>
              +{current.delta} kg from previous best
            </Text>
          </View>

          <TouchableOpacity style={s.btn} onPress={handleNext} activeOpacity={0.8}>
            <Text style={s.btnText}>
              {index < total - 1 ? 'Next' : 'Keep it up!'}
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
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    color: Colors.cr,
    textTransform: 'uppercase',
    marginBottom: 20,
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
    marginBottom: 14,
  },
  counter: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 22,
    fontFamily: Fonts.displayBold,
    color: Colors.bone,
    textAlign: 'center',
    marginBottom: 12,
  },
  weight: {
    fontSize: 36,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    marginBottom: 10,
  },
  deltaRow: {
    marginBottom: 28,
  },
  deltaText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.up,
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
