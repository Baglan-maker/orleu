import { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Path, Circle, Line } from 'react-native-svg';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

function IClose() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.t1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function ICrown() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 7l4 9h12l4-9-6 4-4-7-4 7-6-4z" />
      <Line x1="6" y1="20" x2="18" y2="20" />
    </Svg>
  );
}

function ICheck() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.cr} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

function ISpark() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill={Colors.cr} stroke="none">
      <Path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </Svg>
  );
}

const FEATURES = [
  { title: 'Unlimited workouts',     sub: 'Track as many sessions as you want, no weekly cap.' },
  { title: 'Full AI coach',          sub: 'Personalized guidance from the ML model every day.' },
  { title: 'All campaigns + missions', sub: 'Unlock every storyline and adaptive mission branch.' },
  { title: 'Advanced analytics',     sub: 'Trend insights, SHAP explanations, deep history.' },
  { title: 'Nutrition tracking',     sub: 'Macro goals, food log, and buff system.' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleStartTrial() {
    setLoading(true);
    // Wire to billing later (Apple/Google IAP via RevenueCat).
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Coming soon',
        'Subscription billing is not connected yet. This is a preview of the Pro upgrade flow.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }, 600);
  }

  function handleRestore() {
    Alert.alert('Restore Purchases', 'No previous subscription found on this account.');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ width: 36 }} />
        <Text style={s.pageTitle}>Orleu Pro</Text>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IClose />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.crownBox}>
            <ICrown />
          </View>
          <View style={s.tagPill}>
            <ISpark />
            <Text style={s.tagText}>PRO</Text>
          </View>
          <Text style={s.heroTitle}>Train without limits</Text>
          <Text style={s.heroSub}>
            Unlock the full Orleu experience — adaptive missions, AI coach,
            and deep performance insights.
          </Text>
        </View>

        {/* Features */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>WHAT YOU GET</Text>
          <View style={s.card}>
            {FEATURES.map((f, i) => (
              <View key={f.title}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.featureRow}>
                  <View style={s.checkBox}>
                    <ICheck />
                  </View>
                  <View style={s.featureInfo}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureSub}>{f.sub}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>PLAN</Text>
          <View style={s.planCard}>
            <View style={s.planTopRow}>
              <View>
                <Text style={s.planName}>Monthly</Text>
                <Text style={s.planTrial}>30 days free, then auto-renews</Text>
              </View>
              <View style={s.priceBox}>
                <Text style={s.priceCurrency}>$</Text>
                <Text style={s.priceAmount}>10</Text>
                <Text style={s.pricePer}>/mo</Text>
              </View>
            </View>

            <View style={s.planDivider} />

            <View style={s.trialRow}>
              <View style={s.trialDot} />
              <Text style={s.trialText}>
                <Text style={s.trialStrong}>Free for 30 days.</Text>{' '}
                You won't be charged until the trial ends.
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            style={[s.cta, loading && { opacity: 0.6 }]}
            onPress={handleStartTrial}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>
              {loading ? 'Loading…' : 'Start 30-day free trial'}
            </Text>
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            Auto-renewable subscription. $10/month after the free trial.
            Cancel anytime in your App Store or Play Store account.
          </Text>

          <View style={s.footerLinks}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={s.linkText}>Restore</Text>
            </TouchableOpacity>
            <View style={s.linkDot} />
            <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
              <Text style={s.linkText}>Privacy</Text>
            </TouchableOpacity>
            <View style={s.linkDot} />
            <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
              <Text style={s.linkText}>Terms</Text>
            </TouchableOpacity>
          </View>
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
  pageTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.t1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s3, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: Spacing.xl,
  },
  crownBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.crLo,
    borderWidth: 1, borderColor: Colors.crBdr,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.crLo,
    borderWidth: 1, borderColor: Colors.crBdr,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: 14,
  },
  tagText: {
    fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.5,
    color: Colors.cr,
  },
  heroTitle: {
    fontSize: 26, fontFamily: Fonts.displayBold, color: Colors.t1,
    marginBottom: 8, textAlign: 'center',
  },
  heroSub: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.t2,
    lineHeight: 20, textAlign: 'center',
  },

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

  featureRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  checkBox: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.crLo,
    borderWidth: 1, borderColor: Colors.crBdr,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2, flexShrink: 0,
  },
  featureInfo: { flex: 1 },
  featureTitle: {
    fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.t1,
    marginBottom: 3,
  },
  featureSub: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2,
    lineHeight: 17,
  },

  planCard: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.crBdr,
    padding: 16,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planName: {
    fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.t1,
    marginBottom: 3,
  },
  planTrial: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceCurrency: {
    fontSize: 14, fontFamily: Fonts.monoBold, color: Colors.t1,
    marginRight: 1,
  },
  priceAmount: {
    fontSize: 32, fontFamily: Fonts.monoBold, color: Colors.t1,
    lineHeight: 34,
  },
  pricePer: {
    fontSize: 12, fontFamily: Fonts.mono, color: Colors.t3,
    marginLeft: 2,
  },
  planDivider: {
    height: 1, backgroundColor: Colors.line,
    marginVertical: 14,
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trialDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.cr,
    marginTop: 6, flexShrink: 0,
  },
  trialText: {
    flex: 1,
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.t2,
    lineHeight: 18,
  },
  trialStrong: {
    fontFamily: Fonts.semiBold, color: Colors.t1,
  },

  ctaWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  cta: {
    backgroundColor: Colors.cr,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15, fontFamily: Fonts.bold, color: '#fff',
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.t3,
    textAlign: 'center', lineHeight: 16,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  linkText: {
    fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.t2,
  },
  linkDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: Colors.t3,
  },
});
