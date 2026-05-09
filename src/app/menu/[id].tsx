import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Host, Text, Column } from '@expo/ui';
import { getMenu } from '@/services/DataService';

interface MenuItem {
  uid: string;
  name: string;
  has_children: boolean;
  type: 'menu' | 'sutta';
}

export default function MenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    const data = await getMenu(id);
    if (data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handlePress = (item: MenuItem) => {
    if (item.type === 'menu') {
      router.push(`/menu/${item.uid}`);
    } else {
      router.push(`/reader/${item.uid}`);
    }
  };

  return (
    <Host>
      <Stack.Screen options={{ title: id.toUpperCase() }} />
      <Column flex={1} style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#6200ee" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.item} 
                onPress={() => handlePress(item)}
              >
                <View style={styles.itemTextContent}>
                  <Text variant="bodyLarge">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.uid}>{item.uid}</Text>
                </View>
                {item.type === 'menu' && (
                  <Text style={styles.chevron}>›</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No content found in this section.</Text>
            }
          />
        )}
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  list: {
    padding: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemTextContent: {
    flex: 1,
  },
  uid: {
    color: '#999',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 10,
  },
  empty: {
    textAlign: 'center',
    marginTop: 100,
    color: '#999',
  }
});
