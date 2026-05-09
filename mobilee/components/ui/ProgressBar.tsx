// mobile/components/ui/ProgressBar.tsx
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
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
}

export function ProgressBar({
  value, color = Colors.cr, height = 4,
  showLabel, leftText, rightText, style, paceMarker,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const pace = paceMarker != null ? Math.max(0, Math.min(100, paceMarker)) : null;

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
          <View style={[s.fill, { width: `${pct}%`, backgroundColor: color, height }]}/>
        </View>
        {pace != null && (
          <View style={[s.pace, { left: `${pace}%`, height: height + 4, top: -2 }]}/>
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
    width: 2,
    backgroundColor: 'rgba(232, 224, 212, 0.55)',
    borderRadius: 1,
  },
});