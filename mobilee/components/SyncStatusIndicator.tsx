// mobile/components/SyncStatusIndicator.tsx
/**
 * Маленький бейдж, показывающий кол-во несинкнутых тренировок.
 * Показывается только когда pendingCount > 0.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../constants/theme';

function ICloud() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={Colors.flat} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      <Polyline points="16 16 12 12 8 16"/>
    </Svg>
  );
}

interface Props {
  pendingCount: number;
}

export function SyncStatusIndicator({ pendingCount }: Props) {
  if (pendingCount === 0) return null;

  return (
    <View style={s.badge}>
      <ICloud/>
      <Text style={s.text}>{pendingCount}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.flat}12`,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${Colors.flat}25`,
  },
  text: {
    fontSize: 10,
    fontFamily: Fonts.monoBold,
    color: Colors.flat,
  },
});
