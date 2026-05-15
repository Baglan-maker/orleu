import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import Svg, { Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius } from '../../constants/theme';
import { getLastSessionSetsData, type SetEntry } from '../../services/database';

// ─── Icons ────────────────────────────────────────────────────────
function IDumbbell() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/>
      <Line x1="4" y1="9" x2="7.5" y2="9"/>
      <Line x1="4" y1="15" x2="7.5" y2="15"/>
      <Line x1="16.5" y1="9" x2="20" y2="9"/>
      <Line x1="16.5" y1="15" x2="20" y2="15"/>
      <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
    </Svg>
  );
}

function IClose() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={2} strokeLinecap="round">
      <Line x1="18" y1="6" x2="6" y2="18"/>
      <Line x1="6" y1="6" x2="18" y2="18"/>
    </Svg>
  );
}

function ICheck({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}

function IChevronDown() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6"/>
    </Svg>
  );
}

function IChevronUp() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 15l-6-6-6 6"/>
    </Svg>
  );
}

function IThreeDots() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t3} strokeWidth={2} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="5.01"/>
      <Line x1="12" y1="12" x2="12" y2="12.01"/>
      <Line x1="12" y1="19" x2="12" y2="19.01"/>
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────
export type { SetEntry };

export interface ExerciseCardData {
  localId:    string;
  exerciseId: string;
  name:       string;
  muscle:     string;
  setsData:   SetEntry[];
}

interface Props {
  data:          ExerciseCardData;
  onChange:      (localId: string, setsData: SetEntry[]) => void;
  onRemove:      (localId: string) => void;
  /** Called when user checks a set — parent can start rest timer */
  onSetComplete?: () => void;
  /** Completion state from parent (survives collapse) */
  completedSets?: boolean[];
  onCompletedSetsChange?: (completed: boolean[]) => void;
}

// ─── Component ────────────────────────────────────────────────────
export function ExerciseCard({
  data,
  onChange,
  onRemove,
  onSetComplete,
  completedSets: externalCompleted,
  onCompletedSetsChange,
}: Props) {
  const { localId, exerciseId, name, muscle, setsData } = data;

  const [repsRaw,   setRepsRaw]   = useState<string[]>(() => setsData.map(s => String(s.reps)));
  const [weightRaw, setWeightRaw] = useState<string[]>(() => setsData.map(s => String(s.weight_kg)));
  const [prevSets,  setPrevSets]  = useState<SetEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Use external completed state if provided, otherwise local
  const [localCompleted, setLocalCompleted] = useState<boolean[]>(() => setsData.map(() => false));
  const completed = externalCompleted ?? localCompleted;
  const setCompleted = (val: boolean[]) => {
    if (onCompletedSetsChange) onCompletedSetsChange(val);
    else setLocalCompleted(val);
  };

  // Auto-fill from last session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = await getLastSessionSetsData(exerciseId);
        if (cancelled || !last || last.length === 0) return;
        setPrevSets(last);

        if (setsData.length === 1 && setsData[0].reps === 8 && setsData[0].weight_kg === 0) {
          const filled = last.map((s, i) => ({
            set_number: i + 1,
            reps:       s.reps,
            weight_kg:  s.weight_kg,
          }));
          setRepsRaw(filled.map(s => String(s.reps)));
          setWeightRaw(filled.map(s => String(s.weight_kg)));
          const nc = filled.map(() => false);
          setCompleted(nc);
          onChange(localId, filled);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  function commitChange(newRepsRaw: string[], newWeightRaw: string[]) {
    const updated: SetEntry[] = newRepsRaw.map((r, i) => ({
      set_number: i + 1,
      reps:       Math.max(1, parseInt(r, 10) || 0),
      weight_kg:  parseFloat(newWeightRaw[i]) || 0,
    }));
    onChange(localId, updated);
  }

  function handleRepsChange(i: number, val: string) {
    const nr = [...repsRaw]; nr[i] = val;
    setRepsRaw(nr);
    commitChange(nr, weightRaw);
  }

  function handleWeightChange(i: number, val: string) {
    const nw = [...weightRaw]; nw[i] = val;
    setWeightRaw(nw);
    commitChange(repsRaw, nw);
  }

  function toggleComplete(i: number) {
    const nc = [...completed];
    nc[i] = !nc[i];
    setCompleted(nc);
    // Notify parent to start rest timer
    if (nc[i] && onSetComplete) onSetComplete();
  }

  function addSet() {
    const last = setsData[setsData.length - 1];
    const newSet: SetEntry = {
      set_number: setsData.length + 1,
      reps:       last?.reps      ?? 8,
      weight_kg:  last?.weight_kg ?? 0,
    };
    const nr = [...repsRaw,   String(newSet.reps)];
    const nw = [...weightRaw, String(newSet.weight_kg)];
    const nc = [...completed, false];
    setRepsRaw(nr);
    setWeightRaw(nw);
    setCompleted(nc);
    commitChange(nr, nw);
  }

  function removeSet(index: number) {
    if (setsData.length <= 1) return;
    const nr = repsRaw.filter((_, i) => i !== index);
    const nw = weightRaw.filter((_, i) => i !== index);
    const nc = completed.filter((_, i) => i !== index);
    setRepsRaw(nr);
    setWeightRaw(nw);
    setCompleted(nc);
    commitChange(nr, nw);
  }

  // Stats — only count checked sets
  const completedCount = completed.filter(Boolean).length;
  const completedVolume = setsData.reduce(
    (a, s, i) => a + (completed[i] ? s.reps * s.weight_kg : 0), 0,
  );
  const completedReps = setsData.reduce(
    (a, s, i) => a + (completed[i] ? s.reps : 0), 0,
  );
  const allDone = completedCount === setsData.length && setsData.length > 0;

  // Next goal: suggest +2.5 kg from last session's max
  const lastMaxWeight = prevSets.length > 0 ? Math.max(...prevSets.map(s => s.weight_kg)) : 0;
  const lastAvgReps   = prevSets.length > 0
    ? Math.round(prevSets.reduce((a, s) => a + s.reps, 0) / prevSets.length)
    : 0;
  const goalWeight = lastMaxWeight > 0 ? lastMaxWeight + 2.5 : null;

  return (
    <View style={[s.card, allDone && s.cardDone]}>

      {/* ── Header ── */}
      <TouchableOpacity
        style={s.header}
        onPress={() => setCollapsed(c => !c)}
        activeOpacity={0.7}
      >
        <View style={s.iconBox}><IDumbbell/></View>
        <View style={{ flex: 1 }}>
          <Text style={s.exName} numberOfLines={1}>{name}</Text>
          <Text style={s.exMeta}>{muscle.toLowerCase()}</Text>
        </View>
        <View style={s.headerRight}>
          {allDone && (
            <View style={s.doneChip}>
              <ICheck color={Colors.up}/>
              <Text style={s.doneChipTxt}>Done</Text>
            </View>
          )}
          {!allDone && completedCount > 0 && (
            <Text style={s.progressChip}>{completedCount}/{setsData.length}</Text>
          )}
          {collapsed ? <IChevronDown/> : <IChevronUp/>}
        </View>
        <TouchableOpacity
          onPress={() => setShowDeleteConfirm(v => !v)}
          style={s.moreBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IThreeDots/>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* ── Delete popover (anchored top-right near 3-dot) ── */}
      {showDeleteConfirm && (
        <View style={s.deletePopover}>
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => { setShowDeleteConfirm(false); onRemove(localId); }}
            activeOpacity={0.7}
          >
            <IClose/>
            <Text style={s.deleteBtnTxt}>Remove exercise?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.deleteCancelBtn}
            onPress={() => setShowDeleteConfirm(false)}
            activeOpacity={0.7}
          >
            <Text style={s.deleteCancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {!collapsed && (
        <>
          {/* ── Goal chip ── */}
          {goalWeight !== null && (
            <View style={s.goalRow}>
              <Text style={s.goalLabel}>NEXT GOAL:</Text>
              <Text style={s.goalVal}>{goalWeight} kg × {lastAvgReps}</Text>
            </View>
          )}

          {/* ── Column headers ── */}
          <View style={s.colRow}>
            <Text style={[s.colLbl, s.colSet]}>SET</Text>
            <Text style={[s.colLbl, s.colPrev]}>PREV</Text>
            <Text style={[s.colLbl, s.colKg]}>KG</Text>
            <Text style={[s.colLbl, s.colReps]}>REPS</Text>
            <View style={s.colCheck}/>
          </View>

          {/* ── Set rows ── */}
          {setsData.map((_set, i) => {
            const isDone   = completed[i];
            const isActive = !isDone && (i === 0 || completed[i - 1]);
            const prev     = prevSets[i];
            const prevLabel = prev ? `${prev.weight_kg}×${prev.reps}` : '—';

            return (
              <View
                key={i}
                style={[
                  s.setRow,
                  isActive && s.setRowActive,
                  isDone   && s.setRowDone,
                ]}
              >
                {/* Set number */}
                <View style={[s.setNumBox, isDone && s.setNumBoxDone]}>
                  <Text style={[s.setNum, isDone && s.setNumDone]}>{i + 1}</Text>
                </View>

                {/* Prev */}
                <Text style={[s.prevVal, s.colPrev]}>{prevLabel}</Text>

                {/* Weight input */}
                <TextInput
                  style={[s.input, s.colKg, isActive && s.inputActive, isDone && s.inputDone]}
                  value={weightRaw[i] ?? ''}
                  onChangeText={v => handleWeightChange(i, v)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder={prev ? String(prev.weight_kg) : '0'}
                  placeholderTextColor={Colors.t3}
                  editable={!isDone}
                />

                {/* Reps input */}
                <TextInput
                  style={[s.input, s.colReps, isActive && s.inputActive, isDone && s.inputDone]}
                  value={repsRaw[i] ?? ''}
                  onChangeText={v => handleRepsChange(i, v)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder={prev ? String(prev.reps) : '8'}
                  placeholderTextColor={Colors.t3}
                  editable={!isDone}
                />

                {/* Checkmark */}
                <TouchableOpacity
                  style={[s.checkBtn, isDone && s.checkBtnDone]}
                  onPress={() => toggleComplete(i)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ICheck color={isDone ? Colors.s1 : Colors.t3}/>
                </TouchableOpacity>

                {/* Remove set */}
                {setsData.length > 1 && !isDone && (
                  <TouchableOpacity
                    style={s.removeSetBtn}
                    onPress={() => removeSet(i)}
                    hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
                  >
                    <IClose/>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* ── + Add set ── */}
          <TouchableOpacity style={s.btnAddSet} onPress={addSet} activeOpacity={0.7}>
            <Text style={s.btnAddSetTxt}>+ Add set</Text>
          </TouchableOpacity>

          {/* ── Footer summary — only checked sets ── */}
          <View style={s.footer}>
            <Text style={s.footerStat}>
              <Text style={s.footerNum}>{completedCount}</Text>/{setsData.length} sets
            </Text>
            {completedVolume > 0 && (
              <Text style={s.footerStat}>
                <Text style={s.footerNum}>
                  {completedVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </Text> kg vol
              </Text>
            )}
            {completedReps > 0 && (
              <Text style={s.footerStat}>
                <Text style={s.footerNum}>{completedReps}</Text> reps
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const COL_SET   = 30;
const COL_PREV  = 62;
const COL_KG    = 64;
const COL_REPS  = 56;
const COL_CHECK = 40;

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.s2,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.line,
    marginBottom:    10,
    overflow:        'hidden',
  },
  cardDone: {
    borderColor: 'rgba(107,158,107,0.3)',
  },

  // Header — entire header is tappable for collapse
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  iconBox: {
    width: 36, height: 36,
    borderRadius:    10,
    backgroundColor: Colors.crLo,
    borderWidth:     1,
    borderColor:     Colors.crBdr,
    alignItems:      'center',
    justifyContent:  'center',
  },
  exName:      { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.t1 },
  exMeta:      { fontSize: 11, fontFamily: Fonts.regular,  color: Colors.t3, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    backgroundColor: 'rgba(107,158,107,0.12)',
    borderRadius:    Radius.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:     1,
    borderColor:     'rgba(107,158,107,0.25)',
  },
  doneChipTxt:  { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.up },
  progressChip: { fontSize: 11, fontFamily: Fonts.monoBold, color: Colors.t2 },
  moreBtn: {
    padding:         6,
    marginLeft:      2,
  },
  deletePopover: {
    position:          'absolute',
    top:               52,
    right:             10,
    zIndex:            10,
    backgroundColor:   Colors.s3,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       Colors.line,
    paddingVertical:   4,
    paddingHorizontal: 4,
    minWidth:          160,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.3,
    shadowRadius:      8,
    elevation:         8,
  },
  deleteBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderRadius:      Radius.sm,
  },
  deleteBtnTxt: {
    fontSize:   13,
    fontFamily: Fonts.semiBold,
    color:      Colors.cr,
  },
  deleteCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderRadius:      Radius.sm,
    borderTopWidth:    1,
    borderTopColor:    Colors.line,
  },
  deleteCancelTxt: {
    fontSize:   13,
    fontFamily: Fonts.semiBold,
    color:      Colors.t2,
    textAlign:  'center',
  },

  // Goal
  goalRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginHorizontal:  14,
    marginBottom:      10,
    backgroundColor:   Colors.s3,
    borderRadius:      Radius.sm,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       Colors.crBdr,
  },
  goalLabel: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.cr, letterSpacing: 1.2, textTransform: 'uppercase' },
  goalVal:   { fontSize: 12, fontFamily: Fonts.monoBold, color: Colors.bone },

  // Column headers
  colRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    marginBottom:      4,
    gap:               6,
  },
  colLbl:  { fontSize: 9, fontFamily: Fonts.bold, color: Colors.t3, letterSpacing: 1.1, textTransform: 'uppercase', textAlign: 'center' },
  colSet:  { width: COL_SET },
  colPrev: { width: COL_PREV, textAlign: 'center' },
  colKg:   { width: COL_KG,   textAlign: 'center' },
  colReps: { width: COL_REPS, textAlign: 'center' },
  colCheck:{ width: COL_CHECK },

  // Set rows
  setRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   5,
  },
  setRowActive: {
    backgroundColor: 'rgba(200,52,58,0.04)',
  },
  setRowDone: {
    opacity: 0.5,
  },

  setNumBox: {
    width: COL_SET, height: 34,
    borderRadius:    8,
    backgroundColor: Colors.s3,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.line,
  },
  setNumBoxDone: {
    backgroundColor: 'rgba(107,158,107,0.15)',
    borderColor:     'rgba(107,158,107,0.3)',
  },
  setNum:     { fontSize: 13, fontFamily: Fonts.monoBold, color: Colors.t2 },
  setNumDone: { color: Colors.up },

  prevVal: {
    fontSize:   12,
    fontFamily: Fonts.mono,
    color:      Colors.t3,
    textAlign:  'center',
  },

  input: {
    height:          42,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.line,
    backgroundColor: Colors.s3,
    fontSize:        15,
    fontFamily:      Fonts.monoBold,
    color:           Colors.bone,
    textAlign:       'center',
  },
  inputActive: {
    borderColor:     Colors.crBdr,
  },
  inputDone: {
    backgroundColor: Colors.s1,
    borderColor:     Colors.line,
  },

  checkBtn: {
    width:           COL_CHECK, height: 42,
    borderRadius:    Radius.sm,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    backgroundColor: Colors.s3,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkBtnDone: {
    backgroundColor: Colors.up,
    borderColor:     Colors.up,
  },

  // Add set (full width, inside card)
  btnAddSet: {
    marginHorizontal: 14,
    marginTop:        6,
    paddingVertical:  10,
    borderRadius:     Radius.sm,
    borderWidth:      1,
    borderColor:      Colors.line,
    borderStyle:      'dashed',
    alignItems:       'center',
  },
  btnAddSetTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t2 },
  removeSetBtn: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     2,
  },

  // Footer
  footer: {
    flexDirection:     'row',
    gap:               16,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginTop:         4,
    borderTopWidth:    1,
    borderTopColor:    Colors.line,
  },
  footerStat: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3 },
  footerNum:  { fontFamily: Fonts.monoBold, color: Colors.t2 },
});
