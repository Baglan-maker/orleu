import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { MlTrend } from '../../services/gamificationApi';

const TREND_COLOR: Record<MlTrend, string> = {
  improving: Colors.up,
  plateau:   Colors.flat,
  declining: Colors.dn,
};

const TREND_LABEL: Record<MlTrend, string> = {
  improving: 'IMPROVING',
  plateau:   'PLATEAU',
  declining: 'DECLINING',
};

// What the ML adaptation did, in plain language.
const EXPLAIN: Record<MlTrend, { title: string; body: string }> = {
  improving: {
    title: "You're improving",
    body:  'Your coach analysed your last 2 weeks of training. You’re trending up, so mission targets are raised about 15% to keep the challenge meaningful.',
  },
  plateau: {
    title: 'Progress has flattened',
    body:  'Your numbers have stalled. Targets stay steady and we surface fresh missions to help you break through the plateau.',
  },
  declining: {
    title: 'Time to recover',
    body:  'Your training has dipped recently. Targets are eased about 20% so it’s easy to get back on track.',
  },
};

function IBrain({ color }: { color: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z"/>
      <Path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z"/>
    </Svg>
  );
}

interface Props {
  visible:   boolean;
  trend:     MlTrend | null;
  coachText: string | null;
  onClose:   () => void;
}

export function MlInsightModal({ visible, trend, coachText, onClose }: Props) {
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

  if (!trend) return null;
  const color = TREND_COLOR[trend];
  const info  = EXPLAIN[trend];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }], borderColor: `${color}55` }]}>
          <View style={[s.iconWrap, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
            <IBrain color={color}/>
          </View>
          <Text style={s.label}>COACH UPDATE</Text>

          <View style={[s.trendPill, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
            <Text style={[s.trendPillText, { color }]}>{TREND_LABEL[trend]}</Text>
          </View>

          <Text style={s.title}>{info.title}</Text>
          <Text style={s.body}>{info.body}</Text>

          {coachText ? (
            <View style={s.quoteWrap}>
              <Text style={s.quoteText}>“{coachText}”</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[s.btn, { backgroundColor: color }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>Got it</Text>
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
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  iconWrap: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  label: {
    fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 2.6,
    color: Colors.t2, textTransform: 'uppercase', marginBottom: 12,
  },
  trendPill: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, marginBottom: 14,
  },
  trendPillText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1 },
  title: {
    fontSize: 20, fontFamily: Fonts.displayBold, color: Colors.t1,
    textAlign: 'center', marginBottom: 10, letterSpacing: -0.3,
  },
  body: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.t2,
    textAlign: 'center', lineHeight: 20, marginBottom: 18,
  },
  quoteWrap: {
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20, width: '100%',
  },
  quoteText: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.bone,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 19,
  },
  btn: {
    borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 48,
  },
  btnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.3 },
});
