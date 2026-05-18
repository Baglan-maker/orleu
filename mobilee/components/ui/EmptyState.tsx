import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface EmptyStateProps {
  /** Optional leading visual — typically an icon node from the calling screen. */
  icon?:    ReactNode;
  title:    string;
  message:  string;
  /** When provided, renders a primary button below the message. */
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?:   ViewStyle;
}

export function EmptyState({ icon, title, message, ctaLabel, onCtaPress, style }: EmptyStateProps) {
  return (
    <View style={[s.root, style]}>
      {icon && <View style={s.iconWrap}>{icon}</View>}
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
      {ctaLabel && onCtaPress && (
        <TouchableOpacity style={s.cta} onPress={onCtaPress} activeOpacity={0.8}>
          <Text style={s.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.s3,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  cta: {
    marginTop: Spacing.md,
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    letterSpacing: 0.4,
    color: Colors.cr,
  },
});
