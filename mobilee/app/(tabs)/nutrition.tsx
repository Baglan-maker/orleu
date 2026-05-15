import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FoodSearchModal, type FoodLogData } from '../../components/nutrition/FoodSearchModal';
import {
  useNutritionStore,
  localDateISO,
  type MealType,
  type NutritionLogEntry,
  type NutritionDayResponse,
} from '../../store/nutritionStore';
import { api } from '../../services/api';
import { BuffToast } from '../../components/ui/BuffToast';

interface BuffClaimResponse {
  granted:        boolean;
  valid_for_date: string | null;
  reason:         string | null;
}

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
function ISword({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14.5 17.5 L20 22 L22 20 L17.5 14.5"/>
      <Path d="M16 4 L20 4 L20 8 L9 19 L5 19 L5 15 Z"/>
      <Path d="M3 21 L7 17"/>
    </Svg>
  );
}
function IScroll({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6z"/>
      <Path d="M8 9h7M8 13h7"/>
      <Path d="M5 6v0a2 2 0 0 0 0 4h2"/>
      <Path d="M19 16v0a3 3 0 0 1-3 3"/>
    </Svg>
  );
}
function IShield({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z"/>
    </Svg>
  );
}
function IBoltFilled({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round">
      <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Morning Ration'   },
  { key: 'lunch',     label: 'Midday Ration'    },
  { key: 'dinner',    label: 'Evening Feast'    },
  { key: 'snacks',    label: 'Potions & Snacks' },
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

/** Expected % of daily intake by current time, anchored to an 8am–9pm eating window. */
function dayPacePct(): number {
  const d = new Date();
  const minutes = d.getHours() * 60 + d.getMinutes();
  const start = 8 * 60;            // 08:00
  const end   = 21 * 60;           // 21:00
  if (minutes <= start) return 0;
  if (minutes >= end) return 100;
  return Math.round(((minutes - start) / (end - start)) * 100);
}

const DATE_STRIP_DAYS = 14;

interface DateStripItem { iso: string; weekday: string; day: string; isToday: boolean; isFuture: boolean }

function buildDateStrip(selected: string): DateStripItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = localDateISO(today);
  const items: DateStripItem[] = [];
  // Render last (DATE_STRIP_DAYS - 1) days plus today, oldest first so today sits on the right
  for (let i = DATE_STRIP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = localDateISO(d);
    items.push({
      iso,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      day: String(d.getDate()),
      isToday: iso === todayIso,
      isFuture: false,
    });
  }
  return items;
}

// ─── Component ───────────────────────────────────────────────────
export default function NutritionScreen() {
  const {
    todayData, goals, selectedDate, isLoading,
    loadDay, loadGoals, logFood, removeLog, setDate, syncPending,
  } = useNutritionStore();

  const [modalMeal,  setModalMeal]   = useState<MealType | null>(null);
  const [deletingId, setDeletingId]  = useState<string | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<MealType | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [buffToastVisible, setBuffToastVisible] = useState(false);
  // Tracks "did we already cross the protein threshold this session" so we
  // don't re-fire the toast every render once the ring stays full.
  const proteinClaimedRef = useRef(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncPending();
      await Promise.all([loadDay(selectedDate), loadGoals()]);
    } finally {
      setRefreshing(false);
    }
  }, [selectedDate, loadDay, loadGoals, syncPending]);

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
    // Light haptic punctuates the macro-bar fill animation.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await logFood(selectedDate, data.mealType, data.foodItem.id, data.quantityG);
  }

  // ── Copy yesterday's entries for a meal — surfaces only on empty meals so
  //    one tap re-logs every food item the user ate at the same meal yesterday.
  async function copyFromYesterday(mealType: MealType) {
    setCopyingMeal(mealType);
    try {
      const yesterday = shiftDate(selectedDate, -1);
      const { data } = await api.get<NutritionDayResponse>('/api/nutrition/daily', { params: { date: yesterday } });
      const entries = data?.meals?.[mealType]?.entries ?? [];
      if (entries.length === 0) {
        Alert.alert('Nothing to copy', `You didn't log ${mealType} yesterday.`);
        return;
      }
      for (const e of entries) {
        await logFood(selectedDate, mealType, e.food_item.id, e.quantity_g);
      }
    } catch {
      Alert.alert('Could not copy', 'Try again or add foods manually.');
    } finally {
      setCopyingMeal(null);
    }
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

  // Pace marker only makes sense for today — past days are "done", future days haven't started.
  const pacePct: number | undefined = isToday ? dayPacePct() : undefined;
  const dateStrip = buildDateStrip(selectedDate);

  // Daily Quest state — uses the same protein-buff signal as the toast, but
  // surfaces it visually all day rather than as a one-shot notification.
  const proteinPct     = pct(totalPro, goalPro);
  const proteinGoalMet = goalPro > 0 && totalPro >= goalPro;

  // Reset the "claimed this session" flag whenever the visible date changes,
  // so navigating away from today and back doesn't lock out the toast forever.
  useEffect(() => {
    proteinClaimedRef.current = false;
  }, [selectedDate]);

  // Buff trigger: when viewing today and protein crosses the goal, attempt to
  // claim the buff. The backend is idempotent — a second call on the same day
  // returns granted=false. We only show the toast on a real grant.
  useEffect(() => {
    if (!isToday) return;
    if (proteinClaimedRef.current) return;
    if (totalPro < goalPro) return;
    if (goalPro <= 0) return;

    proteinClaimedRef.current = true;
    (async () => {
      try {
        const { data } = await api.post<BuffClaimResponse>('/api/nutrition/claim-buff');
        if (data.granted) setBuffToastVisible(true);
      } catch {
        // soft-fail — the buff retry happens automatically next time the
        // user reloads the screen since the ref is reset on date change.
        proteinClaimedRef.current = false;
      }
    })();
  }, [totalPro, goalPro, isToday]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.pageTitle}>Nutrition</Text>

        <View style={s.datePill}>
          <TouchableOpacity
            style={s.chevronBtn}
            onPress={goBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IChevronLeft/>
          </TouchableOpacity>
          <Text style={s.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity
            style={[s.chevronBtn, !canGoNext && s.chevronDisabled]}
            onPress={goForward}
            disabled={!canGoNext}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cr} />
        }
      >

        {/* ── Date strip — last 14 days, scroll-snap to selected ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateStrip}
        >
          {dateStrip.map(item => {
            const selected = item.iso === selectedDate;
            return (
              <TouchableOpacity
                key={item.iso}
                style={[s.dateChip, selected && s.dateChipActive, item.isToday && !selected && s.dateChipToday]}
                onPress={() => setDate(item.iso)}
                activeOpacity={0.75}
              >
                <Text style={[s.dateChipDow, selected && s.dateChipTextActive]}>{item.weekday}</Text>
                <Text style={[s.dateChipNum, selected && s.dateChipTextActive]}>{item.day}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Daily Quest ── (tied to the protein → +5% XP buff) */}
        <View style={[s.questCard, proteinGoalMet && isToday && s.questCardReady]}>
          <View style={[s.questIconWrap, proteinGoalMet && isToday && s.questIconWrapReady]}>
            <ISword color={proteinGoalMet && isToday ? Colors.flat : Colors.cr} size={18}/>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.questEyebrow}>DAILY QUEST</Text>
            <Text style={s.questTitle}>Strength of the Bull</Text>
            <Text style={s.questDesc}>Hit your daily protein target.</Text>
            <View style={s.questProgressRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar
                  value={proteinPct}
                  color={proteinGoalMet ? Colors.flat : Colors.cr}
                  height={4}
                />
              </View>
              <Text style={s.questProgressTxt}>{Math.round(totalPro)}/{goalPro}g</Text>
            </View>
            <View style={[s.questBadge, proteinGoalMet && isToday && s.questBadgeReady]}>
              <IBoltFilled color={proteinGoalMet && isToday ? Colors.flat : Colors.t2} size={11}/>
              <Text style={[s.questBadgeText, proteinGoalMet && isToday && s.questBadgeTextReady]}>
                {proteinGoalMet && isToday ? 'CLAIMED · +5% XP TOMORROW' : '+5% XP TOMORROW'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Macro summary card ── */}
        <View style={[s.macroCard, anyOver && s.macroCardOver]}>
          <View style={s.macroCardHeader}>
            <Text style={s.macroCardTitle}>Daily Macros</Text>
            {pacePct != null && (
              <View style={s.paceLegend}>
                <View style={s.paceLegendLine}/>
                <Text style={s.paceLegendText}>Pace · {pacePct}%</Text>
              </View>
            )}
          </View>

          {/* Calories — Stamina */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <View style={s.macroNameWrap}>
                <Text style={s.macroName}>Calories</Text>
                <Text style={[s.macroStat, { color: Colors.cr }]}>Stamina</Text>
              </View>
              <Text style={s.macroVal}>
                <Text style={s.macroValBig}>{totalCal.toLocaleString()}</Text>
                {' / '}{goalCal.toLocaleString()} kcal
              </Text>
            </View>
            <ProgressBar value={pct(totalCal, goalCal)} color={Colors.cr} height={5} paceMarker={pacePct} style={{ marginTop: 5 }}/>
          </View>

          {/* Protein — Strength */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <View style={s.macroNameWrap}>
                <Text style={s.macroName}>Protein</Text>
                <Text style={[s.macroStat, { color: Colors.macroProtein }]}>Strength</Text>
              </View>
              <Text style={s.macroVal}>{Math.round(totalPro)} / {goalPro}g</Text>
            </View>
            <ProgressBar value={pct(totalPro, goalPro)} color={Colors.macroProtein} height={4} paceMarker={pacePct} style={{ marginTop: 5 }}/>
          </View>

          {/* Carbs — Energy */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <View style={s.macroNameWrap}>
                <Text style={s.macroName}>Carbs</Text>
                <Text style={[s.macroStat, { color: Colors.macroCarbs }]}>Energy</Text>
              </View>
              <Text style={s.macroVal}>{Math.round(totalCarb)} / {goalCarb}g</Text>
            </View>
            <ProgressBar value={pct(totalCarb, goalCarb)} color={Colors.macroCarbs} height={4} paceMarker={pacePct} style={{ marginTop: 5 }}/>
          </View>

          {/* Fat — Resilience */}
          <View style={s.macroRow}>
            <View style={s.macroLabelRow}>
              <View style={s.macroNameWrap}>
                <Text style={s.macroName}>Fat</Text>
                <Text style={[s.macroStat, { color: Colors.macroFat }]}>Resilience</Text>
              </View>
              <Text style={s.macroVal}>{Math.round(totalFat)} / {goalFat}g</Text>
            </View>
            <ProgressBar value={pct(totalFat, goalFat)} color={Colors.macroFat} height={4} paceMarker={pacePct} style={{ marginTop: 5 }}/>
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

        {/* ── Active Buffs panel ── */}
        <View style={s.buffsCard}>
          <Text style={s.buffsTitle}>Active Buffs</Text>
          <View style={s.buffSlotRow}>
            {proteinGoalMet ? (
              <View style={s.buffSlot}>
                <View style={s.buffSlotIcon}><ISword color={Colors.flat} size={14}/></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.buffSlotName}>Strength of the Bull</Text>
                  <Text style={s.buffSlotEffect}>+5% XP · next workout</Text>
                </View>
              </View>
            ) : (
              <View style={s.buffSlotEmpty}>
                <View style={s.buffSlotIconEmpty}><IShield color={Colors.t3} size={13}/></View>
                <Text style={s.buffSlotEmptyText}>No active buffs · complete quests to earn</Text>
              </View>
            )}
          </View>
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
                <View style={s.emptyMealRow}>
                  {/* Empty inventory slot — tap to fill */}
                  <TouchableOpacity
                    style={s.slotEmpty}
                    onPress={() => setModalMeal(meal.key)}
                    activeOpacity={0.7}
                  >
                    <View style={s.slotPlus}>
                      <IPlus color={Colors.t3}/>
                    </View>
                    <Text style={s.slotEmptyText}>Empty slot</Text>
                  </TouchableOpacity>
                  {/* Repeat Ration — pulls yesterday's same-meal entries */}
                  <TouchableOpacity
                    style={[s.repeatRationBtn, copyingMeal === meal.key && { opacity: 0.5 }]}
                    onPress={() => copyFromYesterday(meal.key)}
                    disabled={copyingMeal !== null}
                    activeOpacity={0.7}
                  >
                    <IScroll color={Colors.cr}/>
                    <Text style={s.repeatRationText}>
                      {copyingMeal === meal.key ? 'Repeating…' : 'Repeat Ration'}
                    </Text>
                  </TouchableOpacity>
                </View>
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

      <BuffToast
        visible={buffToastVisible}
        onHide={() => setBuffToastVisible(false)}
        title="BUFF EARNED"
        detail="+5% XP for tomorrow's workout"
      />
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

  // Empty meal area styled as an inventory slot row (dashed top border, two cells).
  emptyMealRow:  {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1, borderTopColor: Colors.line, borderStyle: 'dashed',
  },
  slotEmpty: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  slotPlus: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.s3,
  },
  slotEmptyText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3, letterSpacing: 0.6, textTransform: 'uppercase' },
  repeatRationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderLeftWidth: 1, borderLeftColor: Colors.line,
    backgroundColor: Colors.s3,
  },
  repeatRationText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.cr, letterSpacing: 0.3 },

  // Date strip
  dateStrip: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  dateChip: {
    width: 44,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderWidth: 1, borderColor: Colors.line,
    borderRadius: Radius.md,
  },
  dateChipToday: {
    borderColor: Colors.crBdr,
  },
  dateChipActive: {
    backgroundColor: Colors.cr,
    borderColor: Colors.cr,
  },
  dateChipDow: {
    fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1, color: Colors.t3,
    marginBottom: 2,
  },
  dateChipNum: {
    fontSize: 15, fontFamily: Fonts.monoBold, color: Colors.t1,
  },
  dateChipTextActive: { color: Colors.bone },

  // Macro card header + pace legend
  macroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  paceLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paceLegendLine: {
    width: 3, height: 12, borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  paceLegendText: {
    fontSize: 10, fontFamily: Fonts.monoBold, letterSpacing: 0.4, color: Colors.t3,
  },

  // ── Daily Quest card ────────────────────────────────────────────
  questCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    flexDirection: 'row',
    gap: 12,
  },
  questCardReady: {
    borderColor: `${Colors.flat}55`,
    backgroundColor: `${Colors.flat}10`,
  },
  questIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.crLo,
    borderWidth: 1, borderColor: Colors.crBdr,
    alignItems: 'center', justifyContent: 'center',
  },
  questIconWrapReady: {
    backgroundColor: `${Colors.flat}15`,
    borderColor: `${Colors.flat}55`,
  },
  questEyebrow: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.6, color: Colors.cr, textTransform: 'uppercase', marginBottom: 2 },
  questTitle:   { fontSize: 15, fontFamily: Fonts.displayBold, color: Colors.bone, letterSpacing: -0.2 },
  questDesc:    { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t2, marginTop: 2, marginBottom: 8 },

  questProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  questProgressTxt: { fontSize: 10, fontFamily: Fonts.monoBold, color: Colors.t2 },

  questBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.s3,
    borderWidth: 1, borderColor: Colors.line,
  },
  questBadgeReady: {
    backgroundColor: `${Colors.flat}15`,
    borderColor: `${Colors.flat}55`,
    // Soft glow to draw the eye to the claimed state.
    shadowColor: Colors.flat,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  questBadgeText:      { fontSize: 10, fontFamily: Fonts.bold, color: Colors.t2, letterSpacing: 0.8 },
  questBadgeTextReady: { color: Colors.flat },

  // ── Active Buffs panel ──────────────────────────────────────────
  buffsCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  buffsTitle: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 10 },
  buffSlotRow: { gap: 8 },
  buffSlot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: `${Colors.flat}10`,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: `${Colors.flat}40`,
  },
  buffSlotIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: `${Colors.flat}18`,
    borderWidth: 1, borderColor: `${Colors.flat}55`,
    alignItems: 'center', justifyContent: 'center',
  },
  buffSlotName:   { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.bone },
  buffSlotEffect: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.flat, marginTop: 1 },

  buffSlotEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, borderStyle: 'dashed',
  },
  buffSlotIconEmpty: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.s4,
    borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  buffSlotEmptyText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.t3, letterSpacing: 0.3, flex: 1 },

  // ── Macro name + RPG stat subtitle ──────────────────────────────
  macroNameWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  macroStat:     { fontSize: 9,  fontFamily: Fonts.bold, letterSpacing: 1.2, textTransform: 'uppercase' },
});
