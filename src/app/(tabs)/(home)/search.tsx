import React, { useState, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { 
  Host, 
  Column, 
  Text, 
  SearchBar, 
  ListItem, 
  LazyColumn
} from "@expo/ui/jetpack-compose";
import { 
  fillMaxWidth, 
  paddingAll, 
  fillMaxHeight,
  clickable
} from "@expo/ui/jetpack-compose/modifiers";
import { searchSuttas } from '@/services/DataService';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setLoading(true);
        try {
          const searchResults = await searchSuttas(query);
          setResults(searchResults);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Search" }} />
      
      <Column modifiers={[fillMaxWidth(), fillMaxHeight()]}>
        <SearchBar
          onSearch={setQuery}
          modifiers={[fillMaxWidth()]}
        >
          <SearchBar.Placeholder>
            <Text>Search by title, UID, or content...</Text>
          </SearchBar.Placeholder>
        </SearchBar>

        <LazyColumn modifiers={[fillMaxWidth(), fillMaxHeight()]}>
          {results.map((item) => (
            <ListItem
              key={item.uid}
              modifiers={[fillMaxWidth(), clickable(() => router.push(`/reader/${item.uid}` ))]}
            >
              <ListItem.LeadingContent>
                <Text style={{ fontSize: 20 }}>📄</Text>
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Text>{item.title}</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>{`${item.uid.toUpperCase()} • ${item.file_path}`}</Text>
              </ListItem.SupportingContent>
            </ListItem>
          ))}
        </LazyColumn>

        {results.length === 0 && query.length > 1 && !loading && (
          <Column modifiers={[fillMaxWidth(), paddingAll(32)]}>
            <Text style={{ textAlign: "center" }}>
              No results found for "{query}"
            </Text>
          </Column>
        )}
      </Column>
    </Host>
  );
}
