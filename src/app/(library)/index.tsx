import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Host, Text, Column } from '@expo/ui';
import { syncData, checkForUpdates } from '@/services/SyncService';
import { searchSuttas } from '@/services/DataService';

export default function Index() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needsSync, setNeedsSync] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string, file_path: string }[]>([]);

  useEffect(() => {
    checkAppStatus();
  }, []);

  const checkAppStatus = async () => {
    const updateAvailable = await checkForUpdates();
    if (updateAvailable) {
      setNeedsSync(true);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const results = await searchSuttas(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setProgress(0);
    try {
      const success = await syncData((p) => setProgress(p));
      if (success) {
        setNeedsSync(false);
        Alert.alert("Success", "Tipitaka data is ready!");
      } else {
        Alert.alert("Error", "Failed to sync data.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  if (syncing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ marginTop: 20 }}>Syncing Tipitaka: {Math.round(progress * 100)}%</Text>
      </View>
    );
  }

  return (
    <Host>
      <Column flex={1} style={styles.container}>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Suttas (e.g., 'dn1' or 'metta')"
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
        </View>

        {/* Search Results Overlay */}
        {searchQuery.length > 0 && (
          <View style={styles.resultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.resultItem}
                  onPress={() => {
                    setSearchQuery('');
                    router.push(`/reader/${item.uid}`);
                  }}
                >
                  <Text variant="bodyLarge" style={styles.resultUid}>{item.uid}</Text>
                  <Text variant="bodySmall" style={styles.resultPath} numberOfLines={1}>{item.file_path}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyResults}>No suttas found matching "{searchQuery}"</Text>
              }
            />
          </View>
        )}

        {/* Main Content */}
        {needsSync ? (
          <Column gap={20} alignItems="center" style={styles.syncCard}>
            <Text style={{ fontSize: 40 }}>📥</Text>
            <Text variant="titleMedium">New Data Available</Text>
            <Text variant="bodySmall" style={{ textAlign: 'center', color: '#666' }}>
              The SuttaCentral library has been updated. Download the latest version for offline use.
            </Text>
            <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
              <Text style={styles.buttonText}>Sync Library</Text>
            </TouchableOpacity>
          </Column>
        ) : (
          <Column gap={20} padding={20}>
            <Text variant="titleMedium" style={styles.sectionTitle}>The Three Pillars</Text>
            
            <MenuCard 
              title="Sutta" 
              subtitle="The Discourses of the Buddha" 
              icon="☸️" 
              color="#E8F5E9"
              iconColor="#2E7D32"
              onPress={() => router.push('/menu/sutta')}
            />
            
            <MenuCard 
              title="Vinaya" 
              subtitle="The Monastic Rules & Code" 
              icon="📜" 
              color="#FFF3E0"
              iconColor="#EF6C00"
              onPress={() => router.push('/menu/vinaya')}
            />
            
            <MenuCard 
              title="Abhidhamma" 
              subtitle="The Higher Philosophy" 
              icon="💎" 
              color="#E3F2FD"
              iconColor="#1565C0"
              onPress={() => router.push('/menu/abhidhamma')}
            />
          </Column>
        )}

        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.versionText}>v1.2.0 • Offline Ready</Text>
        </View>
      </Column>
    </Host>
  );
}

function MenuCard({ title, subtitle, icon, color, iconColor, onPress }: any) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.cardIcon, { backgroundColor: color }]}>
        <Text style={{ fontSize: 32, color: iconColor }}>{icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text variant="titleMedium" style={styles.cardTitle}>{title}</Text>
        <Text variant="bodySmall" style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: 25,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#F2F2F7',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: '#000',
  },
  resultsContainer: {
    position: 'absolute',
    top: 220,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: 400,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultUid: {
    fontWeight: '700',
    color: '#6200ee',
  },
  resultPath: {
    color: '#888',
    marginTop: 2,
  },
  emptyResults: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 5,
    color: '#333',
  },
  syncCard: {
    margin: 20,
    backgroundColor: '#f8f9ff',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  syncButton: {
    marginTop: 20,
    backgroundColor: '#6200ee',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#777',
    marginTop: 2,
  },
  chevron: {
    fontSize: 28,
    color: '#E0E0E0',
    fontWeight: '300',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 30,
  },
  versionText: {
    color: '#bbb',
    letterSpacing: 1,
  }
});
