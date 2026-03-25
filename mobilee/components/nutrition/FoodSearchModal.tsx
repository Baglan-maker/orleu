// mobile/components/nutrition/FoodSearchModal.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import {
  type FoodItem,
  type MealType,
  type RecentFoodItem,
  useNutritionStore,
} from '../../store/nutritionStore';

// ─── Icons ────────────────────────────────────────────────────────
function ISearch() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx="11" cy="11" r="8"/>
      <Line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </Svg>
  );
}
function IClose() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round">
      <Line x1="18" y1="6" x2="6" y2="18"/>
      <Line x1="6" y1="6" x2="18" y2="18"/>
    </Svg>
  );
}
function IArrow() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6"/>
    </Svg>
  );
}
function ILeaf() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2C7 2 3 6 3 11c0 4 2.5 7.5 6 9.5C10.5 22 12 22 12 22s1.5 0 3-1.5C18.5 18.5 21 15 21 11c0-5-4-9-9-9z"/>
      <Path d="M12 2 Q12 12 8 18" strokeLinecap="round"/>
    </Svg>
  );
}
function IClock() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9"/>
      <Polyline points="12 7 12 12 15 14"/>
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────
export interface FoodLogData {
  foodItem:  FoodItem;
  quantityG: number;
  mealType:  MealType;
}

interface Props {
  visible:  boolean;
  mealType: MealType;
  onClose:  () => void;
  onAdd:    (data: FoodLogData) => void;
}

type ModalView = 'search' | 'quantity' | 'create';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snacks:    'Snacks',
};

const QUICK_AMOUNTS = [50, 100, 150, 200];

function macroSummary(food: FoodItem, grams: number): { kcal: number; p: number; c: number; f: number } {
  const factor = grams / 100;
  return {
    kcal: Math.round(food.calories_per_100g  * factor),
    p:    Math.round(food.protein_per_100g   * factor * 10) / 10,
    c:    Math.round(food.carbs_per_100g     * factor * 10) / 10,
    f:    Math.round(food.fat_per_100g       * factor * 10) / 10,
  };
}

function lastUsedLabel(isoDate: string): string {
  const today    = new Date();
  const lastUsed = new Date(isoDate + 'T00:00:00');
  const diffDays = Math.floor((today.getTime() - lastUsed.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays} days ago`;
  return lastUsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function FoodSearchModal({ visible, mealType, onClose, onAdd }: Props) {
  const { recentFoods, loadRecentFoods } = useNutritionStore();

  const [view,       setView]       = useState<ModalView>('search');
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<FoodItem[]>([]);
  const [searching,  setSearching]  = useState(false);

  const [selected,   setSelected]   = useState<FoodItem | null>(null);
  const [grams,      setGrams]      = useState('100');

  // Create custom food
  const [cName,      setCName]      = useState('');
  const [cBrand,     setCBrand]     = useState('');
  const [cCal,       setCCal]       = useState('');
  const [cPro,       setCPro]       = useState('');
  const [cCarb,      setCCarb]      = useState('');
  const [cFat,       setCFat]       = useState('');
  const [saving,     setSaving]     = useState(false);

  const recentOpacity = useRef(new Animated.Value(1)).current;

  // Load recent foods when modal opens
  useEffect(() => {
    if (visible) loadRecentFoods();
  }, [visible]);

  // Fade recent section out/in as user crosses 2-char threshold
  useEffect(() => {
    Animated.timing(recentOpacity, {
      toValue:         query.length >= 2 ? 0 : 1,
      duration:        150,
      useNativeDriver: true,
    }).start();
  }, [query.length >= 2]);

  // ── Debounced search ──────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get<FoodItem[]>('/api/nutrition/foods', {
        params: { q: q.trim(), limit: 30 },
      });
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || view !== 'search') return;
    const timer = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, visible, view, runSearch]);

  function selectFood(food: FoodItem, preGrams: number = 100) {
    setSelected(food);
    setGrams(String(preGrams));
    setView('quantity');
  }

  function selectRecent(item: RecentFoodItem) {
    const food: FoodItem = {
      id:                item.food_item_id,
      name:              item.name,
      brand:             item.brand,
      calories_per_100g: item.calories_per_100g,
      protein_per_100g:  item.protein_per_100g,
      carbs_per_100g:    item.carbs_per_100g,
      fat_per_100g:      item.fat_per_100g,
      is_custom:         false,
    };
    selectFood(food, Math.round(item.typical_quantity_g));
  }

  function handleAdd() {
    if (!selected) return;
    const qty = Math.max(1, Math.min(2000, parseFloat(grams) || 100));
    onAdd({ foodItem: selected, quantityG: qty, mealType });
    reset();
    onClose();
  }

  async function handleCreateFood() {
    if (!cName.trim() || !cCal.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post<FoodItem>('/api/nutrition/foods', {
        name:              cName.trim(),
        brand:             cBrand.trim() || null,
        calories_per_100g: parseFloat(cCal)  || 0,
        protein_per_100g:  parseFloat(cPro)  || 0,
        carbs_per_100g:    parseFloat(cCarb) || 0,
        fat_per_100g:      parseFloat(cFat)  || 0,
      });
      selectFood(data);
    } catch {
      // Fallback: use local object with temp ID
      selectFood({
        id:                `custom_${Date.now()}`,
        name:              cName.trim(),
        brand:             cBrand.trim() || null,
        calories_per_100g: parseFloat(cCal)  || 0,
        protein_per_100g:  parseFloat(cPro)  || 0,
        carbs_per_100g:    parseFloat(cCarb) || 0,
        fat_per_100g:      parseFloat(cFat)  || 0,
        is_custom:         true,
      });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setView('search'); setQuery(''); setResults([]);
    setSelected(null); setGrams('100');
    setCName(''); setCBrand(''); setCCal(''); setCPro(''); setCCarb(''); setCFat('');
  }

  function handleClose() { reset(); onClose(); }

  const gramsNum = Math.max(1, Math.min(2000, parseFloat(grams) || 0));
  const preview  = selected ? macroSummary(selected, gramsNum) : null;
  const showRecent = recentFoods.length > 0 && query.length < 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.handle}/>

        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <Text style={s.title}>
            {view === 'search'   ? `Add to ${MEAL_LABELS[mealType]}` :
             view === 'quantity' ? selected?.name ?? 'Add food' :
             'Create food'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}><IClose/></TouchableOpacity>
        </View>

        {/* ══ VIEW: Quantity entry ══ */}
        {view === 'quantity' && selected ? (
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {/* Food pill */}
            <View style={s.foodPill}>
              <View style={s.foodPillIcon}><ILeaf/></View>
              <View style={{ flex: 1 }}>
                <Text style={s.foodPillName}>{selected.name}</Text>
                <Text style={s.foodPillMeta}>
                  per 100g · {selected.calories_per_100g} kcal · {selected.protein_per_100g}g P · {selected.carbs_per_100g}g C · {selected.fat_per_100g}g F
                </Text>
              </View>
              <TouchableOpacity onPress={() => setView('search')}>
                <Text style={s.changeText}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>AMOUNT</Text>
            <TextInput
              style={s.gramsInput}
              keyboardType="numeric"
              value={grams}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9.]/g, '');
                setGrams(clean);
              }}
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={s.gramsUnit}>grams</Text>

            {/* Quick amount chips */}
            <View style={s.quickRow}>
              {QUICK_AMOUNTS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.quickChip, gramsNum === g && s.quickChipActive]}
                  onPress={() => setGrams(String(g))}
                >
                  <Text style={[s.quickChipText, gramsNum === g && s.quickChipTextActive]}>
                    {g}g
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live preview */}
            {preview && gramsNum > 0 && (
              <View style={s.preview}>
                <Text style={s.previewArrow}>→</Text>
                <Text style={s.previewText}>
                  {preview.kcal} kcal · {preview.p}g protein · {preview.c}g carbs · {preview.f}g fat
                </Text>
              </View>
            )}

            <Button
              label={`Add to ${MEAL_LABELS[mealType]}`}
              onPress={handleAdd}
              style={{ marginTop: 16 }}
              disabled={gramsNum <= 0}
            />
          </ScrollView>

        ) : view === 'create' ? (
          /* ══ VIEW: Create custom food ══ */
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>NAME *</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Homemade granola"
              placeholderTextColor={Colors.t3}
              value={cName}
              onChangeText={setCName}
              autoFocus
            />

            <Text style={s.fieldLabel}>BRAND (optional)</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. My Kitchen"
              placeholderTextColor={Colors.t3}
              value={cBrand}
              onChangeText={setCBrand}
            />

            <Text style={[s.fieldLabel, { marginTop: 8 }]}>PER 100g</Text>
            <View style={s.macroGrid}>
              {[
                { label: 'Calories', val: cCal,  set: setCCal,  placeholder: '0' },
                { label: 'Protein g', val: cPro, set: setCPro,  placeholder: '0' },
                { label: 'Carbs g',  val: cCarb, set: setCCarb, placeholder: '0' },
                { label: 'Fat g',    val: cFat,  set: setCFat,  placeholder: '0' },
              ].map(f => (
                <View key={f.label} style={s.macroGridCell}>
                  <Text style={s.macroGridLabel}>{f.label}</Text>
                  <TextInput
                    style={s.macroGridInput}
                    keyboardType="numeric"
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.t3}
                    value={f.val}
                    onChangeText={f.set}
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <Text style={s.createNote}>
              These values are per 100g. You'll enter the serving size next.
            </Text>

            <View style={s.createActions}>
              <Button label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setView('search')}/>
              <Button
                label={saving ? '...' : 'Save & Add'}
                style={{ flex: 2 }}
                onPress={handleCreateFood}
                disabled={saving || !cName.trim() || !cCal.trim()}
                loading={saving}
              />
            </View>
          </ScrollView>

        ) : (
          /* ══ VIEW: Search ══ */
          <>
            <View style={s.searchWrap}>
              <View style={s.searchIcon}><ISearch/></View>
              <TextInput
                style={s.searchInput}
                placeholder="Search foods..."
                placeholderTextColor={Colors.t3}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {searching
                ? <ActivityIndicator size="small" color={Colors.t3} style={{ paddingHorizontal: 12 }}/>
                : query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} style={s.clearBtn}><IClose/></TouchableOpacity>
                )
              }
            </View>

            <ScrollView style={s.list} keyboardShouldPersistTaps="handled">

              {/* ── Recent foods (shown when query < 2 chars) ── */}
              {showRecent && (
                <Animated.View style={{ opacity: recentOpacity }}>
                  <Text style={s.sectionLbl}>Recent</Text>
                  {recentFoods.map(item => (
                    <TouchableOpacity
                      key={item.food_item_id}
                      style={s.recentRow}
                      onPress={() => selectRecent(item)}
                      activeOpacity={0.8}
                    >
                      <View style={s.recentClockWrap}><IClock/></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.foodName}>{item.name}</Text>
                        <Text style={s.foodMeta}>
                          {item.calories_per_100g} kcal · {item.protein_per_100g}g P per 100g
                        </Text>
                      </View>
                      <Text style={s.lastUsed}>{lastUsedLabel(item.last_used_date)}</Text>
                      <IArrow/>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              )}

              {/* ── Divider ── */}
              {showRecent && (
                <View style={s.dividerRow}>
                  <View style={s.dividerLine}/>
                  <Text style={s.dividerText}>or search below</Text>
                  <View style={s.dividerLine}/>
                </View>
              )}

              {/* ── Search results ── */}
              {results.length > 0 ? (
                results.map(food => (
                  <TouchableOpacity key={food.id} style={s.foodRow} onPress={() => selectFood(food)} activeOpacity={0.8}>
                    <View style={s.foodIcon}><ILeaf/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.foodName}>{food.name}</Text>
                      <Text style={s.foodMeta}>
                        {food.brand ? `${food.brand} · ` : ''}per 100g: {food.calories_per_100g} kcal · {food.protein_per_100g}g P · {food.carbs_per_100g}g C · {food.fat_per_100g}g F
                      </Text>
                    </View>
                    <IArrow/>
                  </TouchableOpacity>
                ))
              ) : query.trim() && !searching ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>"{query}" not found</Text>
                  <Text style={s.emptySub}>Can't find it? Create a custom food item.</Text>
                  <TouchableOpacity
                    style={s.createBtn}
                    onPress={() => { setCName(query); setView('create'); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.createBtnText}>+ Create custom food</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {results.length > 0 && (
                <TouchableOpacity style={s.createRow} onPress={() => setView('create')}>
                  <Text style={s.createRowText}>+ Create custom food</Text>
                </TouchableOpacity>
              )}

              {!query.trim() && recentFoods.length === 0 && (
                <View style={s.emptyStart}>
                  <Text style={s.emptyStartText}>Type to search foods</Text>
                  <TouchableOpacity style={[s.createBtn, { marginTop: 16 }]} onPress={() => setView('create')} activeOpacity={0.8}>
                    <Text style={s.createBtnText}>+ Create custom food</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: Colors.s1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.s4, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  topBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  title:    { fontSize: 17, fontFamily: Fonts.bold, color: Colors.t1, flex: 1, letterSpacing: -0.2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.s3, alignItems: 'center', justifyContent: 'center' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: 14, backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  searchIcon:  { paddingLeft: 14 },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, color: Colors.t1, fontFamily: Fonts.regular, fontSize: 15 },
  clearBtn:    { paddingHorizontal: 14 },

  list: { flex: 1, paddingHorizontal: Spacing.lg },

  sectionLbl: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 8 },

  recentRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.line },
  recentClockWrap:{ width: 28, alignItems: 'center' },
  lastUsed:       { fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3, marginRight: 4 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.line },
  dividerText: { fontSize: 10, fontFamily: Fonts.mono, color: Colors.t3, letterSpacing: 1 },

  foodRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.line },
  foodIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.s3, alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  foodMeta: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  empty:      { alignItems: 'center', paddingTop: 48 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: Colors.t3, marginBottom: 20 },
  createBtn:  { backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 13 },
  createBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.cr },
  createRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  createRowText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.cr },

  emptyStart:     { alignItems: 'center', paddingTop: 56 },
  emptyStartText: { fontSize: 14, color: Colors.t3, fontFamily: Fonts.regular },

  // Quantity view
  body:        { padding: Spacing.lg },
  fieldLabel:  { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  foodPill:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: Colors.line },
  foodPillIcon:  { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.s4, alignItems: 'center', justifyContent: 'center' },
  foodPillName:  { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  foodPillMeta:  { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 1 },
  changeText:    { fontSize: 12, color: Colors.cr, fontFamily: Fonts.semiBold },

  gramsInput:  { backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingVertical: 16, color: Colors.t1, fontFamily: Fonts.monoBold, fontSize: 28, textAlign: 'center', marginBottom: 4 },
  gramsUnit:   { fontSize: 12, fontFamily: Fonts.mono, color: Colors.t3, textAlign: 'center', marginBottom: 16 },

  quickRow:        { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickChip:       { flex: 1, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  quickChipActive: { backgroundColor: Colors.crLo, borderColor: Colors.crBdr },
  quickChipText:       { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t3 },
  quickChipTextActive: { color: Colors.cr },

  preview:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.line },
  previewArrow: { fontSize: 16, color: Colors.cr, fontFamily: Fonts.monoBold },
  previewText:  { fontSize: 13, fontFamily: Fonts.mono, color: Colors.t1, flex: 1 },

  // Create view
  textInput:      { backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: 14, paddingVertical: 13, color: Colors.t1, fontFamily: Fonts.regular, fontSize: 15, marginBottom: 16 },
  macroGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  macroGridCell:  { width: '47%' },
  macroGridLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.5, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  macroGridInput: { backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: 12, paddingVertical: 12, color: Colors.t1, fontFamily: Fonts.monoBold, fontSize: 18, textAlign: 'center' },
  createNote:     { fontSize: 11, color: Colors.t3, fontFamily: Fonts.regular, marginBottom: 20, textAlign: 'center' },
  createActions:  { flexDirection: 'row', gap: 10 },
});
