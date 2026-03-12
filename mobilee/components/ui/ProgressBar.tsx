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
}

export function ProgressBar({
  value, color = Colors.cr, height = 4,
  showLabel, leftText, rightText, style,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <View style={style}>
      {(leftText || rightText) && (
        <View style={s.row}>
          {leftText  && <Text style={s.sideText}>{leftText}</Text>}
          {rightText && <Text style={[s.sideText, { color: pct > 65 ? Colors.up : Colors.t3 }]}>{rightText}</Text>}
        </View>
      )}
      <View style={[s.track, { height }]}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: color, height }]}/>
      </View>
      {showLabel && (
        <Text style={s.pctLabel}>{pct}%</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  track:    { backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: Radius.full, overflow: 'hidden' },
  fill:     { borderRadius: Radius.full },
  row:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sideText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  pctLabel: { fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 4, textAlign: 'right' },
});