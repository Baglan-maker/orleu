import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing, getCharacterImage, type AvatarStage } from '../../constants/theme';

// Cumulative XP needed to unlock each stage (must match backend _XP_THRESHOLDS)
const STAGES: { stage: AvatarStage; name: string; xpRequired: number; desc: string }[] = [
  { stage: 0, name: 'Rookie',   xpRequired: 0,      desc: 'The journey begins. Every rep counts.' },
  { stage: 1, name: 'Active',   xpRequired: 500,    desc: 'Momentum builds. Your body adapts.' },
  { stage: 2, name: 'Athlete',  xpRequired: 2_000,  desc: 'Discipline becomes habit.' },
  { stage: 3, name: 'Champion', xpRequired: 6_000,  desc: 'Consistency forges champions.' },
  { stage: 4, name: 'Legend',   xpRequired: 15_000, desc: 'The pinnacle. Few reach this.' },
];

interface Props {
  visible:      boolean;
  characterId:  number;
  currentStage: AvatarStage;
  onClose:      () => void;
}

export function CharacterInfoModal({ visible, characterId, currentStage, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Character Progression</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={s.list}>
            {STAGES.map(({ stage, name, xpRequired, desc }) => {
              const isCurrent = stage === currentStage;
              const isPast    = stage < currentStage;
              const isFuture  = stage > currentStage;
              return (
                <View
                  key={stage}
                  style={[
                    s.row,
                    isCurrent && s.rowActive,
                    isFuture  && s.rowFuture,
                  ]}
                >
                  <Image
                    source={getCharacterImage(characterId, stage)}
                    style={[s.img, isFuture && { opacity: 0.12 }]}
                  />
                  <View style={[s.info, isFuture && { opacity: 0.18 }]}>
                    <View style={s.nameRow}>
                      <Text style={[s.stageName, isCurrent && { color: Colors.cr }, isPast && { color: Colors.up }]}>
                        {name}
                      </Text>
                      {isCurrent && <View style={s.dotCurrent} />}
                      {isPast    && <Text style={s.check}>✓</Text>}
                    </View>
                    <Text style={s.xpLabel}>
                      {xpRequired === 0 ? 'Starting level' : `${xpRequired.toLocaleString()} XP to unlock`}
                    </Text>
                    <Text style={s.desc}>{desc}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing['3xl'],
    width: '100%',
    maxHeight: '82%',
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  list: { flexGrow: 0 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    marginBottom: 6,
  },
  rowActive: {
    backgroundColor: Colors.crLo,
    borderWidth: 1,
    borderColor: Colors.crBdr,
  },
  rowFuture: {
    borderWidth: 0,
  },

  img: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
  },
  info: { flex: 1 },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stageName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.t1,
  },
  dotCurrent: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.cr,
  },
  check: {
    fontSize: 11,
    color: Colors.up,
    fontFamily: Fonts.bold,
  },
  xpLabel: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Colors.t3,
    marginBottom: 3,
  },
  desc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    lineHeight: 17,
  },

  closeBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeTxt: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.t1,
  },
});
