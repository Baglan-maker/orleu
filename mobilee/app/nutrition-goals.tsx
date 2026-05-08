// mobile/app/nutrition-goals.tsx
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { useNutritionStore, type NutritionGoals } from '../store/nutritionStore';

function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6"/>
    </Svg>
  );
}

interface GoalField {
  key:   keyof NutritionGoals;
  label: string;
  unit:  string;
  color: string;
}

const FIELDS: GoalField[] = [
  { key: 'calories',  label: 'Calories',  unit: 'kcal', color: Colors.cr           },
  { key: 'protein_g', label: 'Protein',   unit: 'g',    color: Colors.macroProtein },
  { key: 'carbs_g',   label: 'Carbs',     unit: 'g',    color: Colors.macroCarbs   },
  { key: 'fat_g',     label: 'Fat',       unit: 'g',    color: Colors.macroFat     },
];

export default function NutritionGoalsScreen() {
  const router = useRouter();
  const { goals, loadGoals, updateGoals } = useNutritionStore();

  const [values, setValues] = useState({
    calories:  String(goals?.calories  ?? 2000),
    protein_g: String(goals?.protein_g ?? 150),
    carbs_g:   String(goals?.carbs_g   ?? 250),
    fat_g:     String(goals?.fat_g     ?? 70),
  });
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!goals) loadGoals();
  }, []);

  // When goals load from the API, populate inputs
  useEffect(() => {
    if (goals) {
      setValues({
        calories:  String(goals.calories),
        protein_g: String(goals.protein_g),
        carbs_g:   String(goals.carbs_g),
        fat_g:     String(goals.fat_g),
      });
    }
  }, [goals]);

  function setField(key: keyof NutritionGoals, val: string) {
    setValues(prev => ({ ...prev, [key]: val.replace(/[^0-9]/g, '') }));
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    const payload: NutritionGoals = {
      calories:  parseInt(values.calories)  || 2000,
      protein_g: parseInt(values.protein_g) || 150,
      carbs_g:   parseInt(values.carbs_g)   || 250,
      fat_g:     parseInt(values.fat_g)     || 70,
    };

    setSaving(true);
    setError(null);
    try {
      await updateGoals(payload);
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch {
      setError('Failed to save goals. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IBack/>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Nutrition Goals</Text>
          <View style={{ width: 36 }}/>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.note}>
            These are targets, not limits. Adjust based on your goals.
          </Text>

          <View style={s.fieldsCard}>
            {FIELDS.map((field, i) => (
              <View key={field.key} style={[s.fieldRow, i > 0 && s.fieldRowBorder]}>
                <View style={[s.colorDot, { backgroundColor: field.color }]}/>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{field.label}</Text>
                  <Text style={s.fieldUnit}>{field.unit} per day</Text>
                </View>
                <TextInput
                  style={s.fieldInput}
                  keyboardType="number-pad"
                  value={values[field.key]}
                  onChangeText={(v) => setField(field.key, v)}
                  selectTextOnFocus
                  maxLength={5}
                />
              </View>
            ))}
          </View>

          {/* Calorie estimate from macros */}
          <View style={s.estimateCard}>
            <Text style={s.estimateLabel}>ESTIMATED FROM MACROS</Text>
            <Text style={s.estimateValue}>
              {Math.round(
                (parseInt(values.protein_g) || 0) * 4 +
                (parseInt(values.carbs_g)   || 0) * 4 +
                (parseInt(values.fat_g)     || 0) * 9
              )} kcal
            </Text>
            <Text style={s.estimateNote}>
              (protein × 4 + carbs × 4 + fat × 9)
            </Text>
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <Button
            label={saved ? 'Saved!' : saving ? 'Saving...' : 'Save goals'}
            onPress={handleSave}
            disabled={saving || saved}
            loading={saving}
            style={s.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.t1 },

  note: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },

  fieldsCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  fieldRowBorder: { borderTopWidth: 1, borderTopColor: Colors.line },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  fieldLabel: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1 },
  fieldUnit:  { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 1 },
  fieldInput: {
    width: 80,
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: Colors.t1,
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    textAlign: 'center',
  },

  estimateCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  estimateLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  estimateValue: { fontSize: 28, fontFamily: Fonts.monoBold, color: Colors.bone },
  estimateNote:  { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 4 },

  errorText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.cr, textAlign: 'center', marginBottom: 12 },
  saveBtn:   { marginTop: 4 },
});
