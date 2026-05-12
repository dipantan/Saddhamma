import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { 
  Host, 
  Column, 
  Text, 
  ModalBottomSheet,
  Button,
  LazyColumn,
  ListItem
} from "@expo/ui/jetpack-compose";
import { 
  fillMaxWidth, 
  paddingAll, 
  fillMaxHeight,
  clickable
} from "@expo/ui/jetpack-compose/modifiers";
import { getSuttaContent } from "@/services/DataService";

export default function ReaderScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [content, setContent] = useState<any>(null);
  const [showComments, setShowComments] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  useEffect(() => {
    loadSutta();
  }, [uid]);

  const loadSutta = async () => {
    const data = await getSuttaContent(uid);
    setContent(data);
  };

  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: uid.toUpperCase() }} />
      
      <LazyColumn modifiers={[fillMaxWidth(), fillMaxHeight()]}>
        {/* Header Section */}
        <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Text style={{ typography: "headlineMedium" }}>
            {uid.toUpperCase()}
          </Text>
        </Column>

        {/* Text Segments */}
        {content && Object.entries(content).map(([key, text]: [string, any]) => (
          <ListItem
            key={key}
            modifiers={[
              fillMaxWidth(),
              clickable(() => {
                setSelectedSegment(key);
                setShowComments(true);
              })
            ]}
          >
            <ListItem.HeadlineContent>
              <Text>{text as string}</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>{key}</Text>
            </ListItem.SupportingContent>
          </ListItem>
        ))}
      </LazyColumn>

      {showComments && (
        <ModalBottomSheet
          onDismissRequest={() => setShowComments(false)}
        >
          <Column modifiers={[fillMaxWidth(), paddingAll(24)]}>
            <Text style={{ typography: "titleLarge" }}>Segment Info</Text>
            <Text color="#666" modifiers={[paddingAll(8)]}>
              ID: {selectedSegment}
            </Text>
            <Text>
              Notes and references for this segment would appear here.
            </Text>
            <Button 
              onClick={() => setShowComments(false)}
              modifiers={[fillMaxWidth(), paddingAll(16)]}
            >
              <Text>Close</Text>
            </Button>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
