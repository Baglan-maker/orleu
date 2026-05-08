// mobile/components/workout/WorkoutLogScreen.tsx
/**
 * Full-screen workout session modal.
 *
 * Fixes applied:
 * 1. Safe area — proper insets, no overlap with notch/status bar
 * 2. Action hierarchy — Finish button is sticky at bottom, not top
 * 3. Validation — Finish disabled unless ≥1 set completed OR valid data entered
 * 4. Rest timer persistence — timer state lives HERE (parent), survives card collapse
 * 5. Rest timer UX — toggle on/off, editable duration, visual countdown, persistent
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Button } from '../ui/Button';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseSearchModal, type ExerciseItem } from './ExerciseSearchModal';
import { useWorkoutStore, type WorkoutExercise } from '../../store/workoutStore';

// ─── Icons ────────────────────────────────────────────────────────
function IChevronDown() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6"/>
    </Svg>
  );
}

function IPlus() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={Colors.cr} strokeWidth={2} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19"/>
      <Line x1="5" y1="12" x2="19" y2="12"/>
    </Svg>
  );
}

function IClock() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.t2} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 6v6l4 2"/>
    </Svg>
  );
}

function IPencil() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={Colors.bone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </Svg>
  );
}

function ICheck() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={Colors.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}

// ─── Workout elapsed timer hook ───────────────────────────────────
function useWorkoutTimer(startedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const sec = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Global rest timer (lives in parent, survives card collapse) ──
function useRestTimer(defaultDuration: number) {
  const [enabled,   setEnabled]   = useState(true);
  const [duration,  setDuration]  = useState(defaultDuration);
  const [remaining, setRemaining] = useState(0);
  const [running,   setRunning]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown logic
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          setRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const start = useCallback(() => {
    if (!enabled) return;
    setRemaining(duration);
    setRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [enabled, duration]);

  const skip = useCallback(() => {
    setRunning(false);
    setRemaining(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  return { enabled, setEnabled, duration, setDuration, remaining, running, start, skip };
}

// ─── Floating rest timer widget ───────────────────────────────────
function RestTimerWidget({
  enabled, setEnabled,
  duration, setDuration,
  remaining, running, skip,
}: ReturnType<typeof useRestTimer>) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation when running
  useEffect(() => {
    if (!running) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [running]);

  function commitEdit() {
    const parsed = parseInt(editVal, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 600) {
      setDuration(parsed);
    }
    setEditing(false);
  }

  const m   = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const pct = duration > 0 ? remaining / duration : 0;
  const countdownColor = pct > 0.5 ? Colors.up : pct > 0.25 ? Colors.flat : Colors.cr;

  const durMin = Math.floor(duration / 60);
  const durSec = duration % 60;

  return (
    <View style={rt.wrap}>
      <View style={rt.left}>
        <IClock/>
        <Text style={rt.title}>Rest timer</Text>

        {editing ? (
          <View style={rt.editRow}>
            <TextInput
              style={rt.editInput}
              value={editVal}
              onChangeText={setEditVal}
              onBlur={commitEdit}
              onSubmitEditing={commitEdit}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={3}
            />
            <Text style={rt.editUnit}>sec</Text>
            <TouchableOpacity onPress={commitEdit} style={rt.editDone}>
              <ICheck/>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={rt.durationRow}
            onPress={enabled && !running ? () => { setEditVal(String(duration)); setEditing(true); } : undefined}
            activeOpacity={enabled && !running ? 0.7 : 1}
          >
            <Text style={rt.durationTxt}>
              {durMin}м {String(durSec).padStart(2, '0')}с
            </Text>
            {enabled && !running && (
              <View style={rt.editIconBox}>
                <IPencil/>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={rt.right}>
        {/* Countdown display when running */}
        {enabled && running && (
          <Animated.View style={[rt.countdownBadge, { transform: [{ scale: pulse }] }]}>
            <TouchableOpacity onPress={skip} activeOpacity={0.8}>
              <Text style={[rt.countdownLabel, { color: countdownColor }]}>
                {m}:{String(sec).padStart(2, '0')}
              </Text>
              <Text style={rt.countdownSub}>tap to skip</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Done indicator */}
        {enabled && !running && remaining === 0 && (
          <View style={rt.readyBadge}>
            <ICheck/>
            <Text style={rt.readyTxt}>Rested</Text>
          </View>
        )}

        <Switch
          value={enabled}
          onValueChange={v => { setEnabled(v); if (!v) skip(); }}
          trackColor={{ false: Colors.s4, true: Colors.crMid }}
          thumbColor={enabled ? Colors.cr : Colors.t3}
        />
      </View>
    </View>
  );
}

const rt = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.s2,
    borderRadius:      Radius.lg,
    borderWidth:       1,
    borderColor:       Colors.line,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginBottom:      12,
  },
  left: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    flexWrap:       'wrap',
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  title: {
    fontSize:   12,
    fontFamily: Fonts.semiBold,
    color:      Colors.t2,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  durationTxt: {
    fontSize:   13,
    fontFamily: Fonts.monoBold,
    color:      Colors.t1,
  },
  editIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  editInput: {
    width:           48,
    backgroundColor: Colors.s3,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.crBdr,
    color:           Colors.t1,
    fontFamily:      Fonts.monoBold,
    fontSize:        14,
    textAlign:       'center',
    paddingVertical: 4,
  },
  editUnit: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3 },
  editDone: { padding: 4 },
  countdownBadge: {
    backgroundColor:   Colors.crLo,
    borderWidth:       1,
    borderColor:       Colors.crBdr,
    borderRadius:      Radius.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
    alignItems:        'center',
  },
  countdownLabel: {
    fontSize:   16,
    fontFamily: Fonts.monoBold,
  },
  countdownSub: {
    fontSize:   8,
    fontFamily: Fonts.regular,
    color:      Colors.t3,
    marginTop:  1,
    textAlign:  'center',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107,158,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(107,158,107,0.3)',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  readyTxt: {
    fontSize:   12,
    fontFamily: Fonts.semiBold,
    color:      Colors.up,
  },
});

// ─── Validation helper ────────────────────────────────────────────
/** Returns true when the workout has enough data to submit */
function isWorkoutValid(
  exercises: WorkoutExercise[],
  completedSetsMap: Record<string, boolean[]>,
): boolean {
  if (exercises.length === 0) return false;

  // ALL sets of ALL exercises must be checked to finish
  return exercises.every(ex => {
    const completed = completedSetsMap[ex.localId];
    if (!completed || completed.length < ex.setsData.length) return false;
    return completed.every(Boolean);
  });
}

// ─── Main component ────────────────────────────────────────────────
interface Props {
  visible:      boolean;
  onClose:      () => void;
  onFinish:     () => Promise<void>;
  submitStatus: 'idle' | 'loading' | 'success' | 'error';
}

export function WorkoutLogScreen({ visible, onClose, onFinish, submitStatus }: Props) {
  const {
    exercises,
    notes,
    startedAt,
    addExercise,
    removeExercise,
    updateSetsData,
    setNotes,
    startSession,
  } = useWorkoutStore();

  const insets = useSafeAreaInsets();
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Completed sets state (lifted from cards so it persists across collapse) ──
  const [completedSetsMap, setCompletedSetsMap] = useState<Record<string, boolean[]>>({});

  const updateCompletedSets = useCallback((localId: string, completed: boolean[]) => {
    setCompletedSetsMap(prev => ({ ...prev, [localId]: completed }));
  }, []);

  // ── Rest timer (global, survives card collapse + scroll) ──
  const restTimer = useRestTimer(90);

  // Start session + reset completed sets on every new open
  useEffect(() => {
    if (visible) {
      setCompletedSetsMap({});
      if (!startedAt) startSession();
    }
  }, [visible]);

  const workoutTime = useWorkoutTimer(startedAt);

  function onExerciseAdd(ex: ExerciseItem) {
    addExercise({
      exerciseId: ex.id,
      name:       ex.name,
      muscle:     ex.muscle_group,
      setsData:   [{ set_number: 1, reps: 8, weight_kg: 0 }],
    });
    setShowSearch(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }

  function handleRemoveExercise(localId: string) {
    removeExercise(localId);
    setCompletedSetsMap(prev => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  }

  // Trigger rest timer when any set is checked
  const onSetComplete = useCallback(() => {
    restTimer.start();
  }, [restTimer.start]);

  const isLoading = submitStatus === 'loading';
  const isSuccess = submitStatus === 'success';
  const valid     = isWorkoutValid(exercises, completedSetsMap);
  const canFinish = valid && !isLoading && !isSuccess;

  // Count total completed sets, volume, reps across all exercises (checked only)
  const totalCompletedSets = Object.values(completedSetsMap)
    .reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.setsData.length, 0);

  const totalVolume = exercises.reduce((sum, ex) => {
    const checked = completedSetsMap[ex.localId];
    if (!checked) return sum;
    return sum + ex.setsData.reduce(
      (a, s, i) => a + (checked[i] ? s.reps * s.weight_kg : 0), 0,
    );
  }, 0);

  const totalReps = exercises.reduce((sum, ex) => {
    const checked = completedSetsMap[ex.localId];
    if (!checked) return sum;
    return sum + ex.setsData.reduce(
      (a, s, i) => a + (checked[i] ? s.reps : 0), 0,
    );
  }, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[s.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >

          {/* ── Top bar: dismiss + timer only (no finish here) ── */}
          <View style={s.topBar}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <IChevronDown/>
            </TouchableOpacity>

            <View style={s.timerPill}>
              <IClock/>
              <Text style={s.timerLabel}>{workoutTime}</Text>
            </View>

            {/* Balance spacer (same width as close button) */}
            <View style={{ width: 38 }}/>
          </View>

          {/* ── Progress strip ── */}
          {exercises.length > 0 && (
            <View style={s.progressStrip}>
              <View style={s.progressBarBg}>
                <View
                  style={[
                    s.progressBarFill,
                    { width: totalSets > 0 ? `${(totalCompletedSets / totalSets) * 100}%` : '0%' },
                  ]}
                />
              </View>
              <Text style={s.progressTxt}>
                {totalCompletedSets}/{totalSets} sets
                {totalVolume > 0 ? `  ·  ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : ''}
                {totalReps > 0 ? `  ·  ${totalReps} reps` : ''}
              </Text>
            </View>
          )}

          {/* ── Scrollable content ── */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Notes field ── */}
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Workout notes..."
              placeholderTextColor={Colors.t3}
              multiline
              numberOfLines={2}
            />

            {/* ── Rest timer (always visible, stateful) ── */}
            <RestTimerWidget {...restTimer}/>

            {/* ── Exercise cards ── */}
            {exercises.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyTitle}>No exercises yet</Text>
                <Text style={s.emptySubtitle}>Tap below to add your first exercise</Text>
              </View>
            ) : (
              exercises.map(ex => (
                <ExerciseCard
                  key={ex.localId}
                  data={ex}
                  onChange={(id, sets) => updateSetsData(id, sets)}
                  onRemove={handleRemoveExercise}
                  onSetComplete={onSetComplete}
                  completedSets={completedSetsMap[ex.localId]}
                  onCompletedSetsChange={c => updateCompletedSets(ex.localId, c)}
                />
              ))
            )}

            {/* ── Add exercise ── */}
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => setShowSearch(true)}
              activeOpacity={0.7}
            >
              <IPlus/>
              <Text style={s.addBtnText}>
                {exercises.length === 0 ? 'Add exercise' : 'Add another exercise'}
              </Text>
            </TouchableOpacity>

            {/* Bottom spacer for sticky button */}
            {exercises.length > 0 && <View style={{ height: 80 }}/>}
          </ScrollView>

          {/* ── Sticky Finish button at bottom ── */}
          {exercises.length > 0 && (
            <View style={s.stickyBottom}>
              <Button
                label={
                  isSuccess  ? 'Session saved!'
                  : isLoading ? 'Saving...'
                  : !valid    ? `Check all sets (${totalCompletedSets}/${totalSets})`
                  :             'Finish & Log Session'
                }
                onPress={onFinish}
                disabled={!canFinish}
                loading={isLoading}
              />
            </View>
          )}

        </KeyboardAvoidingView>
      </View>

      <ExerciseSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onAdd={onExerciseAdd}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 16, paddingTop: 12 },

  // Top bar — sits below SafeAreaView inset, extra top padding for notch clearance
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10, 
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    backgroundColor:   Colors.s1,
  },
  closeBtn: {
    width: 38, height: 38,
    borderRadius:    19,
    backgroundColor: Colors.s3,
    borderWidth:     1,
    borderColor:     Colors.line,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timerPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   Colors.s3,
    borderRadius:      Radius.full,
    paddingHorizontal: 18,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       Colors.line,
  },
  timerLabel: {
    fontSize:      17,
    fontFamily:    Fonts.monoBold,
    color:         Colors.bone,
    letterSpacing: 1.5,
  },

  // Progress strip
  progressStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    backgroundColor:   Colors.s2,
  },
  progressBarBg: {
    flex:            1,
    height:          4,
    backgroundColor: Colors.s4,
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          4,
    backgroundColor: Colors.cr,
    borderRadius:    2,
  },
  progressTxt: {
    fontSize:   11,
    fontFamily: Fonts.mono,
    color:      Colors.t2,
    minWidth:   70,
    textAlign:  'right',
  },

  // Notes
  notesInput: {
    backgroundColor:   Colors.s2,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       Colors.line,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:          13,
    fontFamily:        Fonts.regular,
    color:             Colors.t1,
    marginBottom:      12,
    minHeight:         44,
    textAlignVertical: 'top',
  },

  // Empty state
  emptyState: {
    alignItems:      'center',
    paddingVertical: 48,
    gap:             8,
  },
  emptyTitle:    { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.t2 },
  emptySubtitle: { fontSize: 13, fontFamily: Fonts.regular,  color: Colors.t3 },

  // Add exercise
  addBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderWidth:     1,
    borderColor:     Colors.crBdr,
    borderStyle:     'dashed',
    borderRadius:    Radius.md,
    paddingVertical: 15,
    marginTop:       6,
    backgroundColor: Colors.crLo,
  },
  addBtnText: {
    fontSize:   14,
    fontFamily: Fonts.semiBold,
    color:      Colors.cr,
  },

  // Sticky finish button
  stickyBottom: {
    paddingHorizontal: Spacing.lg,
    paddingVertical:   10,
    borderTopWidth:    1,
    borderTopColor:    Colors.line,
    backgroundColor:   Colors.s1,
  },
});
