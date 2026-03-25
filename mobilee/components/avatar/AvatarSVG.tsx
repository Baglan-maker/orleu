// mobile/components/avatar/AvatarSVG.tsx
import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Filter, FeGaussianBlur, FeMerge, FeMergeNode,
  Circle, Ellipse, Line, Path, Rect,
} from 'react-native-svg';
import { AvatarThemes } from '../../constants/theme';
import type { AvatarThemeId, AvatarStage } from '../../constants/theme';

interface AvatarSVGProps {
  themeId:      AvatarThemeId;
  stage:        AvatarStage;
  size?:        number;
  celebrating?: boolean;
}

// sh=shoulder half-width, tw=torso-top half-width, th=torso height,
// hw=hip half-width, aw=arm stroke, lw=leg stroke, hr=head radius
const BP = [
  { sh: 15, tw: 16, th: 25, hw: 11, aw: 3.2, lw: 4.2, hr:  8.2 },
  { sh: 18, tw: 19, th: 26, hw: 13, aw: 4.2, lw: 5.2, hr:  8.8 },
  { sh: 22, tw: 23, th: 27, hw: 15, aw: 5.3, lw: 6.3, hr:  9.3 },
  { sh: 27, tw: 28, th: 28, hw: 17, aw: 6.7, lw: 7.8, hr:  9.8 },
  { sh: 32, tw: 33, th: 29, hw: 19, aw: 8.2, lw: 9.2, hr: 10.3 },
] as const;

const CX = 50;
const HY = 13; // head center y

export function AvatarSVG({ themeId, stage, size = 80, celebrating = false }: AvatarSVGProps) {
  const b     = BP[stage];
  const color = AvatarThemes[themeId].color;

  const gradId = `orleu_grad_${themeId}_${stage}`;
  const filtId = `orleu_filt_${themeId}_${stage}`;
  const auraId = `orleu_aura_${themeId}_${stage}`;

  const sy = HY + b.hr + 4;   // shoulder / torso-top y
  const te = sy + b.th;        // hip / torso-bottom y

  // Arm endpoints
  const lae = { x: CX - b.sh - 5, y: sy + 19 };
  const rae = { x: CX + b.sh + 5, y: sy + 19 };

  // Leg joints + feet
  const lk = { x: CX - b.hw * 0.47, y: te + 19 };
  const rk = { x: CX + b.hw * 0.47, y: te + 19 };
  const lf = { x: CX - b.hw * 0.31, y: te + 37 };
  const rf = { x: CX + b.hw * 0.31, y: te + 37 };

  const torsoPath = `M${CX - b.sh} ${sy} L${CX + b.sh} ${sy} L${CX + b.hw} ${te} L${CX - b.hw} ${te} Z`;

  // ── Animations ──────────────────────────────────────────────────
  const breatheAnim   = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const loopRef       = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (celebrating) {
      loopRef.current?.stop();
      celebrateAnim.setValue(0);
      Animated.sequence([
        Animated.timing(celebrateAnim, {
          toValue: 1, duration: 300, useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(celebrateAnim, {
          toValue: 0, duration: 450, useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
      ]).start();
      return;
    }
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1, duration: 2000, useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(breatheAnim, {
          toValue: 0, duration: 2000, useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [celebrating]);

  const translateY     = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const breatheScale   = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const celebrateScale = celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  const animStyle = celebrating
    ? { transform: [{ scale: celebrateScale }] }
    : { transform: [{ translateY }, { scale: breatheScale }] };

  return (
    <Animated.View style={[animStyle, { width: size, height: size * 1.3 }]}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 100 130">
        <Defs>
          <LinearGradient id={gradId} x1="25%" y1="0%" x2="75%" y2="100%">
            <Stop offset="0"   stopColor={color} stopOpacity={1}   />
            <Stop offset="1"   stopColor={color} stopOpacity={0.6} />
          </LinearGradient>
          {stage >= 3 && (
            <RadialGradient id={auraId} cx="50%" cy="50%" r="50%">
              <Stop offset="0"   stopColor={color} stopOpacity={0.1} />
              <Stop offset="1"   stopColor={color} stopOpacity={0}   />
            </RadialGradient>
          )}
          <Filter id={filtId} x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation="0.9" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        {/* 1. Aura (stage >= 3) */}
        {stage >= 3 && (
          <Ellipse
            cx={CX} cy={te - 6}
            rx={b.tw + 15} ry={b.th * 0.5}
            fill={`url(#${auraId})`}
          />
        )}

        {/* 2. Ground shadow */}
        <Ellipse
          cx={CX} cy={126}
          rx={b.hw * 0.85} ry={2.2}
          fill={color} opacity={0.08}
        />

        {/* 3. Legs — drawn before torso so torso overlaps */}
        <Line
          x1={CX - b.hw * 0.38} y1={te} x2={lk.x} y2={lk.y}
          stroke={color} strokeWidth={b.lw} strokeLinecap="round"
        />
        <Line
          x1={lk.x} y1={lk.y} x2={lf.x} y2={lf.y}
          stroke={color} strokeWidth={b.lw} strokeLinecap="round" opacity={0.78}
        />
        <Line
          x1={CX + b.hw * 0.38} y1={te} x2={rk.x} y2={rk.y}
          stroke={color} strokeWidth={b.lw} strokeLinecap="round"
        />
        <Line
          x1={rk.x} y1={rk.y} x2={rf.x} y2={rf.y}
          stroke={color} strokeWidth={b.lw} strokeLinecap="round" opacity={0.78}
        />

        {/* 4. Torso */}
        <Path d={torsoPath} fill={`url(#${gradId})`} filter={`url(#${filtId})`} />

        {/* 5. Torso highlight — V muscle definition */}
        <Line
          x1={CX - b.sh * 0.33} y1={sy + 5} x2={CX} y2={sy + 8}
          stroke="#fff" strokeWidth={0.7} opacity={0.15}
        />
        <Line
          x1={CX + b.sh * 0.33} y1={sy + 5} x2={CX} y2={sy + 8}
          stroke="#fff" strokeWidth={0.7} opacity={0.15}
        />

        {/* 6. Arms — drawn after torso */}
        <Line
          x1={CX - b.sh} y1={sy + 3} x2={lae.x} y2={lae.y}
          stroke={color} strokeWidth={b.aw} strokeLinecap="round"
        />
        <Line
          x1={lae.x} y1={lae.y} x2={lae.x - 2} y2={lae.y + 10}
          stroke={color} strokeWidth={b.aw} strokeLinecap="round" opacity={0.72}
        />
        <Line
          x1={CX + b.sh} y1={sy + 3} x2={rae.x} y2={rae.y}
          stroke={color} strokeWidth={b.aw} strokeLinecap="round"
        />
        <Line
          x1={rae.x} y1={rae.y} x2={rae.x + 2} y2={rae.y + 10}
          stroke={color} strokeWidth={b.aw} strokeLinecap="round" opacity={0.72}
        />

        {/* 7. Neck */}
        <Rect
          x={CX - 3} y={HY + b.hr - 0.5}
          width={6} height={5.5} rx={1.6}
          fill={color} opacity={0.8}
        />

        {/* 8. Head */}
        <Circle
          cx={CX} cy={HY} r={b.hr}
          fill={`url(#${gradId})`}
          filter={`url(#${filtId})`}
        />

        {/* 9. Eyes */}
        <Circle cx={CX - b.hr * 0.3} cy={HY - 1} r={1.15} fill="#fff" opacity={0.8} />
        <Circle cx={CX + b.hr * 0.3} cy={HY - 1} r={1.15} fill="#fff" opacity={0.8} />

        {/* 10. Mouth */}
        {celebrating ? (
          <Path
            d={`M${CX - 2.5} ${HY + 2.5} Q${CX} ${HY + 5} ${CX + 2.5} ${HY + 2.5}`}
            stroke="#fff" strokeWidth={1} fill="none" opacity={0.82}
          />
        ) : (
          <Line
            x1={CX - 1.8} y1={HY + 2.5} x2={CX + 1.8} y2={HY + 2.5}
            stroke="#fff" strokeWidth={0.9} opacity={0.38}
          />
        )}

        {/* 11. Celebration particles (stage 4 only) */}
        {celebrating && stage === 4 && (
          <>
            <Circle cx={CX - 10} cy={4} r={1.8} fill={color} opacity={0.9} />
            <Circle cx={CX}      cy={2} r={1.4} fill={color} opacity={0.7} />
            <Circle cx={CX + 10} cy={4} r={1.8} fill={color} opacity={0.9} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
