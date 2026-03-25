// mobile/app/(tabs)/nutrition.tsx
import React, { useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FoodSearchModal, type FoodLogData } from '../../components/nutrition/FoodSearchModal';
import {
  useNutritionStore,
  localDateISO,
  type MealType,
  type NutritionLogEntry,
} from '../../store/nutritionStore';

// ─── Icons ────────────────────────────────────────────────────────
function IChevronLeft() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6"/>
    </Svg>
  );
}
function IChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}
function IPlus({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19"/>
      <Line x1="5" y1="12" x2="19" y2="12"/>
    </Svg>
  );
}
function ITrash() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6"/>
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <Path d="M10 11v6M14 11v6"/>
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
  { key: 'snacks',    label: 'Snacks'    },
];

function formatDate(iso: string): string {
  const today = localDateISO();
  if (iso === today) return 'Today';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

function pct(value: number, goal: number): number {
  if (!goal) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

function macroRatio(kcal: number, p: number, c: number, f: number): { p: number; c: number; f: number } {
  const total = p * 4 + c * 4 + f * 9;
  if (!total || !kcal) return { p: 0, c: 0, f: 0 };
  return {
    p: Math.round((p * 4 / total) * 100),
    c: Math.round((c * 4 / total) * 100),
    f: Math.round((f * 9 / total) * 100),
  };
}

// ─── Component ───────────────────────────────────────────────────
export default function NutritionScreen() {
  const {
    todayData, goals, selectedDate, isLoading,
    loadDay, loadGoals, logFood, removeLog, setDate, syncPending,
  } = useNutritionStore();

  const [modalMeal, setModalMeal]   = useState<MealType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await syncPending();
        if (!cancelled) {
          // Read current selectedDate from store state (not closure) to avoid
          // stale-value issues. setDate already calls loadDay on user navigation,
          // so this only fires on focus, not on every date change.
          const current = useNutritionStore.getState().selectedDate;
          await Promise.all([loadDay(current), loadGoals()]);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // ── Date navigation ───────────────────────────────────────────
  const isToday   = selectedDate === localDateISO();
  const canGoNext = !isToday;

  function goBack()    { setDate(shiftDate(selectedDate, -1)); }
  function goForward() { if (canGoNext) setDate(shiftDate(selectedDate, 1)); }
  function goToday()   { if (!isToday) setDate(localDateISO()); }

  // ── Add food ─────────────────────────────────────────────────
  async function handleAddFood(data: FoodLogData) {
    await logFood(selectedDate, data.mealType, data.foodItem.id, data.quantityG);
  }

  // ── Remove food ───────────────────────────────────────────────
  function confirmDelete(entry: NutritionLogEntry) {
    Alert.alert(
      'Remove entry',
      `Remove "${entry.food_item.name}" from log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setDeletingId(entry.id);
            await removeLog(entry.id);
            setDeletingId(null);
          },
        },
      ]
    );
  }

  // ── Derived values ────────────────────────────────────────────
  const data = todayData;
  const g    = goals;

  const totalCal   = data?.calories  ?? 0;
  const totalPro   = data?.protein_g ?? 0;
  const totalCarb  = data?.carbs_g   ?? 0;
  const totalFat   = data?.fat_g     ?? 0;
  const goalCal    = g?.calories  ?? 2000;
  const goalPro    = g?.protein_g ?? 150;
  const goalCarb   = g?.carbs_g   ?? 250;
  const goalFat    = g?.fat_g     ?? 70;

  const anyOver = totalCal > goalCal || totalPro > goalPro || totalCarb > goalCarb || totalFat > goalFat;
  const ratio   = macroRatio(totalCal, totalPro, totalCarb, totalFat);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.pageTitle}>Nutrition</Text>

        <View style={s.datePill}>
          <TouchableOpacity style={s.chevronBtn} onPress={goBack}><IChevronLeft/></TouchableOpacity>
          <Text style={s.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity
            style={[s.chevronBtn, !canGoNext && s.chevronDisabled]}
            onPress={goForward}
            disabled={!canGoNext}
          >
            <IChevronRight/>
          </TouchableOpacity>
        </View>

        {!isToday && (
          <TouchableOpacity onPress={goToday} style={s.todayBtn}>
            <Text style={s.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Macro summary card ── */}
        <View style={[s.macroCard, anyOver && s.macroCardOver]}>
          <Text style={s.macroCardTitle}>Daily Macros</Text>

          {/* Calories */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <Text style={s.macroName}>Calories</Text>
              <Text style={s.macroVal}>
                <Text style={s.macroValBig}>{totalCal.toLocaleString()}</Text>
                {' / '}{goalCal.toLocaleString()} kcal
              </Text>
            </View>
            <ProgressBar value={pct(totalCal, goalCal)} color={Colors.cr} height={5} style={{ marginTop: 5 }}/>
          </View>

          {/* Protein */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <Text style={s.macroName}>Protein</Text>
              <Text style={s.macroVal}>{Math.round(totalPro)} / {goalPro}g</Text>
            </View>
            <ProgressBar value={pct(totalPro, goalPro)} color={Colors.macroProtein} height={4} style={{ marginTop: 5 }}/>
          </View>

          {/* Carbs */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <Text style={s.macroName}>Carbs</Text>
              <Text style={s.macroVal}>{Math.round(totalCarb)} / {goalCarb}g</Text>
            </View>
            <ProgressBar value={pct(totalCarb, goalCarb)} color={Colors.macroCarbs} height={4} style={{ marginTop: 5 }}/>
          </View>

          {/* Fat */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <Text style={s.macroName}>Fat</Text>
              <Text style={s.macroVal}>{Math.round(totalFat)} / {goalFat}g</Text>
            </View>
            <ProgressBar value={pct(totalFat, goalFat)} color={Colors.macroFat} height={4} style={{ marginTop: 5 }}/>
          </View>

          {/* Macro ratio chips */}
          {(totalPro > 0 || totalCarb > 0 || totalFat > 0) && (
            <View style={s.ratioRow}>
              <View style={s.ratioChip}>
                <View style={[s.ratioDot, { backgroundColor: Colors.macroProtein }]}/>
                <Text style={s.ratioText}>P {ratio.p}%</Text>
              </View>
              <View style={s.ratioChip}>
                <View style={[s.ratioDot, { backgroundColor: Colors.macroCarbs }]}/>
                <Text style={s.ratioText}>C {ratio.c}%</Text>
              </View>
              <View style={s.ratioChip}>
                <View style={[s.ratioDot, { backgroundColor: Colors.macroFat }]}/>
                <Text style={s.ratioText}>F {ratio.f}%</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Meal sections ── */}
        {MEALS.map(meal => {
          const mealData  = data?.meals?.[meal.key];
          const entries   = mealData?.entries ?? [];
          const mealKcal  = mealData?.calories ?? 0;

          return (
            <View key={meal.key} style={s.mealSection}>
              {/* Meal header */}
              <View style={s.mealHeader}>
                <Text style={s.mealName}>{meal.label}</Text>
                <View style={s.mealHeaderRight}>
                  {mealKcal > 0 && (
                    <Text style={s.mealKcal}>{mealKcal} kcal</Text>
                  )}
                  <TouchableOpacity
                    style={s.addMealBtn}
                    onPress={() => setModalMeal(meal.key)}
                    activeOpacity={0.75}
                  >
                    <IPlus color={Colors.cr}/>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Food rows */}
              {entries.length > 0 ? (
                entries.map(entry => (
                  <TouchableOpacity
                    key={entry.id}
                    style={s.foodRow}
                    onLongPress={() => confirmDelete(entry)}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.entryName}>{entry.food_item.name}</Text>
                      <Text style={s.entryMeta}>
                        {entry.quantity_g}g · {entry.calories} kcal · {Math.round(entry.protein_g)}g protein
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => confirmDelete(entry)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {deletingId === entry.id
                        ? <Text style={s.deletingText}>…</Text>
                        : <ITrash/>
                      }
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  style={s.emptyMealRow}
                  onPress={() => setModalMeal(meal.key)}
                  activeOpacity={0.7}
                >
                  <Text style={s.emptyMealText}>+ Add food</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={{ height: 32 }}/>
      </ScrollView>

      {/* ── Food search modal ── */}
      {modalMeal && (
        <FoodSearchModal
          visible={!!modalMeal}
          mealType={modalMeal}
          onClose={() => setModalMeal(null)}
          onAdd={handleAddFood}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingBottom: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5, flex: 1 },

  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
  },
  chevronBtn:      { padding: 5, borderRadius: Radius.full },
  chevronDisabled: { opacity: 0.3 },
  dateText:        { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1, minWidth: 64, textAlign: 'center' },

  todayBtn:     { backgroundColor: Colors.crLo, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: Colors.crBdr },
  todayBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.cr },

  // Macro card
  macroCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  macroCardOver: { borderColor: Colors.crBdr, backgroundColor: Colors.crLo },
  macroCardTitle: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 14 },

  macroRow:      { marginBottom: 13 },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroName:     { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t1 },
  macroVal:      { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  macroValBig:   { fontSize: 13, fontFamily: Fonts.monoBold, color: Colors.bone },

  ratioRow:  { flexDirection: 'row', gap: 8, marginTop: 6 },
  ratioChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.s3, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.line },
  ratioDot:  { width: 7, height: 7, borderRadius: 4 },
  ratioText: { fontSize: 11, fontFamily: Fonts.monoBold, color: Colors.t2 },

  // Meal sections
  mealSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  mealHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealName:        { fontSize: 14, fontFamily: Fonts.bold, color: Colors.t1 },
  mealKcal:        { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  addMealBtn:      { width: 28, height: 28, borderRadius: 9, backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, alignItems: 'center', justifyContent: 'center' },

  foodRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.line },
  entryName:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  entryMeta:  { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  deleteBtn:  { padding: 6, marginLeft: 8 },
  deletingText: { fontSize: 14, color: Colors.t3 },

  emptyMealRow:  { paddingHorizontal: Spacing.lg, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.line, borderStyle: 'dashed' },
  emptyMealText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t3, textAlign: 'center' },
});
