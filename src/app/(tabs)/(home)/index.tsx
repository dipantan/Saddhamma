import { isDataReady } from "@/services/DataService";
import { checkForUpdates, syncData } from "@/services/SyncService";
import {
  AlertDialog,
  Button,
  Column,
  Host,
  LazyColumn,
  LinearProgressIndicator,
  CircularProgressIndicator,
  ListItem,
  SearchBar,
  Text,
  Box
} from "@expo/ui/jetpack-compose";
import {
  fillMaxHeight,
  fillMaxWidth,
  paddingAll,
  height,
  clickable
} from "@expo/ui/jetpack-compose/modifiers";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function HomeScreen() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    const ready = await isDataReady();
    setDataLoaded(ready);

    if (!ready) {
      setShowSyncDialog(true);
    } else {
      const updateAvailable = await checkForUpdates();
      if (updateAvailable) {
        // Handle background update
      }
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const success = await syncData((p) => setSyncProgress(p));
      if (success) {
        setDataLoaded(true);
        setShowSyncDialog(false);
      } else {
        setSyncError("Sync failed. Please check your connection.");
      }
    } catch (error) {
      console.error(error);
      setSyncError("An unexpected error occurred during sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Host style={{ flex: 1 }}>
      <Column modifiers={[fillMaxWidth(), fillMaxHeight()]}>
        <Box modifiers={[fillMaxWidth(), height(48)]} />

        <SearchBar
          onSearch={(q) => router.push(`/search?q=${q}`)}
          modifiers={[fillMaxWidth(), paddingAll(8)]}
        >
          <SearchBar.Placeholder>
            <Text>Search Suttas...</Text>
          </SearchBar.Placeholder>
        </SearchBar>

        <LazyColumn modifiers={[fillMaxWidth()]}>
          <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
            <Text style={{ typography: "titleLarge" }}>The Three Pillars</Text>
          </Column>

          <ListItem
            modifiers={[fillMaxWidth(), clickable(() => router.push("/menu/sutta"))]}
          >
            <ListItem.LeadingContent>
              <Text style={{ fontSize: 24 }}>☸️</Text>
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text>Sutta</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>The Discourses of the Buddha</Text>
            </ListItem.SupportingContent>
          </ListItem>

          <ListItem
            modifiers={[fillMaxWidth(), clickable(() => router.push("/menu/vinaya"))]}
          >
            <ListItem.LeadingContent>
              <Text style={{ fontSize: 24 }}>📜</Text>
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text>Vinaya</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>The Monastic Rules & Code</Text>
            </ListItem.SupportingContent>
          </ListItem>

          <ListItem
            modifiers={[fillMaxWidth(), clickable(() => router.push("/menu/abhidhamma"))]}
          >
            <ListItem.LeadingContent>
              <Text style={{ fontSize: 24 }}>💎</Text>
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text>Abhidhamma</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>The Higher Philosophy</Text>
            </ListItem.SupportingContent>
          </ListItem>
        </LazyColumn>
      </Column>

      {showSyncDialog && (
        <AlertDialog
          onDismissRequest={() => dataLoaded && !isSyncing && setShowSyncDialog(false)}
          properties={{
            dismissOnBackPress: !!(dataLoaded && !isSyncing),
            dismissOnClickOutside: !!(dataLoaded && !isSyncing)
          }}
        >
          <AlertDialog.Title>
            <Text>Sutta Library Sync</Text>
          </AlertDialog.Title>
          
          <AlertDialog.Text>
            <Column modifiers={[fillMaxWidth()]}>
              <Text color={syncError ? "#D32F2F" : undefined}>
                {syncError || (isSyncing
                  ? syncProgress === null 
                    ? "Extracting Sutta data..." 
                    : "Downloading Sutta data..."
                  : "The library needs to be downloaded for offline use.")}
              </Text>
              
              {isSyncing && (
                <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
                  {syncProgress === null ? (
                    <CircularProgressIndicator modifiers={[fillMaxWidth()]} />
                  ) : (
                    <LinearProgressIndicator
                      progress={syncProgress}
                      modifiers={[fillMaxWidth()]}
                    />
                  )}
                  <Text
                    style={{ typography: "bodySmall" }}
                    modifiers={[paddingAll(8)]}
                  >
                    {syncProgress !== null 
                      ? `${Math.round(syncProgress * 100)}% Complete` 
                      : "Processing..."}
                  </Text>
                </Column>
              )}
            </Column>
          </AlertDialog.Text>
          
          <AlertDialog.ConfirmButton>
            {!isSyncing ? (
              <Button onClick={handleSync}>
                <Text>{syncError ? "Try Again" : "Download Now"}</Text>
              </Button>
            ) : (
              <Box /> // Invisible placeholder to maintain slot presence
            )}
          </AlertDialog.ConfirmButton>

          {dataLoaded && !isSyncing && (
            <AlertDialog.DismissButton>
              <Button onClick={() => setShowSyncDialog(false)}>
                <Text>Cancel</Text>
              </Button>
            </AlertDialog.DismissButton>
          )}
        </AlertDialog>
      )}
    </Host>
  );
}
