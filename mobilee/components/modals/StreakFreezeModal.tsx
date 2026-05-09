// mobile/components/modals/StreakFreezeModal.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius } from '../../constants/theme';
import {
  progressApi,
  STREAK_FREEZE_COST_COINS,
  STREAK_FREEZE_MAX_OWNED,
  type ProgressResponse,
} from '../../services/gamificationApi';

const ICE = '#7BC4E8'; // soft icy blue for the freeze theme

interface Props {
  visible:  boolean;
  onClose:  () => void;
  coins:    number;
  owned:    number;
  onPurchase: (next: ProgressResponse) => void;
}

function SnowflakeIcon({ size = 32, color = ICE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2v20" />
      <Path d="M3.5 7l17 10" />
      <Path d="M3.5 17l17-10" />
      <Path d="M9 4l3 3 3-3" />
      <Path d="M9 20l3-3 3 3" />
      <Path d="M2 9l3 3-3 3" />
      <Path d="M22 9l-3 3 3 3" />
    </Svg>
  );
}

function CoinIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="#F5C04A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
      <Path d="M12 7v10" />
      <Path d="M9 9.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 0 2.5-2.5" />
    </Svg>
  );
}

export function StreakFreezeModal({ visible, onClose, coins, owned, onPurchase }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setBusy(false);
      scale.setValue(0.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isFull        = owned >= STREAK_FREEZE_MAX_OWNED;
  const cantAfford    = coins < STREAK_FREEZE_COST_COINS;
  const buyDisabled   = busy || isFull || cantAfford;

  async function handleBuy() {
    if (buyDisabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await progressApi.buyStreakFreeze();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onPurchase(res.data);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(ax.response?.data?.detail ?? ax.message ?? 'Purchase failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  let buyLabel = `Buy for ${STREAK_FREEZE_COST_COINS}`;
  if (isFull)        buyLabel = 'Inventory full';
  else if (cantAfford) buyLabel = 'Not enough coins';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Text style={s.label}>STREAK FREEZE</Text>

          <View style={s.iconWrap}>
            <SnowflakeIcon size={36} />
          </View>

          <Text style={s.title}>Protect your streak</Text>
          <Text style={s.subtitle}>
            One freeze covers a missed day so your streak stays alive — even if you're sick or away.
          </Text>

          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>Owned</Text>
              <Text style={s.statValue}>{owned} <Text style={s.statValueDim}>/ {STREAK_FREEZE_MAX_OWNED}</Text></Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>Your coins</Text>
              <View style={s.coinsLine}>
                <CoinIcon size={14} />
                <Text style={s.statValue}>{coins}</Text>
              </View>
            </View>
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, buyDisabled && s.btnDisabled]}
            onPress={handleBuy}
            disabled={buyDisabled}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={Colors.s1} />
            ) : (
              <View style={s.btnInner}>
                {!isFull && !cantAfford && <CoinIcon size={14} />}
                <Text style={[s.btnText, buyDisabled && s.btnTextDisabled]}>{buyLabel}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.dismiss}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(123,196,232,0.25)',
    padding: 28,
    alignItems: 'center',
    width: 310,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    color: ICE,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(123,196,232,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(123,196,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontFamily: Fonts.bold,
    color: Colors.bone,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t2,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignSelf: 'stretch',
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.line,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
    color: Colors.t3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontFamily: Fonts.monoBold,
    color: Colors.bone,
  },
  statValueDim: {
    color: Colors.t3,
    fontSize: 14,
  },
  coinsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.dn,
    textAlign: 'center',
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  btn: {
    backgroundColor: ICE,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 14,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    backgroundColor: Colors.s4,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.s1,
    letterSpacing: 0.3,
  },
  btnTextDisabled: {
    color: Colors.t3,
  },
  dismiss: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.t3,
  },
});
