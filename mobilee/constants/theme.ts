// mobile/constants/theme.ts

export const Colors = {
    // ── Surfaces ──────────────────────────────────────────────────
    void:  '#080809',
    s1:    '#0F0F10',   // основной фон (экраны)
    s2:    '#141415',   // карточки
    s3:    '#1A1A1C',   // инпуты, строки упражнений
    s4:    '#202022',   // иконки-боксы, stat boxes
    s5:    '#282829',   // неактивные точки прогресса
  
    // ── Accent — Deep Crimson ──────────────────────────────────────
    cr:     '#C8343A',
    crLo:   'rgba(200,52,58,0.09)',
    crMid:  'rgba(200,52,58,0.16)',
    crBdr:  'rgba(200,52,58,0.28)',
  
    // ── Bone white ────────────────────────────────────────────────
    bone:    '#E8E0D4',
    boneLo:  'rgba(232,224,212,0.06)',
    boneMid: 'rgba(232,224,212,0.10)',
  
    // ── Text ──────────────────────────────────────────────────────
    t1: '#E8E0D4',   // primary   — всегда видимый
    t2: '#7A7570',   // secondary — подписи, hints
    t3: '#3E3C39',   // tertiary  — лейблы, placeholder
  
    // ── Dividers ──────────────────────────────────────────────────
    line:  'rgba(255,255,255,0.055)',
    lineH: 'rgba(255,255,255,0.09)',
  
    // ── Semantic (trend) ──────────────────────────────────────────
    up:    '#6B9E6B',              // improving
    upLo:  'rgba(107,158,107,0.10)',
    flat:  '#A89060',              // plateau
    dn:    '#C8343A',              // declining (same as accent)
    dnLo:  'rgba(200,52,58,0.09)',

    // ── Macro bars ────────────────────────────────────────────────
    macroProtein: '#C8343A',       // same as cr — protein bar
    macroCarbs:   '#A89060',       // amber/flat — carbs bar
    macroFat:     '#4A7FC1',       // frost blue — fat bar
  } as const;
  
  export const Fonts = {
    // Jakarta Sans — основной текст
    regular:     'PlusJakartaSans_400Regular',
    medium:      'PlusJakartaSans_500Medium',
    semiBold:    'PlusJakartaSans_600SemiBold',
    bold:        'PlusJakartaSans_700Bold',
    extraBold:   'PlusJakartaSans_800ExtraBold',
  
    // Outfit — заголовки / display
    displayBold: 'Outfit_700Bold',
    displayBlack:'Outfit_900Black',
  
    // JetBrains Mono — цифры, XP, stats
    mono:        'JetBrainsMono_400Regular',
    monoBold:    'JetBrainsMono_700Bold',
  } as const;
  
  export const Radius = {
    sm:   10,
    md:   13,
    lg:   16,
    xl:   18,
    xxl:  20,
    full: 999,
  } as const;
  
  export const Spacing = {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    xxl: 24,
    '3xl': 32,
  } as const;
  
  // Типы аватаров — соответствуют THEMES в дизайне
  export const AvatarThemes = [
    { id: 0, name: 'Steel',  color: Colors.cr   },
    { id: 1, name: 'Frost',  color: '#4A7FC1'   },
    { id: 2, name: 'Forge',  color: '#B87C3A'   },
    { id: 3, name: 'Shadow', color: '#7C5BB5'   },
  ] as const;

  export type AvatarThemeId = 0 | 1 | 2 | 3;
  export type AvatarStage   = 0 | 1 | 2 | 3 | 4;

  // Stage is purely derived from level: level 1 → stage 0, level 5 → stage 4
  export function stageFromLevel(level: number): AvatarStage {
    return Math.min(4, Math.max(0, level - 1)) as AvatarStage;
  }

  // character roster — id maps to user.avatar_theme_id
  export const CHARACTERS = [
    { id: 0, name: 'Ares'    },
    { id: 1, name: 'Phantom' },
    { id: 2, name: 'Titan'   },
    { id: 3, name: 'Wraith'  },
  ] as const;

  // XP required to advance from level `lvl` to the next.
  // 5 levels total; level 5 is the cap (returns 0 → "MAX").
  // Must stay in sync with backend/app/api/workouts.py _XP_THRESHOLDS.
  const _XP_PER_LEVEL = [500, 1_500, 4_000, 9_000] as const;

  export function xpForLevel(lvl: number): number {
    if (lvl < 1 || lvl >= 5) return 0; // level 5 = max, no further XP gate
    return _XP_PER_LEVEL[lvl - 1];
  }

  // [characterId][stage] → require(PNG)  stage 0 = lvl1, stage 4 = lvl5
  const _CHARACTER_IMAGES: Record<number, Record<AvatarStage, number>> = {
    0: {
      0: require('../assets/character1-lvl1.png'),
      1: require('../assets/character1-lvl2.png'),
      2: require('../assets/character1-lvl3.png'),
      3: require('../assets/character1-lvl4.png'),
      4: require('../assets/character1-lvl5.png'),
    },
    1: {
      0: require('../assets/character2-lvl1.png'),
      1: require('../assets/character2-lvl2.png'),
      2: require('../assets/character2-lvl3.png'),
      3: require('../assets/character2-lvl4.png'),
      4: require('../assets/character2-lvl5.png'),
    },
    2: {
      0: require('../assets/character3-lvl1.png'),
      1: require('../assets/character3-lvl2.png'),
      2: require('../assets/character3-lvl3.png'),
      3: require('../assets/character3-lvl4.png'),
      4: require('../assets/character3-lvl5.png'),
    },
    3: {
      0: require('../assets/character4-lvl1.png'),
      1: require('../assets/character4-lvl2.png'),
      2: require('../assets/character4-lvl3.png'),
      3: require('../assets/character4-lvl4.png'),
      4: require('../assets/character4-lvl5.png'),
    },
  };

  export function getCharacterImage(characterId: number, stage: AvatarStage): number {
    return (_CHARACTER_IMAGES[characterId] ?? _CHARACTER_IMAGES[0])[stage];
  }