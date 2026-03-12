// mobile/components/ui/Input.tsx
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius } from '../../../mobilee/constants/theme';

interface InputProps extends TextInputProps {
  label?:       string;
  error?:       string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...rest }: InputProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={Colors.t3}
        selectionColor={Colors.cr}
        autoCapitalize="none"
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    color: Colors.t3,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.s3,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.t1,
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  inputError: {
    borderColor: Colors.cr,
  },
  error: {
    fontSize: 12,
    color: Colors.cr,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
});