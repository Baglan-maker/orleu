// mobile/components/workout/ExerciseSearchModal.tsx
/**
 * Модалка поиска упражнений.
 * 1. Ищет по SQLite кэшу (exercise_library_cache)
 * 2. Если кэш пустой — использует встроенный fallback список
 * 3. Если ничего не нашли — предлагает создать кастомное упражнение
 * 4. После выбора — SetEntryPanel для ввода sets/reps/weight
 */
import React, { useCallback } from 'react';
import { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import Svg, { Line, Path, Polyline, Circle } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Button } from '../ui/Button';
import { Input  } from '../ui/Input';
import { searchExercises } from '../../services/database';
import { exerciseApi } from '../../services/workoutApi';

// ─── Icons ────────────────────────────────────────────────────────
function ISearch()  { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round"><Circle cx="11" cy="11" r="8"/><Line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>; }
function IPlus()    { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19"/><Line x1="5" y1="12" x2="19" y2="12"/></Svg>; }
function IClose()   { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round"><Line x1="18" y1="6" x2="6" y2="18"/><Line x1="6" y1="6" x2="18" y2="18"/></Svg>; }
function IArrow()   { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="9 18 15 12 9 6"/></Svg>; }
function IDumbbell(){ return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }

// ─── Types ────────────────────────────────────────────────────────
export interface ExerciseItem {
  id:           string;
  name:         string;
  muscle_group: string;
  category:     string;
  is_custom?:   boolean;
}
export interface SetData {
  exercise: ExerciseItem;
  sets:     number;
  reps:     number;
  weight:   number;
}

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onAdd:    (data: SetData) => void;
}

// ─── Fallback list (когда кэш пустой / нет сети) ──────────────────
const FALLBACK_LIBRARY: ExerciseItem[] = [
  { id: 'bp',    name: 'Bench Press',         muscle_group: 'Chest',     category: 'compound'   },
  { id: 'ibp',   name: 'Incline Bench Press', muscle_group: 'Chest',     category: 'compound'   },
  { id: 'cf',    name: 'Cable Fly',           muscle_group: 'Chest',     category: 'isolation'  },
  { id: 'dl',    name: 'Deadlift',            muscle_group: 'Back',      category: 'compound'   },
  { id: 'pr',    name: 'Pull-ups',            muscle_group: 'Back',      category: 'bodyweight' },
  { id: 'br',    name: 'Barbell Row',         muscle_group: 'Back',      category: 'compound'   },
  { id: 'lpd',   name: 'Lat Pulldown',        muscle_group: 'Back',      category: 'compound'   },
  { id: 'sq',    name: 'Squat',               muscle_group: 'Legs',      category: 'compound'   },
  { id: 'leg',   name: 'Leg Press',           muscle_group: 'Legs',      category: 'compound'   },
  { id: 'rdl',   name: 'Romanian Deadlift',   muscle_group: 'Legs',      category: 'compound'   },
  { id: 'hc',    name: 'Hamstring Curl',      muscle_group: 'Legs',      category: 'isolation'  },
  { id: 'le',    name: 'Leg Extension',       muscle_group: 'Legs',      category: 'isolation'  },
  { id: 'ohp',   name: 'Overhead Press',      muscle_group: 'Shoulders', category: 'compound'   },
  { id: 'lr',    name: 'Lateral Raise',       muscle_group: 'Shoulders', category: 'isolation'  },
  { id: 'bbc',   name: 'Barbell Curl',        muscle_group: 'Arms',      category: 'isolation'  },
  { id: 'dbc',   name: 'Dumbbell Curl',       muscle_group: 'Arms',      category: 'isolation'  },
  { id: 'tri',   name: 'Tricep Pushdown',     muscle_group: 'Arms',      category: 'isolation'  },
  { id: 'skul',  name: 'Skull Crusher',       muscle_group: 'Arms',      category: 'isolation'  },
  { id: 'dips',  name: 'Dips',               muscle_group: 'Arms',      category: 'bodyweight' },
  { id: 'pl',    name: 'Plank',              muscle_group: 'Core',      category: 'bodyweight' },
  { id: 'crn',   name: 'Crunches',            muscle_group: 'Core',      category: 'bodyweight' },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export function ExerciseSearchModal({ visible, onClose, onAdd }: Props) {
  const [query,       setQuery]       = useState('');
  const [filter,      setFilter]      = useState('All');
  const [results,     setResults]     = useState<ExerciseItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const [selected, setSelected] = useState<ExerciseItem | null>(null);
  const [sets,     setSets]     = useState('3');
  const [reps,     setReps]     = useState('10');
  const [weight,   setWeight]   = useState('0');

  const [showCustom,   setShowCustom]   = useState(false);
  const [customName,   setCustomName]   = useState('');
  const [customMuscle, setCustomMuscle] = useState('Chest');
  const [savingCustom, setSavingCustom] = useState(false);

  // ── Search (debounced via useEffect) ──────────────────────────
  const runSearch = useCallback(async (q: string, f: string) => {
    setIsSearching(true);
    try {
      // Step 1: try SQLite cache
      const rows = await searchExercises(q, f);
      if (rows.length > 0 || q.trim()) {
        setResults(rows.map(r => ({
          id:           r.id,
          name:         r.name,
          muscle_group: r.muscle_group,
          category:     r.category,
          is_custom:    r.is_custom === 1,
        })));
        setUseFallback(false);
        setIsSearching(false);
        return;
      }
      // SQLite cache empty — fall through to API
      throw new Error('cache_empty');
    } catch {
      // Step 2: try live API (returns real UUIDs)
      try {
        const { data } = await exerciseApi.search(q, 50);
        let list: ExerciseItem[] = (Array.isArray(data) ? data : (data as any).exercises ?? [])
          .map((e: any) => ({
            id:           e.id,
            name:         e.name,
            muscle_group: e.muscle_group,
            category:     e.category,
            is_custom:    e.is_custom ?? false,
          }));
        if (f !== 'All') list = list.filter(e => e.muscle_group === f);
        setResults(list);
        setUseFallback(false);
      } catch {
        // Step 3: last resort — hardcoded list (IDs won't work with API)
        setUseFallback(true);
        let list = FALLBACK_LIBRARY;
        if (f !== 'All') list = list.filter(e => e.muscle_group === f);
        if (q.trim()) list = list.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
        setResults(list);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => runSearch(query, filter), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, filter, visible, runSearch]);

  function selectExercise(ex: ExerciseItem) {
    setSelected(ex);
    setShowCustom(false);
  }

  function handleAdd() {
    if (!selected) return;
    onAdd({
      exercise: selected,
      sets:   parseInt(sets)     || 3,
      reps:   parseInt(reps)     || 10,
      weight: parseFloat(weight) || 0,
    });
    reset();
    onClose();
  }

  async function handleAddCustom() {
    if (!customName.trim()) return;
    setSavingCustom(true);
    try {
      // POST /api/exercises чтобы сохранить на сервере
      const { data } = await exerciseApi.create({
        name:         customName.trim(),
        muscle_group: customMuscle,
        category:     'compound',
      });
      selectExercise({
        id:           data.id,
        name:         data.name,
        muscle_group: data.muscle_group,
        category:     data.category,
        is_custom:    true,
      });
    } catch {
      // Если API недоступен — используем временный ID
      selectExercise({
        id:           `custom_${Date.now()}`,
        name:         customName.trim(),
        muscle_group: customMuscle,
        category:     'compound',
        is_custom:    true,
      });
    } finally {
      setSavingCustom(false);
    }
  }

  function reset() {
    setQuery(''); setFilter('All');
    setSelected(null); setShowCustom(false);
    setSets('3'); setReps('10'); setWeight('0');
    setCustomName(''); setCustomMuscle('Chest');
    setResults([]);
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.handle}/>

        <View style={s.topBar}>
          <Text style={s.title}>
            {selected ? selected.name : 'Add Exercise'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <IClose/>
          </TouchableOpacity>
        </View>

        {/* ══ STATE: Exercise selected → Set entry ══ */}
        {selected ? (
          <ScrollView contentContainerStyle={s.setEntry} keyboardShouldPersistTaps="handled">
            <View style={s.exPill}>
              <View style={s.exPillDot}><IDumbbell/></View>
              <View style={{ flex: 1 }}>
                <Text style={s.exPillName}>{selected.name}</Text>
                <Text style={s.exPillMuscle}>{selected.muscle_group}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={{ fontSize: 12, color: Colors.cr }}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sectionLbl, { marginBottom: 12 }]}>SET DETAILS</Text>
            <View style={s.setRow}>
              {[
                { label: 'SETS',  val: sets,   setter: setSets   },
                { label: 'REPS',  val: reps,   setter: setReps   },
                { label: 'KG',    val: weight,  setter: setWeight },
              ].map(f => (
                <View key={f.label} style={{ flex: 1 }}>
                  <Text style={s.setFieldLbl}>{f.label}</Text>
                  <TextInput
                    style={s.setInput}
                    keyboardType="numeric"
                    value={f.val}
                    onChangeText={f.setter}
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <View style={s.summary}>
              <Text style={s.summaryText}>
                {parseInt(sets)||0} × {parseInt(reps)||0} reps @ {parseFloat(weight)||0} kg
              </Text>
              <Text style={s.summaryVol}>
                {Math.round((parseInt(sets)||0)*(parseInt(reps)||0)*(parseFloat(weight)||0))} kg total volume
              </Text>
            </View>

            <Button label="Add to workout" onPress={handleAdd} style={{ marginTop: 8 }}/>
          </ScrollView>

        ) : showCustom ? (
          /* ══ STATE: Create custom exercise ══ */
          <ScrollView contentContainerStyle={s.setEntry} keyboardShouldPersistTaps="handled">
            <Text style={[s.sectionLbl, { marginBottom: 12 }]}>CREATE CUSTOM</Text>
            <Input
              label="Exercise name"
              placeholder="e.g. Banded Hip Thrust"
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />
            <Text style={[s.sectionLbl, { marginBottom: 10 }]}>MUSCLE GROUP</Text>
            <View style={s.muscleGrid}>
              {MUSCLE_GROUPS.filter(g => g !== 'All').map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setCustomMuscle(g)}
                  style={[s.muscleChip, customMuscle === g && { borderColor: Colors.cr, backgroundColor: Colors.crLo }]}
                >
                  <Text style={[s.muscleChipText, customMuscle === g && { color: Colors.cr }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.customActions}>
              <Button label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setShowCustom(false)}/>
              <Button label={savingCustom ? '...' : 'Create'} style={{ flex: 2 }} onPress={handleAddCustom} disabled={savingCustom}/>
            </View>
          </ScrollView>

        ) : (
          /* ══ STATE: Search ══ */
          <>
            <View style={s.searchWrap}>
              <View style={s.searchIcon}><ISearch/></View>
              <TextInput
                style={s.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={Colors.t3}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {isSearching
                ? <ActivityIndicator size="small" color={Colors.t3} style={{ paddingHorizontal: 12 }}/>
                : query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} style={s.clearBtn}><IClose/></TouchableOpacity>
                )
              }
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterScroll}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 7 }}
            >
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setFilter(g)}
                  style={[s.filterChip, filter === g && s.filterChipActive]}
                >
                  <Text style={[s.filterText, filter === g && s.filterTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {useFallback && (
              <View style={s.offlineBanner}>
                <Text style={s.offlineText}>Offline cache — connect to sync full library</Text>
              </View>
            )}

            <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
              {results.length > 0 ? (
                results.map(ex => (
                  <TouchableOpacity key={ex.id} style={s.exRow} onPress={() => selectExercise(ex)} activeOpacity={0.8}>
                    <View style={s.exIcon}><IDumbbell/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.exName}>{ex.name}</Text>
                      <Text style={s.exMuscle}>
                        {ex.muscle_group} · {ex.category}
                        {ex.is_custom ? ' · custom' : ''}
                      </Text>
                    </View>
                    <IArrow/>
                  </TouchableOpacity>
                ))
              ) : !isSearching ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>"{query}" not found</Text>
                  <Text style={s.emptySub}>Create it as a custom exercise</Text>
                  <TouchableOpacity
                    style={s.createBtn}
                    onPress={() => { setCustomName(query); setShowCustom(true); }}
                    activeOpacity={0.8}
                  >
                    <IPlus/>
                    <Text style={s.createBtnText}>Create "{query}"</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {results.length > 0 && (
                <TouchableOpacity style={s.createRow} onPress={() => setShowCustom(true)}>
                  <IPlus/>
                  <Text style={s.createRowText}>Create custom exercise</Text>
                </TouchableOpacity>
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

  filterScroll:     { maxHeight: 40, marginBottom: 10 },
  filterChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line },
  filterChipActive: { backgroundColor: Colors.crLo, borderColor: Colors.crBdr },
  filterText:       { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t3 },
  filterTextActive: { color: Colors.cr },

  offlineBanner: { marginHorizontal: Spacing.lg, marginBottom: 8, backgroundColor: Colors.s3, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  offlineText:   { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3, textAlign: 'center' },

  list:     { flex: 1, paddingHorizontal: Spacing.lg },
  exRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.line },
  exIcon:   { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.s3, alignItems: 'center', justifyContent: 'center' },
  exName:   { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  exMuscle: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3 },

  empty:         { alignItems: 'center', paddingTop: 48 },
  emptyTitle:    { fontSize: 16, fontFamily: Fonts.bold, color: Colors.t1, marginBottom: 6 },
  emptySub:      { fontSize: 13, color: Colors.t3, marginBottom: 20 },
  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 13 },
  createBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.cr },
  createRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, marginTop: 4 },
  createRowText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.cr },

  setEntry:    { padding: Spacing.lg },
  exPill:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: Colors.line },
  exPillDot:   { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.s4, alignItems: 'center', justifyContent: 'center' },
  exPillName:  { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  exPillMuscle:{ fontSize: 12, fontFamily: Fonts.regular, color: Colors.t3, marginTop: 1 },

  sectionLbl:  { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase' },

  setRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  setFieldLbl: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.5, color: Colors.t3, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' },
  setInput:    { backgroundColor: Colors.s3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingVertical: 14, color: Colors.t1, fontFamily: Fonts.monoBold, fontSize: 22, textAlign: 'center' },

  summary:     { backgroundColor: Colors.s3, borderRadius: Radius.md, padding: 14, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.line },
  summaryText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.t1 },
  summaryVol:  { fontSize: 12, fontFamily: Fonts.mono, color: Colors.t3, marginTop: 4 },

  muscleGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  muscleChip:     { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line },
  muscleChipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t3 },
  customActions:  { flexDirection: 'row', gap: 10, marginTop: 8 },
});
