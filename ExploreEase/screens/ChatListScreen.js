// screens/ChatListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL = '#0D9488';

function timeAgo(timestamp) {
  if (!timestamp?.seconds) return '';
  const diff = Date.now() - timestamp.seconds * 1000;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút`;
  if (h < 24) return `${h} giờ`;
  return `${d} ngày`;
}

function Avatar({ name, photoURL, size = 48 }) {
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>
        {(name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(data);
      setLoading(false);
    }, (err) => {
      console.error('ChatList:', err);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const getOtherUser = (chat) => {
    const otherId = chat.participants.find(id => id !== user.uid);
    return {
      uid:      otherId,
      name:     chat.participantNames?.[otherId] || 'Người dùng',
      photoURL: chat.participantPhotos?.[otherId] || null,
    };
  };

  const hasUnread = (chat) => {
    if (!chat.lastSenderId || chat.lastSenderId === user.uid) return false;
    return !chat.readBy?.includes(user.uid);
  };

  const renderItem = ({ item }) => {
    const other  = getOtherUser(item);
    const unread = hasUnread(item);
    return (
      <TouchableOpacity
        style={[styles.chatItem, unread && styles.chatItemUnread]}
        onPress={() => navigation.navigate('Chat', { chat: item, otherUser: other })}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrap}>
          <Avatar name={other.name} photoURL={other.photoURL} />
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.chatName, unread && styles.chatNameUnread]} numberOfLines={1}>
              {other.name}
            </Text>
            <Text style={styles.chatTime}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <Text
            style={[styles.chatLastMsg, unread && styles.chatLastMsgUnread]}
            numberOfLines={1}
          >
            {item.lastSenderId === user.uid ? 'Bạn: ' : ''}{item.lastMessage || 'Bắt đầu cuộc trò chuyện'}
          </Text>
        </View>

        {unread && <View style={styles.unreadBadge} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>💬</Text>
          <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
          <Text style={styles.emptyHint}>
            Vào trang chi tiết địa điểm / sự kiện{'\n'}để nhắn tin với người đăng
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={TEAL}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },

  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
  },
  chatItemUnread: { backgroundColor: '#F0FDFA' },

  avatarWrap: { position: 'relative', marginRight: 14 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff',
  },

  chatInfo:    { flex: 1 },
  chatTopRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName:    { fontSize: 15, fontWeight: '600', color: '#374151', flex: 1, marginRight: 8 },
  chatNameUnread: { fontWeight: '800', color: '#111827' },
  chatTime:    { fontSize: 11, color: '#9CA3AF' },
  chatLastMsg: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  chatLastMsgUnread: { color: '#374151', fontWeight: '600' },

  unreadBadge: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: TEAL, marginLeft: 8,
  },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 78 },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle:{ fontSize: 18, fontWeight: '800', color: '#374151', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
});