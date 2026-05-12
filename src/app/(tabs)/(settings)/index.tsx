import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { 
  Host, 
  Column, 
  Text, 
  ListItem, 
  LazyColumn,
  Button,
  LinearProgressIndicator,
  Box
} from "@expo/ui/jetpack-compose";
import { 
  fillMaxWidth, 
  paddingAll, 
  fillMaxHeight,
  height
} from "@expo/ui/jetpack-compose/modifiers";
import { Snackbar } from 'react-native-snackbar';
import { buildFullTextIndex } from '@/services/DataService';

export default function SettingsScreen() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Idle");

  const handleStartIndexing = async () => {
    setIsIndexing(true);
    setStatus("Indexing...");
    try {
      await buildFullTextIndex((processed, total) => {
        setProgress(processed / total);
        setStatus(`Indexed ${processed} of ${total} suttas`);
      });
      setStatus("Indexing Complete");
      Snackbar.show({
        text: 'Search Index built successfully!',
        duration: Snackbar.LENGTH_LONG,
        backgroundColor: '#34C759'
      });
    } catch (err) {
      console.error(err);
      setStatus("Indexing Failed");
      Snackbar.show({
        text: 'Failed to build Search Index',
        duration: Snackbar.LENGTH_LONG,
        backgroundColor: '#FF3B30'
      });
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <Host style={{ flex: 1 }}>
      <LazyColumn modifiers={[fillMaxWidth(), fillMaxHeight()]}>
        <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Text style={{ typography: "titleLarge" }}>Appearance</Text>
        </Column>

        <ListItem modifiers={[fillMaxWidth()]}>
          <ListItem.HeadlineContent>
            <Text>Theme</Text>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <Text>System Default</Text>
          </ListItem.SupportingContent>
        </ListItem>

        <Box modifiers={[fillMaxWidth(), height(16)]} />

        <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Text style={{ typography: "titleLarge" }}>Data Management</Text>
        </Column>

        <ListItem modifiers={[fillMaxWidth()]}>
          <ListItem.HeadlineContent>
            <Text>Search Index</Text>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <Text>{status}</Text>
          </ListItem.SupportingContent>
          <ListItem.TrailingContent>
            {!isIndexing ? (
              <Button onClick={handleStartIndexing}>
                <Text>Build</Text>
              </Button>
            ) : null}
          </ListItem.TrailingContent>
        </ListItem>

        {isIndexing && (
          <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
            <LinearProgressIndicator 
              progress={progress} 
              modifiers={[fillMaxWidth()]} 
            />
          </Column>
        )}

        <Box modifiers={[fillMaxWidth(), height(16)]} />

        <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Text style={{ typography: "titleLarge" }}>About</Text>
        </Column>

        <ListItem modifiers={[fillMaxWidth()]}>
          <ListItem.HeadlineContent>
            <Text>Version</Text>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <Text>1.2.0 (Build 56)</Text>
          </ListItem.SupportingContent>
        </ListItem>
      </LazyColumn>
    </Host>
  );
}
