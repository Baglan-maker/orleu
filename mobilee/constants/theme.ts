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
    { id: 0, name: 'Steel',  color: '#C8343A', accent: '#E8E0D4' },
    { id: 1, name: 'Frost',  color: '#4A7FC1', accent: '#8DB4E3' },
    { id: 2, name: 'Forge',  color: '#B87C3A', accent: '#D4A96A' },
    { id: 3, name: 'Shadow', color: '#7C5BB5', accent: '#A899D4' },
  ] as const;
  
  export type AvatarThemeId = 0 | 1 | 2 | 3;