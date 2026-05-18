import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, RegisterData } from '../../store/authStore';
import { Colors, Fonts, Spacing, Radius, CHARACTERS, getCharacterImage } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Input  } from '../../components/ui/Input';
import { validateEmail, validatePassword, getPasswordStrength } from '../../services/validation';

// Степы регистрации: 0 = credentials, 1 = avatar + goals
type Step = 0 | 1;

// Password validation checklist item
function PasswordCheck({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={styles.checkItem}>
      <View style={[styles.checkBox, checked && styles.checkBoxDone]}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        )}
      </View>
      <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>{label}</Text>
    </View>
  );
}

const EXPERIENCE = [
  { value: 'beginner',     label: 'Beginner',     sub: 'Less than 1 year' },
  { value: 'intermediate', label: 'Intermediate', sub: '1–3 years'        },
  { value: 'advanced',     label: 'Advanced',     sub: '3+ years'         },
] as const;

const GOALS = [
  { value: 'strength',     label: 'Strength'     },
  { value: 'hypertrophy',  label: 'Hypertrophy'  },
  { value: 'endurance',    label: 'Endurance'    },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error, clearError } = useAuthStore();

  const [step, setStep] = useState<Step>(0);

  // Step 0
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Step 1
  const [avatarId,    setAvatarId]    = useState(0);
  const [experience,  setExperience]  = useState<string>('beginner');
  const [goal,        setGoal]        = useState<string>('strength');

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailVal = validateEmail(email);
  const passwordVal = validatePassword(password);
  const passwordStrength = getPasswordStrength(passwordVal);

  function validateStep0() {
    const errs: Record<string, string> = {};
    if (!name.trim())        errs.name = 'Name is required';
    if (!emailVal.valid)     errs.email = emailVal.error || 'Invalid email';
    if (!passwordVal.valid)  errs.password = 'Password must have 6+ chars, uppercase & lowercase';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    clearError();
    if (validateStep0()) setStep(1);
  }

  async function handleRegister() {
    clearError();
    setLoading(true);
    const data: RegisterData = {
      name:             name.trim(),
      email:            email.trim().toLowerCase(),
      password,
      avatar_theme_id:  avatarId,
      experience_level: experience,
      primary_goal:     goal,
    };
    try {
      await register(data);
      // auth guard редиректит автоматически
    } catch {
      // ошибка в store
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {step === 1 && (
              <TouchableOpacity onPress={() => setStep(0)} style={styles.backBtn}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              {step === 0 ? 'Create account' : 'Set up profile'}
            </Text>
            {/* Step indicator */}
            <View style={styles.steps}>
              {[0, 1].map(i => (
                <View key={i} style={[
                  styles.stepDot,
                  step === i && styles.stepDotActive,
                  step > i  && styles.stepDotDone,
                ]}/>
              ))}
            </View>
          </View>

          {/* ── Step 0: Credentials ── */}
          {step === 0 && (
            <View>
              <Input
                label="Name"
                placeholder="Your name"
                value={name}
                onChangeText={t => { setName(t); setFieldErrors(e => ({...e, name: ''})); }}
                error={fieldErrors.name}
                textContentType="name"
              />

              {/* Email with inline validation */}
              <View style={styles.inputBlock}>
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={t => { setEmail(t); setFieldErrors(e => ({...e, email: ''})); }}
                  error={fieldErrors.email}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                {email.length > 0 && emailVal.valid && (
                  <View style={styles.validIcon}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 6L9 17l-5-5" stroke="#6B9E6B" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                )}
              </View>

              {/* Password with strength indicator */}
              <View style={styles.passwordBlock}>
                <Input
                  label="Password"
                  placeholder="Min. 6 characters, uppercase & lowercase"
                  value={password}
                  onChangeText={t => { setPassword(t); setFieldErrors(e => ({...e, password: ''})); }}
                  error={fieldErrors.password}
                  secureTextEntry
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>

              {password.length > 0 && (
                <View style={styles.strengthBlock}>
                  {/* Strength bar */}
                  <View style={styles.strengthBarBg}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        {
                          width: `${((passwordStrength.score + 1) / 5) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>

                  {/* Checklist */}
                  <View style={styles.checklist}>
                    <PasswordCheck label="6+ characters" checked={passwordVal.minLength} />
                    <PasswordCheck label="Uppercase letter" checked={passwordVal.hasUppercase} />
                    <PasswordCheck label="Lowercase letter" checked={passwordVal.hasLowercase} />
                  </View>
                </View>
              )}

              <Button
                label="Next →"
                onPress={goNext}
                disabled={!name.trim() || !emailVal.valid || !passwordVal.valid}
                style={{ marginTop: 24 }}
              />
            </View>
          )}

          {/* ── Step 1: Avatar + Goals ── */}
          {step === 1 && (
            <View>
              {/* Character picker */}
              <Text style={styles.sectionLabel}>CHOOSE YOUR CHARACTER</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.charScrollContent}
                style={styles.charScroll}
              >
                {CHARACTERS.map(c => {
                  const selected = avatarId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setAvatarId(c.id)}
                      style={[styles.charCard, selected && styles.charCardSelected]}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={getCharacterImage(c.id, 0)}
                        style={styles.charPreview}
                      />
                      <Text style={[styles.charName, selected && { color: Colors.cr }]}>
                        {c.name}
                      </Text>
                      {selected && <View style={styles.charCheckDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Experience */}
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EXPERIENCE LEVEL</Text>
              {EXPERIENCE.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setExperience(opt.value)}
                  style={[
                    styles.optionRow,
                    experience === opt.value && styles.optionRowActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.radio,
                    experience === opt.value && styles.radioActive,
                  ]}>
                    {experience === opt.value && <View style={styles.radioDot}/>}
                  </View>
                  <View>
                    <Text style={[
                      styles.optionLabel,
                      experience === opt.value && { color: Colors.t1 },
                    ]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionSub}>{opt.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Primary goal */}
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PRIMARY GOAL</Text>
              <View style={styles.goalRow}>
                {GOALS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setGoal(opt.value)}
                    style={[
                      styles.goalChip,
                      goal === opt.value && styles.goalChipActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.goalLabel,
                      goal === opt.value && { color: Colors.cr },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button
                label="Start your ascent"
                loading={loading}
                onPress={handleRegister}
                style={{ marginTop: 24 }}
              />
            </View>
          )}

          {/* Switch to login */}
          {step === 0 && (
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.switchText}>
                Already training? <Text style={styles.switchLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: 56, paddingBottom: 40 },

  header: { marginBottom: 32 },
  backBtn:  { marginBottom: 12 },
  backText: { fontSize: 14, color: Colors.t3, fontFamily: Fonts.regular },
  title:    { fontSize: 28, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, marginBottom: 16 },

  steps:        { flexDirection: 'row', gap: 6 },
  stepDot:      { width: 24, height: 3, borderRadius: 99, backgroundColor: Colors.s4 },
  stepDotActive:{ backgroundColor: Colors.cr },
  stepDotDone:  { backgroundColor: Colors.up },

  sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.t3, marginBottom: 10 },

  // Email & Password validation
  inputBlock: { position: 'relative', marginBottom: 16 },
  validIcon: {
    position: 'absolute',
    right: 12,
    top: 30,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(107,158,107,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordBlock: { marginBottom: 12 },

  // Password strength
  strengthBlock: { marginBottom: 16 },
  strengthBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.s3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  checklist: { gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.s4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxDone: { borderColor: Colors.up, backgroundColor: 'rgba(107,158,107,0.1)' },
  checkLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3 },
  checkLabelDone: { color: Colors.up, fontFamily: Fonts.semiBold },

  // ── Character picker — horizontal scroll, scales to N characters ──
  charScroll: {
    marginHorizontal: -Spacing.xxl, // bleed to screen edges
  },
  charScrollContent: {
    paddingHorizontal: Spacing.xxl,
    gap: 12,
  },
  charCard: {
    width: 130, alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 8,
    backgroundColor: Colors.s3, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.line,
  },
  charCardSelected: {
    borderColor: Colors.cr, backgroundColor: Colors.crLo,
  },
  charPreview: {
    width: 100, height: 100, resizeMode: 'contain',
  },
  charName: {
    fontSize: 11, fontFamily: Fonts.bold, color: Colors.t2,
    letterSpacing: 0.8, marginTop: 8, textTransform: 'uppercase',
  },
  charCheckDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cr,
  },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.s2, borderRadius: Radius.md,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.line,
  },
  optionRowActive: { borderColor: Colors.crBdr, backgroundColor: Colors.crLo },
  radio:        { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.t3, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: Colors.cr },
  radioDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cr },
  optionLabel:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t2, marginBottom: 2 },
  optionSub:    { fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3 },

  goalRow:      { flexDirection: 'row', gap: 8 },
  goalChip:     { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  goalChipActive:{ borderColor: Colors.crBdr, backgroundColor: Colors.crLo },
  goalLabel:    { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t3 },

  errorBox: { backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, borderRadius: 12, padding: 12, marginTop: 8 },
  errorText:{ color: Colors.cr, fontSize: 13, fontFamily: Fonts.regular },

  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText:{ fontSize: 13, fontFamily: Fonts.regular, color: Colors.t3 },
  switchLink:{ color: Colors.cr, fontFamily: Fonts.semiBold },
});