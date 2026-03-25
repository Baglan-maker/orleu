// mobile/components/achievement/AchievementIcon.tsx
import Svg, { Line, Path, Polygon, Polyline } from 'react-native-svg';

interface Props {
  iconKey: string;
  color:   string;
  size?:   number;
}

/**
 * Maps icon_key to a stroke-only SVG icon.
 * Supports exact keys (trophy, fire, dumbbell, map, crown, bolt, star, shield)
 * and prefix-based keys from seed data (streak_* → fire, session_* → dumbbell, mission_* → trophy).
 */
export function AchievementIcon({ iconKey, color, size = 24 }: Props) {
  const prefix = iconKey.split('_')[0];
  const key = ['trophy', 'fire', 'dumbbell', 'map', 'crown', 'bolt', 'star', 'shield'].includes(iconKey)
    ? iconKey
    : prefix;

  const p = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (key) {
    case 'fire':
    case 'streak':
      return (
        <Svg {...p}>
          <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </Svg>
      );

    case 'dumbbell':
    case 'session':
      return (
        <Svg {...p}>
          <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z"/>
          <Line x1="4" y1="9" x2="7.5" y2="9"/>
          <Line x1="4" y1="15" x2="7.5" y2="15"/>
          <Line x1="16.5" y1="9" x2="20" y2="9"/>
          <Line x1="16.5" y1="15" x2="20" y2="15"/>
          <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
        </Svg>
      );

    case 'trophy':
    case 'mission':
      return (
        <Svg {...p}>
          <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <Path d="M4 22h16"/>
          <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </Svg>
      );

    case 'map':
      return (
        <Svg {...p}>
          <Path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z"/>
          <Line x1="9" y1="3" x2="9" y2="17"/>
          <Line x1="15" y1="7" x2="15" y2="21"/>
        </Svg>
      );

    case 'crown':
      return (
        <Svg {...p}>
          <Path d="M3 19h18"/>
          <Path d="M3 19l3-10 4.5 4 1.5-8 1.5 8 4.5-4 3 10"/>
        </Svg>
      );

    case 'bolt':
      return (
        <Svg {...p}>
          <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </Svg>
      );

    case 'star':
      return (
        <Svg {...p}>
          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </Svg>
      );

    case 'shield':
      return (
        <Svg {...p}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </Svg>
      );

    default:
      return (
        <Svg {...p}>
          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </Svg>
      );
  }
}
