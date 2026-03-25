// mobile/components/avatar/MomentumRing.tsx
import Svg, { Circle } from 'react-native-svg';

interface MomentumRingProps {
  pct:    number;   // 0–100
  color:  string;
  size?:  number;   // default 120
}

export function MomentumRing({ pct, color, size = 120 }: MomentumRingProps) {
  const cx   = size / 2;
  const r    = size * 0.433;
  const C    = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * C;

  return (
    <Svg
      width={size}
      height={size}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {/* Track */}
      <Circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={2.5}
      />
      {/* Progress arc */}
      <Circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={`${dash} ${C}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${cx}, ${cx}`}
      />
    </Svg>
  );
}
