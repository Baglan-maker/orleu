// mobile/components/ui/Card.tsx
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../../mobilee/constants/theme';

interface CardProps {
  children:  React.ReactNode;
  variant?:  'default' | 'crimson' | 'bone';
  style?:    ViewStyle;
}

export function Card({ children, variant = 'default', style }: CardProps) {
  return (
    <View style={[
      s.base,
      variant === 'crimson' && s.crimson,
      variant === 'bone'    && s.bone,
      style,
    ]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  crimson: {
    backgroundColor: Colors.crLo,
    borderColor: Colors.crBdr,
  },
  bone: {
    backgroundColor: Colors.boneLo,
    borderColor: Colors.boneMid,
  },
});