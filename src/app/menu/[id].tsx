import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { 
  Host, 
  Column, 
  Text, 
  ListItem, 
  LazyColumn,
  OutlinedCard,
  Box
} from "@expo/ui/jetpack-compose";
import { 
  fillMaxWidth, 
  paddingAll, 
  fillMaxHeight,
  clickable,
  height
} from "@expo/ui/jetpack-compose/modifiers";
import { getMenu } from "@/services/DataService";

export default function MenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const data = await getMenu(id);
      if (data) {
        setItems(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: id.toUpperCase() }} />
      
      <LazyColumn modifiers={[fillMaxWidth(), fillMaxHeight()]}>
        {items.map((item, index) => {
          const isLeaf = item.type === 'sutta' || (item.uid && !item.has_children);
          
          if (!isLeaf) {
            // Collection Node: Standard Navigation Item
            return (
              <ListItem
                key={item.uid || index}
                modifiers={[
                  fillMaxWidth(), 
                  clickable(() => router.push(`/menu/${item.uid}`))
                ]}
              >
                <ListItem.LeadingContent>
                  <Text style={{ fontSize: 20 }}>📁</Text>
                </ListItem.LeadingContent>
                <ListItem.HeadlineContent>
                  <Text>{item.title || item.uid}</Text>
                </ListItem.HeadlineContent>
                <ListItem.SupportingContent>
                  <Text>{item.subtitle || "Collection"}</Text>
                </ListItem.SupportingContent>
                <ListItem.TrailingContent>
                  <Text style={{ fontSize: 16 }}>›</Text>
                </ListItem.TrailingContent>
              </ListItem>
            );
          }

          // Leaf Node: Detailed Suttaplex-style Card
          return (
            <Column key={item.uid || index} modifiers={[fillMaxWidth(), paddingAll(8)]}>
              <OutlinedCard
                modifiers={[
                  fillMaxWidth(),
                  clickable(() => router.push(`/reader/${item.uid}`))
                ]}
              >
                <Column modifiers={[fillMaxWidth(), paddingAll(16)]}>
                  <Text style={{ typography: "titleMedium" }}>
                    {item.title || item.uid}
                  </Text>
                  
                  <Box modifiers={[fillMaxWidth(), height(4)]} />
                  
                  <Text style={{ typography: "bodySmall" }} color="#666">
                    {item.uid.toUpperCase()}
                  </Text>

                  <Box modifiers={[fillMaxWidth(), height(12)]} />
                  
                  <Column modifiers={[fillMaxWidth()]}>
                    <Text style={{ typography: "labelLarge" }}>
                      Author: {item.author || "Bhikkhu Sujato"}
                    </Text>
                    <Text style={{ typography: "labelMedium" }} color="#888">
                      Translation: {item.translation || "The Collected Discourses"}
                    </Text>
                    <Text style={{ typography: "labelSmall" }} color="#AAA">
                      Language: {item.language || "English"}
                    </Text>
                  </Column>

                  {item.description && (
                    <>
                      <Box modifiers={[fillMaxWidth(), height(8)]} />
                      <Text style={{ typography: "bodyMedium" }}>
                        {item.description}
                      </Text>
                    </>
                  )}
                </Column>
              </OutlinedCard>
            </Column>
          );
        })}
      </LazyColumn>

      {items.length === 0 && !loading && (
        <Column modifiers={[fillMaxWidth(), paddingAll(32)]}>
          <Text style={{ textAlign: "center" }}>
            No items found in this section.
          </Text>
        </Column>
      )}
    </Host>
  );
}
