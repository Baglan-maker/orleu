// mobile/app/about.tsx
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Circle, Path } from 'react-native-svg';
import Constants from 'expo-constants';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function IMail() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </Svg>
  );
}

const TEAM = [
  { name: 'Baglan Tolegenov',     email: 'tolegenov223@gmail.com' },
  { name: 'Nurmukhammed Kanafin', email: 'nurmuhammed.kanafin@gmail.com' },
  { name: 'Adilet Serikbai',      email: 'Adletserikbai2006@gmail.com' },
];

const BUILT_WITH = [
  'React Native 0.74 + Expo SDK 54',
  'Expo Router v3 (file-based navigation)',
  'Zustand v4 (state management)',
  'FastAPI + PostgreSQL + SQLAlchemy 2.0',
  'LightGBM + SHAP (ML trend classification)',
  'APScheduler (nightly ML job)',
  'JWT auth with refresh token rotation',
];

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IBack />
        </TouchableOpacity>
        <Text style={s.pageTitle}>About Orleu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* App identity block */}
        <View style={s.identityCard}>
          <Image source={require('../assets/icon.png')} style={s.appIcon} />
          <Text style={s.appName}>Orleu</Text>
          <Text style={s.appSubtitle}>Fitness Gamification</Text>
          <View style={s.versionBadge}>
            <Text style={s.versionText}>v{appVersion}</Text>
          </View>
        </View>

        {/* About section */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>ABOUT</Text>
          <View style={s.card}>
            <Text style={s.bodyText}>
              Orleu (Өрлеу — "Ascent") is a mobile fitness app with adaptive gamification driven by machine learning. A LightGBM model classifies each user's training trend as improving, plateau, or declining, and dynamically adjusts mission difficulty, narrative content, and coach messages accordingly.
            </Text>
            <View style={s.divider} />
            <Text style={s.bodyText}>
              The app is a Bachelor's thesis project at Astana IT University, Kazakhstan. It combines modern mobile development, backend engineering, and applied ML in a single cohesive system.
            </Text>
          </View>
        </View>

        {/* Team section */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>TEAM</Text>
          <View style={s.card}>
            {TEAM.map((member, i) => (
              <View key={member.email}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.memberRow}>
                  <View style={s.memberAvatar}>
                    <Text style={s.memberAvatarText}>{member.name[0]}</Text>
                  </View>
                  <View style={s.memberInfo}>
                    <Text style={s.memberName}>{member.name}</Text>
                    <View style={s.emailRow}>
                      <IMail />
                      <Text style={s.memberEmail}>{member.email}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Built with section */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>BUILT WITH</Text>
          <View style={s.card}>
            {BUILT_WITH.map((item, i) => (
              <View key={item}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.techRow}>
                  <View style={s.techDot} />
                  <Text style={s.techText}>{item}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Institution */}
        <View style={s.institutionBlock}>
          <Text style={s.institutionName}>Astana IT University</Text>
          <Text style={s.institutionSub}>Astana, Kazakhstan — 2026</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.s1 },
  scroll: { paddingBottom: 48 },

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

  identityCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  appIcon: {
    width: 72, height: 72, borderRadius: 18,
    marginBottom: 14,
  },
  appName: {
    fontSize: 24, fontFamily: Fonts.displayBold, color: Colors.t1, marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, marginBottom: 12,
  },
  versionBadge: {
    backgroundColor: Colors.s4, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.line,
  },
  versionText: { fontSize: 11, fontFamily: Fonts.mono, color: Colors.t3 },

  section:    { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionLbl: {
    fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 1.8, color: Colors.t3,
    textTransform: 'uppercase', marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.line,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.line },
  bodyText: {
    fontSize: 13, fontFamily: Fonts.regular,
    color: Colors.t2, lineHeight: 20,
    paddingHorizontal: 16, paddingVertical: 14,
  },

  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.cr,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  memberAvatarText: {
    fontSize: 16, fontFamily: Fonts.bold, color: '#fff',
  },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1, marginBottom: 3 },
  emailRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  memberEmail: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3 },

  techRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 16, paddingVertical: 11,
  },
  techDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.cr, flexShrink: 0,
  },
  techText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2, flex: 1 },

  institutionBlock: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  institutionName: {
    fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.t2, marginBottom: 4,
  },
  institutionSub: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3,
  },
});
