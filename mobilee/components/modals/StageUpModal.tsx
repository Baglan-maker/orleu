import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts, Radius, AvatarThemes, getCharacterImage, type AvatarThemeId, type AvatarStage } from '../../constants/theme';

const STAGE_NAMES: Record<AvatarStage, string> = {
  0: 'Rookie',
  1: 'Active',
  2: 'Athlete',
  3: 'Champion',
  4: 'Legend',
};

const STAGE_MSGS: Record<AvatarStage, string> = {
  0: '',
  1: "You're picking up momentum.",
  2: 'Your form is evolving.',
  3: 'The champions take notice.',
  4: 'You have reached the pinnacle.',
};

interface Props {
  visible:  boolean;
  stage:    AvatarStage;
  themeId:  AvatarThemeId;
  onClose:  () => void;
}

// Orbiting particle — purely decorative
function Particle({ angle, radius, color, delay }: {
  angle: number; radius: number; color: string; delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1, duration: 2400, delay,
        easing: Easing.linear, useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${angle}deg`, `${angle + 360}deg`] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: radius * 2,
        height: radius * 2,
        top: '50%',
        left: '50%',
        marginLeft: -radius,
        marginTop: -radius,
        transform: [{ rotate }],
        opacity,
      }}
    >
      <View style={{ position: 'absolute', top: 0, left: radius - 3 }}>
        <Svg width={6} height={6}>
          <Circle cx={3} cy={3} r={3} fill={color} />
        </Svg>
      </View>
    </Animated.View>
  );
}

export function StageUpModal({ visible, stage, themeId, onClose }: Props) {
  const scale   = useRef(new Animated.Value(0.55)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const avatarY = useRef(new Animated.Value(24)).current;

  const color = AvatarThemes[themeId].color;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.55);
    opacity.setValue(0);
    avatarY.setValue(24);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(avatarY, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>

          {/* Orbiting particles */}
          <Particle angle={0}   radius={68} color={color} delay={0}   />
          <Particle angle={120} radius={68} color={color} delay={800} />
          <Particle angle={240} radius={68} color={color} delay={1600}/>

          <Text style={s.eyebrow}>STAGE UNLOCKED</Text>

          <Animated.View style={[s.avatarWrap, { transform: [{ translateY: avatarY }] }]}>
            <Image source={getCharacterImage(themeId, stage)} style={s.characterImg} />
          </Animated.View>

          <Text style={[s.stageName, { color }]}>{STAGE_NAMES[stage]}</Text>
          {STAGE_MSGS[stage] ? (
            <Text style={s.sub}>{STAGE_MSGS[stage]}</Text>
          ) : null}

          <TouchableOpacity
            style={[s.btn, { backgroundColor: color }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={s.btnText}>Ascend</Text>
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
    borderWidth: 1.5,
    borderColor: '#4A7FC1',
    padding: 36,
    alignItems: 'center',
    width: 300,
    overflow: 'hidden',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 3,
    color: Colors.t3,
    textTransform: 'uppercase',
    marginBottom: 4,
    zIndex: 1,
  },
  avatarWrap: {
    marginVertical: 12,
    zIndex: 1,
  },
  characterImg: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  stageName: {
    fontSize: 36,
    fontFamily: Fonts.displayBold,
    letterSpacing: -1,
    marginBottom: 6,
    zIndex: 1,
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 20,
    zIndex: 1,
  },
  btn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 52,
    zIndex: 1,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
});
