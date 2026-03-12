// mobile/app/(tabs)/index.tsx
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { Card }        from '../../components/ui/Card';
import { Button }      from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuthStore } from '../../store/authStore';

// ─── Иконки ──────────────────────────────────────────────────────
function IPlus()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.t2} strokeWidth={2} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19"/><Line x1="5" y1="12" x2="19" y2="12"/></Svg>; }
function IFire()  { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></Svg>; }
function IDumbbell(c = Colors.t2) { return <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/><Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/><Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/><Line x1="7.5" y1="12" x2="16.5" y2="12"/></Svg>; }
function IZap()   { return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Svg>; }
function ICheck() { return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12"/></Svg>; }

// ─── Тип упражнения ───────────────────────────────────────────────
interface Exercise {
  name:     string;
  sets:     number;
  reps:     number;
  weight:   number;
}

// Дефолтные упражнения для демо (потом заменим на реальный поиск из API)
const DEFAULT_EXERCISES: Exercise[] = [
  { name: 'Bench Press',       sets: 3, reps: 8,  weight: 80 },
  { name: 'Incline DB Press',  sets: 3, reps: 10, weight: 30 },
  { name: 'Cable Fly',         sets: 3, reps: 12, weight: 20 },
];

export default function WorkoutScreen() {
  const { user } = useAuthStore();

  const [exercises, setExercises] = useState<Exercise[]>(DEFAULT_EXERCISES);
  const [showAdd,   setShowAdd]   = useState(false);
  const [newEx,     setNewEx]     = useState<Exercise>({ name: '', sets: 3, reps: 10, weight: 0 });
  const [saved,     setSaved]     = useState(false);

  const totalReps = exercises.reduce((a, e) => a + e.sets * e.reps, 0);
  const missionProgress = Math.min(100, Math.round(totalReps / 350 * 100));

  function addExercise() {
    if (!newEx.name.trim()) return;
    setExercises(prev => [...prev, { ...newEx }]);
    setNewEx({ name: '', sets: 3, reps: 10, weight: 0 });
    setShowAdd(false);
  }

  function finishWorkout() {
    // TODO Шаг 3.12: отправить на сервер / записать в SQLite
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.lbl}>Today</Text>
              <Text style={s.pageTitle}>Workout Log</Text>
            </View>
            <View style={s.streakBox}>
              <IFire/>
              <Text style={s.streakNum}>7</Text>
            </View>
          </View>

          {/* ── Active mission strip ── */}
          <Card variant="crimson">
            <View style={s.missionHeader}>
              <View>
                <Text style={s.lblCr}>Active mission</Text>
                <Text style={s.missionName}>Volume Crusher</Text>
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>HARD</Text>
              </View>
            </View>
            <ProgressBar
              value={missionProgress}
              color={Colors.cr}
              height={4}
              leftText={`${Math.min(350, totalReps)} / 350 reps`}
              rightText={`${missionProgress}%`}
              style={{ marginTop: 8 }}
            />
          </Card>

          {/* ── Exercise list ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.lbl}>Exercises</Text>
              <Text style={s.monoSmall}>{totalReps} reps</Text>
            </View>

            {exercises.map((ex, i) => (
              <View key={i} style={s.exRow}>
                <View style={s.exIcon}>{IDumbbell()}</View>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{ex.name}</Text>
                  <Text style={s.exDetail}>{ex.sets}×{ex.reps} @ {ex.weight}kg</Text>
                </View>
                <View style={s.exReps}>
                  <Text style={s.exRepsNum}>{ex.sets * ex.reps}</Text>
                  <Text style={s.exRepsLabel}>REPS</Text>
                </View>
              </View>
            ))}

            {/* ── Add exercise form ── */}
            {showAdd ? (
              <View style={s.addForm}>
                <TextInput
                  style={s.addInput}
                  placeholder="Exercise name"
                  placeholderTextColor={Colors.t3}
                  value={newEx.name}
                  onChangeText={t => setNewEx(n => ({ ...n, name: t }))}
                  autoFocus
                />
                <View style={s.addRow}>
                  {(['sets', 'reps', 'weight'] as const).map(k => (
                    <View key={k} style={{ flex: 1 }}>
                      <Text style={s.addFieldLabel}>{k === 'weight' ? 'KG' : k.toUpperCase()}</Text>
                      <TextInput
                        style={s.addNumInput}
                        keyboardType="numeric"
                        value={String(newEx[k])}
                        onChangeText={t => setNewEx(n => ({ ...n, [k]: parseInt(t) || 0 }))}
                      />
                    </View>
                  ))}
                </View>
                <View style={s.addActions}>
                  <Button label="Cancel" variant="ghost"  style={{ flex: 1 }}   onPress={() => setShowAdd(false)}/>
                  <Button label="Add"    variant="primary" style={{ flex: 2 }}   onPress={addExercise}/>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
                <IPlus/>
                <Text style={s.addBtnText}>Add exercise</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Finish button ── */}
          <View style={{ paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: 32 }}>
            <Button
              label={saved ? '✓ Session saved' : 'Finish & log session'}
              onPress={finishWorkout}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingTop: Spacing.xl },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
  },
  lbl:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.t3, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.t1, letterSpacing: -0.5 },
  streakBox: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  streakNum: { fontSize: 20, fontFamily: Fonts.monoBold, color: Colors.bone },

  lblCr:       { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.8, color: Colors.cr, textTransform: 'uppercase', marginBottom: 3 },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missionName:   { fontSize: 15, fontFamily: Fonts.bold, color: Colors.t1 },
  badge: {
    backgroundColor: Colors.crLo, borderWidth: 1, borderColor: Colors.crBdr,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.cr, letterSpacing: 0.8 },

  section:       { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monoSmall:     { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.s3, borderRadius: Radius.md,
    padding: 12, marginBottom: 7,
    borderWidth: 1, borderColor: Colors.line,
  },
  exIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.s4, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  exName:     { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 2 },
  exDetail:   { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },
  exReps:     { alignItems: 'flex-end' },
  exRepsNum:  { fontSize: 14, fontFamily: Fonts.monoBold, color: Colors.bone },
  exRepsLabel:{ fontSize: 9, color: Colors.t3, letterSpacing: 0.8, fontFamily: Fonts.bold },

  addForm: {
    backgroundColor: Colors.s3, borderRadius: Radius.md,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.crBdr,
  },
  addInput: {
    backgroundColor: Colors.s4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 14, paddingVertical: 12, color: Colors.t1,
    fontFamily: Fonts.regular, fontSize: 14, marginBottom: 10,
  },
  addRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addFieldLabel: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.5, color: Colors.t3, textTransform: 'uppercase', marginBottom: 5 },
  addNumInput: {
    backgroundColor: Colors.s4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.line,
    paddingVertical: 10, color: Colors.t1,
    fontFamily: Fonts.monoBold, fontSize: 16, textAlign: 'center',
  },
  addActions: { flexDirection: 'row', gap: 8 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.line, borderStyle: 'dashed',
    borderRadius: Radius.md, paddingVertical: 13, marginBottom: 10,
  },
  addBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t2 },
});