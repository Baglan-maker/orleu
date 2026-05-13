// mobile/components/ui/ProgressBar.tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius } from '../../../mobilee/constants/theme';

interface ProgressBarProps {
  value:       number;   // 0–100
  color?:      string;
  height?:     number;
  showLabel?:  boolean;
  leftText?:   string;
  rightText?:  string;
  style?:      ViewStyle;
  /** Optional 0–100 pace target rendered as a vertical line on the track. */
  paceMarker?: number;
  /** When true, value changes tween smoothly (default: true). */
  animated?:   boolean;
}

export function ProgressBar({
  value, color = Colors.cr, height = 4,
  showLabel, leftText, rightText, style, paceMarker,
  animated = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const pace = paceMarker != null ? Math.max(0, Math.min(100, paceMarker)) : null;

  // Animate the fill width on value change so adding food feels like a
  // health/stamina bar filling, not a snap.
  const animPct = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    if (!animated) {
      animPct.setValue(pct);
      return;
    }
    Animated.timing(animPct, {
      toValue:  pct,
      duration: 550,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: false, // width % can't run on native driver
    }).start();
  }, [pct, animated, animPct]);

  const widthStyle = animPct.interpolate({
    inputRange:  [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={style}>
      {(leftText || rightText) && (
        <View style={s.row}>
          {leftText  && <Text style={s.sideText}>{leftText}</Text>}
          {rightText && <Text style={[s.sideText, { color: pct > 65 ? Colors.up : Colors.t3 }]}>{rightText}</Text>}
        </View>
      )}
      <View style={s.trackWrap}>
        <View style={[s.track, { height }]}>
          <Animated.View style={[s.fill, { width: widthStyle, backgroundColor: color, height }]}/>
        </View>
        {pace != null && (
          <View style={[s.pace, { left: `${pace}%`, height: height + 6, top: -3 }]}/>
        )}
      </View>
      {showLabel && (
        <Text style={s.pctLabel}>{pct}%</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  trackWrap: { position: 'relative' },
  track:    { backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: Radius.full, overflow: 'hidden' },
  fill:     { borderRadius: Radius.full },
  row:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sideText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  pctLabel: { fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 4, textAlign: 'right' },
  pace:     {
    position: 'absolute',
    width: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
    // Subtle outer glow so the tick reads as a marker over any bar color.
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 2,
  },
});
