import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';

export interface PRResult {
  exercise_id:     string;
  exercise_name:   string;
  new_1rm:         number;
  previous_1rm:    number | null;
  improvement_pct: number | null;
  weight_kg:       number;
  reps:            number;
}

interface Props {
  prs:     PRResult[];
  visible: boolean;
  onClose: () => void;
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

  const isFirst = current.improvement_pct === null || current.improvement_pct === undefined;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Text style={s.label}>NEW PERSONAL RECORD</Text>

          <View style={s.trophyWrap}>
            <Text style={s.trophyEmoji}>🏆</Text>
          </View>

          {total > 1 && (
            <Text style={s.counter}>{index + 1} of {total}</Text>
          )}

          <Text style={s.exerciseName}>{current.exercise_name}</Text>

          <Text style={s.lift}>
            {current.weight_kg} kg × {current.reps}
          </Text>

          {isFirst ? (
            <Text style={s.firstRecord}>First record on this exercise!</Text>
          ) : (
            <View style={s.improvementWrap}>
              <Text style={s.improvementPct}>
                +{current.improvement_pct}% estimated 1RM
              </Text>
              <Text style={s.previousVal}>
                Previous: {current.previous_1rm?.toFixed(1)} kg 1RM
              </Text>
            </View>
          )}

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
    backgroundColor: 'rgba(0,0,0,0.75)',
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
  trophyWrap: {
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
  trophyEmoji: {
    fontSize: 32,
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
    marginBottom: 10,
  },
  lift: {
    fontSize: 28,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
    marginBottom: 14,
  },
  firstRecord: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    textAlign: 'center',
    marginBottom: 24,
  },
  improvementWrap: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  improvementPct: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.up,
  },
  previousVal: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t2,
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
