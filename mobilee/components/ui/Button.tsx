// mobile/components/ui/Button.tsx
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius } from '../../../mobilee/constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  label:    string;
  variant?: 'primary' | 'ghost' | 'dashed';
  loading?: boolean;
  style?:   ViewStyle;
}

export function Button({ label, variant = 'primary', loading, style, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'ghost'   && styles.ghost,
        variant === 'dashed'  && styles.dashed,
        isDisabled && { opacity: 0.55 },
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.82}
      {...rest}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.t2} size="small"/>
        : <Text style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'ghost'   && styles.labelGhost,
            variant === 'dashed'  && styles.labelDashed,
          ]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: Colors.cr,
    shadowColor: Colors.cr,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  ghost: {
    backgroundColor: Colors.s3,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  dashed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.line,
    borderStyle: 'dashed',
  },
  label: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  labelPrimary: {
    color: '#fff',
    fontFamily: Fonts.bold,
  },
  labelGhost: {
    color: Colors.t2,
    fontFamily: Fonts.semiBold,
  },
  labelDashed: {
    color: Colors.t2,
    fontFamily: Fonts.semiBold,
  },
});