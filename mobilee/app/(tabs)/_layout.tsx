// mobile/app/(tabs)/_layout.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius } from '../../constants/theme';

// ─── SVG иконки (inline, без доп. библиотек) ─────────────────────
import Svg, { Line, Polygon, Circle, Polyline, Rect, Path } from 'react-native-svg';

function IconDumbbell({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5h1v11h-1zM16.5 6.5h1v11h-1z" stroke={color}/>
      <Line x1="4" y1="9" x2="7.5" y2="9"/><Line x1="4" y1="15" x2="7.5" y2="15"/>
      <Line x1="16.5" y1="9" x2="20" y2="9"/><Line x1="16.5" y1="15" x2="20" y2="15"/>
      <Line x1="7.5" y1="12" x2="16.5" y2="12"/>
    </Svg>
  );
}
function IconMap({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z"/>
      <Line x1="9" y1="3" x2="9" y2="17"/><Line x1="15" y1="7" x2="15" y2="21"/>
    </Svg>
  );
}
function IconTarget({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/><Circle cx="12" cy="12" r="5.5"/>
      <Circle cx="12" cy="12" r="1.5" fill={color} stroke="none"/>
    </Svg>
  );
}
function IconBarChart({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="9"/><Line x1="12" y1="20" x2="12" y2="4"/>
      <Line x1="6"  y1="20" x2="6"  y2="13"/><Line x1="2" y1="20" x2="22" y2="20"/>
    </Svg>
  );
}

const TABS = [
  { name: 'index',    label: 'Log',      Icon: IconDumbbell },
  { name: 'campaign', label: 'Map',      Icon: IconMap      },
  { name: 'missions', label: 'Missions', Icon: IconTarget   },
  { name: 'stats',    label: 'Stats',    Icon: IconBarChart },
] as const;

// ─── Кастомный tab bar ────────────────────────────────────────────
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((tab, i) => {
        const focused = state.index === i;
        const color   = focused ? Colors.cr : Colors.t3;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabBtn, focused && styles.tabBtnActive]}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <tab.Icon color={color}/>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props}/>}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"/>
      <Tabs.Screen name="campaign"/>
      <Tabs.Screen name="missions"/>
      <Tabs.Screen name="stats"/>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,15,16,0.97)',
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', gap: 5,
    paddingVertical: 8, borderRadius: Radius.md,
  },
  tabBtnActive: {
    backgroundColor: Colors.crLo,
  },
  tabLabel: {
    fontSize: 9, fontFamily: Fonts.bold,
    letterSpacing: 0.8, color: Colors.t3, textTransform: 'uppercase',
  },
  tabLabelActive: { color: Colors.cr },
});