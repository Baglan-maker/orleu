import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

function IBack() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

const SECTIONS = [
  {
    title: '1. Introduction',
    body: `Orleu ("the App") is a fitness gamification application developed as an academic project at Astana IT University. This Privacy Policy explains how we collect, use, and protect your personal information when you use the App.\n\nBy creating an account and using Orleu, you agree to the practices described in this Policy. If you do not agree, please discontinue use of the App.`,
  },
  {
    title: '2. Information We Collect',
    body: `We collect the following categories of information:\n\n• Account Information: Your name, email address, and hashed password, which you provide during registration.\n\n• Profile & Fitness Data: Your training goal (strength, hypertrophy, or endurance), experience level, and avatar preferences.\n\n• Workout Data: Exercise names, sets, reps, weight, workout duration, and timestamps for each session you log.\n\n• Nutrition Data: Food items, meal types, quantities (grams), and dates that you manually log. Macro targets you set.\n\n• Gamification Data: XP, level, coins, streak count, mission progress, campaign chapter progress, and achievements.\n\n• Usage Data: Timestamps of app activity used to compute streak and ML training features such as session frequency and consistency scores.`,
  },
  {
    title: '3. How We Use Your Information',
    body: `We use your information solely to provide and improve the App's features:\n\n• To authenticate you and manage your session securely.\n\n• To display your workout history, nutrition logs, and gamification progress.\n\n• To compute ML-driven insights (trend classification: improving / plateau / declining) using aggregated workout features. No raw personal data is shared with external ML services.\n\n• To generate in-app coach messages personalized to your training trend.\n\n• To maintain and update your streak, level, XP, and mission state.\n\nWe do not use your data for advertising, and we do not sell your data to any third party.`,
  },
  {
    title: '4. Data Storage & Security',
    body: `Your data is stored on a PostgreSQL database hosted on a server operated by the development team. The following security measures are in place:\n\n• Passwords are stored as bcrypt hashes — we never store plaintext passwords.\n\n• Authentication uses short-lived JWT access tokens (15 minutes) and rotating refresh tokens (7 days), both transmitted over HTTPS.\n\n• Refresh tokens are stored as SHA-256 hashes on the server. A compromised token is invalidated on the next rotation.\n\n• Device tokens are stored locally using iOS/Android secure storage (expo-secure-store), not plain AsyncStorage.\n\nWhile we take reasonable precautions, no system is completely secure. Use a strong, unique password for your account.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your data for as long as your account is active. You may delete your account at any time from the Profile screen (Settings > Delete Account). Upon deletion:\n\n• Your user record and all associated data (workouts, nutrition logs, missions, ML predictions, coach messages, achievements) are permanently deleted from our database.\n\n• This action is irreversible. We do not retain backups of deleted accounts.\n\nIf you wish to keep a copy of your data before deleting, use the Export My Data feature (Settings > Export My Data) to download a JSON file of your account data.`,
  },
  {
    title: '6. Data Sharing',
    body: `We do not sell or rent your personal information to third parties.\n\nOne automated exception: to generate the natural-language "coach message" attached to each ML prediction, the backend sends a small, non-identifying snapshot to OpenRouter (an LLM API gateway). This snapshot contains only: the predicted trend ("improving" / "plateau" / "declining"), the top model-explainability values (SHAP), and a short context block (experience level, primary goal, level, current streak, total workouts). It does NOT contain your name, email, account ID, photos, individual workout history, or location. If the LLM call fails for any reason, a hardcoded template message is used instead.\n\nWe will also disclose information if required by law (e.g., a valid court order), in which case we will notify you to the extent permitted by law.\n\nAggregated, anonymized data (e.g., average workout frequency across all users) may be used for academic research purposes in the context of the thesis project. This data cannot be used to identify any individual user.`,
  },
  {
    title: '7. Children\'s Privacy',
    body: `Orleu is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us and we will delete the information promptly.`,
  },
  {
    title: '8. Your Rights',
    body: `Depending on your jurisdiction, you may have the following rights regarding your personal data:\n\n• Access: You can export a copy of all data associated with your account via Settings > Export My Data.\n\n• Correction: You can update your name, goal, experience level, and password at any time from the Profile screen.\n\n• Deletion: You can permanently delete your account and all associated data via Settings > Delete Account.\n\n• Portability: Your exported data is provided in JSON format, which is machine-readable and transferable.\n\nTo exercise any right not covered by in-app features, contact us at the address below.`,
  },
  {
    title: '9. Third-Party Services',
    body: `The App uses the following third-party services:\n\n• Expo (Expo Go / EAS Build): The development framework used to build and run the App. Subject to Expo's own privacy policy.\n\n• React Native: The UI framework. No data is sent to Meta by the framework itself.\n\n• OpenRouter (openrouter.ai): An LLM API gateway used server-side to generate the natural-language text of coach messages. See Section 6 for the exact data sent. Subject to OpenRouter's own privacy policy.\n\nWe do not integrate analytics SDKs (e.g., Firebase Analytics, Mixpanel, Amplitude) or advertising networks.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. If we make material changes, we will notify you via an in-app notice. The "Last updated" date at the bottom of this policy will reflect the most recent revision.\n\nYour continued use of the App after changes are posted constitutes your acceptance of the revised policy.`,
  },
  {
    title: '11. Contact',
    body: `If you have questions or concerns about this Privacy Policy or how your data is handled, please contact the development team:\n\nBaglan Tolegenov\ntolegenov223@gmail.com\n\nNurmukhammed Kanafin\nnurmuhammed.kanafin@gmail.com\n\nAstana IT University\nAstana, Kazakhstan`,
  },
];

export default function PrivacyScreen() {
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
        <Text style={s.pageTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.lastUpdated}>Last updated: May 2026</Text>

        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>
            Orleu is an academic project by students of Astana IT University.
          </Text>
        </View>
      </ScrollView>
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

  lastUpdated: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    marginBottom: Spacing.lg,
    marginTop: 4,
  },

  section:      { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.t1,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    lineHeight: 20,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
  },
  footerText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.t3,
    textAlign: 'center',
  },
});
