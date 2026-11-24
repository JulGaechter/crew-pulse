import { NativeTabs } from 'expo-router/native-tabs';

import { C, F } from '@/constants/crew-theme';

/** Native Tab-Leiste (auf iOS 26 "Liquid Glass") in den CrewPulse-Farben */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={C.surface}
      tintColor={C.accent}
      indicatorColor={C.accentSoft}
      iconColor={{ default: C.textMuted, selected: C.accent }}
      labelStyle={{
        default: { color: C.textMuted, fontFamily: F.medium },
        selected: { color: C.accent, fontFamily: F.semibold },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/chat.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/map.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="snaps">
        <NativeTabs.Trigger.Label>Snap</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/snap.png')} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
