import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function RootLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(library)">
        <Icon sf="books.vertical" />
        <Label>Library</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="(bookmarks)">
        <Icon sf="bookmark" />
        <Label>Bookmarks</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="(settings)">
        <Icon sf="gear" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
