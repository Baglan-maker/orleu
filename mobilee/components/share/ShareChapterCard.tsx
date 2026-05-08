// mobile/components/share/ShareChapterCard.tsx
/**
 * Off-screen 1080×1920 (9:16) share artwork rendered to a PNG by
 * `react-native-view-shot` and handed to the native share sheet.
 *
 * Why off-screen: we want the *captured* PNG, not the on-device pixel
 * dimensions. The card is positioned absolutely behind everything with
 * opacity 0 — `react-native-view-shot` can still capture a non-visible
 * view as long as it's mounted in the tree. Keeping it always-mounted
 * during the modal's lifetime avoids a layout-flicker race.
 */
import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polyline, Rect, Stop } from 'react-native-svg';
import {
  Colors, Fonts,
  AvatarThemes, getCharacterImage, type AvatarStage, type AvatarThemeId,
} from '../../constants/theme';

// Story format: 1080×1920 (Instagram / Telegram / WhatsApp Stories)
export const SHARE_CARD_WIDTH  = 1080;
export const SHARE_CARD_HEIGHT = 1920;

interface Props {
  themeId:         AvatarThemeId;
  stage:           AvatarStage;
  chapterNumber:   number;
  chapterTitle?:   string;     // "The Ascent" — falls back to "Chapter N" when missing
  campaignComplete?: boolean;
  totalWorkouts:   number;
  streak:          number;
  level:           number;
}

export const ShareChapterCard = forwardRef<View, Props>(function ShareChapterCard(
  { themeId, stage, chapterNumber, chapterTitle, campaignComplete, totalWorkouts, streak, level },
  ref,
) {
  const theme = AvatarThemes[themeId] ?? AvatarThemes[0];
  const character = getCharacterImage(themeId, stage);

  const headline = campaignComplete
    ? 'CAMPAIGN CONQUERED'
    : 'CHAPTER CONQUERED';

  const titleLine = (chapterTitle && chapterTitle.trim())
    ? chapterTitle
    : `Chapter ${chapterNumber}`;

  return (
    <View ref={ref} collapsable={false} style={s.root}>
      {/* Background gradient — theme accent at top, deep void at bottom */}
      <Svg width={SHARE_CARD_WIDTH} height={SHARE_CARD_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={theme.color} stopOpacity="0.32"/>
            <Stop offset="0.4" stopColor={Colors.s1}   stopOpacity="1"/>
            <Stop offset="1"   stopColor={Colors.void} stopOpacity="1"/>
          </LinearGradient>
        </Defs>
        <Rect width={SHARE_CARD_WIDTH} height={SHARE_CARD_HEIGHT} fill="url(#bg)"/>
      </Svg>

      {/* Top brand pill */}
      <View style={s.topRow}>
        <View style={[s.brandPill, { borderColor: theme.color }]}>
          <View style={[s.brandDot, { backgroundColor: theme.color }]}/>
          <Text style={s.brandText}>ORLEU</Text>
        </View>
      </View>

      {/* Headline */}
      <View style={s.headlineWrap}>
        <View style={[s.chapterBadge, { borderColor: theme.color, backgroundColor: `${theme.color}14` }]}>
          <Text style={[s.chapterBadgeText, { color: theme.color }]}>
            {campaignComplete ? '★ FINALE' : `CHAPTER ${chapterNumber}`}
          </Text>
        </View>
        <Text style={s.headline}>{headline}</Text>
        <Text style={s.title} numberOfLines={2}>{titleLine}</Text>
      </View>

      {/* Character art */}
      <View style={s.characterWrap}>
        {/* Soft glow behind the character */}
        <View style={[s.characterGlow, { backgroundColor: theme.color }]}/>
        <Image source={character} style={s.character} resizeMode="contain"/>
      </View>

      {/* Stat tiles */}
      <View style={s.statsRow}>
        <Stat value={String(totalWorkouts)} label="SESSIONS"  accent={theme.color}/>
        <Stat value={`Lv ${level}`}         label="LEVEL"     accent={theme.color}/>
        <Stat value={`${streak}d`}          label="STREAK"    accent={theme.color}/>
      </View>

      {/* Closing tagline */}
      <View style={s.bottomRow}>
        <View style={s.taglineWrap}>
          <CheckIcon color={theme.color}/>
          <Text style={s.tagline}>The story continues.</Text>
        </View>
        <Text style={s.cta}>orleu · level up your training</Text>
      </View>
    </View>
  );
});

function Stat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={s.statTile}>
      <Text style={[s.statValue, { color: Colors.bone }]}>{value}</Text>
      <View style={[s.statRule, { backgroundColor: accent }]}/>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12"/>
    </Svg>
  );
}

const s = StyleSheet.create({
  root: {
    width:  SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: Colors.s1,
    paddingHorizontal: 80,
    paddingTop: 100,
    paddingBottom: 90,
    alignItems: 'center',
  },

  // Top pill
  topRow: { width: '100%', alignItems: 'flex-start' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  brandDot:  { width: 14, height: 14, borderRadius: 7 },
  brandText: {
    fontSize: 28, fontFamily: Fonts.bold, letterSpacing: 6, color: Colors.bone,
  },

  // Headline block
  headlineWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 60,
  },
  chapterBadge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginBottom: 30,
  },
  chapterBadgeText: {
    fontSize: 26, fontFamily: Fonts.bold, letterSpacing: 5,
  },
  headline: {
    fontSize: 56,
    fontFamily: Fonts.displayBold,
    color: Colors.bone,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 84,
    fontFamily: Fonts.displayBold,
    color: Colors.bone,
    letterSpacing: -2.5,
    textAlign: 'center',
    lineHeight: 92,
  },

  // Character
  characterWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  characterGlow: {
    position: 'absolute',
    width: 720,
    height: 720,
    borderRadius: 360,
    opacity: 0.18,
  },
  character: {
    width: '100%',
    height: '100%',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 18,
    marginBottom: 60,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.line,
    paddingVertical: 36,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 60,
    fontFamily: Fonts.monoBold,
    letterSpacing: -1.5,
  },
  statRule: {
    width: 36, height: 4, borderRadius: 2,
    marginVertical: 18,
  },
  statLabel: {
    fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 3.5,
    color: Colors.t2,
  },

  // Bottom
  bottomRow: { width: '100%', alignItems: 'center', gap: 20 },
  taglineWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  tagline: {
    fontSize: 30, fontFamily: Fonts.semiBold, color: Colors.bone, letterSpacing: -0.4,
  },
  cta: {
    fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 3.2,
    color: Colors.t2, textTransform: 'uppercase',
  },
});
