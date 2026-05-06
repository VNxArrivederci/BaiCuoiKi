// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Alert,
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, doc, setDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';

const TEAL = '#0D9488';

// ── Tạo chatId cố định từ 2 uid ────────────────────────────────
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ── Format giờ ─────────────────────────────────────────────────
function formatTime(timestamp) {
  if (!timestamp?.seconds) return '';
  return new Date(timestamp.seconds * 1000).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateHeader(timestamp) {
  if (!timestamp?.seconds) return '';
  const d = new Date(timestamp.seconds * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Bubble component ────────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  if (msg.type === 'image') {
    return (
      <View style={[styles.bubbleWrap, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
        <Image source={{ uri: msg.imageURL }} style={styles.msgImage} resizeMode="cover" />
        <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
          {formatTime(msg.createdAt)}
        </Text>
      </View>
    );
  }

  if (msg.type === 'location') {
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, { padding: 10 }]}>
        <Text style={{ fontSize: 18 }}>📍</Text>
        <Text style={[styles.bubbleText, { color: isMine ? '#fff' : '#111827', marginTop: 2 }]}>
          {msg.locationName || 'Vị trí đã chia sẻ'}
        </Text>
        <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
          {formatTime(msg.createdAt)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isMine && (
        <Text style={styles.senderName}>{msg.senderName?.split(' ').pop()}</Text>
      )}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, { color: isMine ? '#fff' : '#111827' }]}>
          {msg.text}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
        {formatTime(msg.createdAt)}
      </Text>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { otherUser } = route.params;
  const { user }      = useAuth();

  const chatId = getChatId(user.uid, otherUser.uid);

  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef(null);

  // ── Set header title ──────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({ title: otherUser.name });
  }, [otherUser.name]);

  // ── Listen to messages realtime ───────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setLoading(false);

      // Đánh dấu đã đọc
      const chatRef = doc(db, 'chats', chatId);
      updateDoc(chatRef, {
        readBy: [user.uid],
      }).catch(() => {});
    });
    return unsub;
  }, [chatId]);

  // ── Đảm bảo chat document tồn tại ────────────────────────────
  const ensureChatDoc = useCallback(async () => {
    const chatRef = doc(db, 'chats', chatId);
    const snap    = await getDoc(chatRef);
    if (!snap.exists()) {
      await setDoc(chatRef, {
        participants:     [user.uid, otherUser.uid],
        participantNames: {
          [user.uid]:      user.displayName || user.email,
          [otherUser.uid]: otherUser.name,
        },
        participantPhotos: {
          [user.uid]:      user.photoURL   || null,
          [otherUser.uid]: otherUser.photoURL || null,
        },
        createdAt:    serverTimestamp(),
        lastMessage:  '',
        lastMessageAt: serverTimestamp(),
        lastSenderId: '',
        readBy:       [user.uid, otherUser.uid],
      });
    }
  }, [chatId, user, otherUser]);

  // ── Gửi tin nhắn text ─────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    setSending(true);

    try {
      await ensureChatDoc();

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text:       trimmed,
        senderId:   user.uid,
        senderName: user.displayName || user.email,
        type:       'text',
        createdAt:  serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage:   trimmed,
        lastMessageAt: serverTimestamp(),
        lastSenderId:  user.uid,
        readBy:        [user.uid],
      });
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setSending(false);
    }
  }, [text, sending, chatId, user, ensureChatDoc]);

  // ── Gửi ảnh ───────────────────────────────────────────────────
  const sendImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Cần quyền truy cập ảnh'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      await ensureChatDoc();

      const uri      = result.assets[0].uri;
      const response = await fetch(uri);
      const blob     = await response.blob();
      const imgRef   = ref(storage, `chat_images/${chatId}/${Date.now()}.jpg`);
      await uploadBytes(imgRef, blob);
      const imageURL = await getDownloadURL(imgRef);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        imageURL,
        senderId:   user.uid,
        senderName: user.displayName || user.email,
        type:       'image',
        createdAt:  serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage:   '📷 Ảnh',
        lastMessageAt: serverTimestamp(),
        lastSenderId:  user.uid,
        readBy:        [user.uid],
      });
    } catch (err) {
      Alert.alert('Lỗi upload ảnh', err.message);
    } finally {
      setUploading(false);
    }
  }, [chatId, user, ensureChatDoc]);

  // ── Chia sẻ vị trí ───────────────────────────────────────────
  const sendLocation = useCallback(async () => {
    Alert.alert('Chia sẻ vị trí', 'Gửi vị trí hiện tại của bạn?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gửi',
        onPress: async () => {
          try {
            await ensureChatDoc();
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              senderId:     user.uid,
              senderName:   user.displayName || user.email,
              type:         'location',
              locationName: 'Vị trí của tôi',
              createdAt:    serverTimestamp(),
            });
            await updateDoc(doc(db, 'chats', chatId), {
              lastMessage:   '📍 Vị trí',
              lastMessageAt: serverTimestamp(),
              lastSenderId:  user.uid,
              readBy:        [user.uid],
            });
          } catch (err) { Alert.alert('Lỗi', err.message); }
        },
      },
    ]);
  }, [chatId, user, ensureChatDoc]);

  // ── Scroll to bottom on new message ──────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Date separator logic ──────────────────────────────────────
  const withDateHeaders = () => {
    const result = [];
    let lastDate  = null;
    for (const msg of messages) {
      const dateStr = msg.createdAt?.seconds
        ? new Date(msg.createdAt.seconds * 1000).toDateString()
        : null;
      if (dateStr && dateStr !== lastDate) {
        result.push({ id: `header_${dateStr}`, isHeader: true, timestamp: msg.createdAt });
        lastDate = dateStr;
      }
      result.push(msg);
    }
    return result;
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TEAL} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={withDateHeaders()}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 40 }}>👋</Text>
              <Text style={styles.emptyChatText}>Bắt đầu cuộc trò chuyện!</Text>
            </View>
          )}
          renderItem={({ item }) => {
            if (item.isHeader) {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
                </View>
              );
            }
            const isMine = item.senderId === user.uid;
            return <MessageBubble msg={item} isMine={isMine} />;
          }}
        />
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator color={TEAL} size="small" />
          <Text style={styles.uploadText}>Đang gửi ảnh...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        {/* Ảnh */}
        <TouchableOpacity style={styles.attachBtn} onPress={sendImage} disabled={uploading}>
          <Text style={styles.attachIcon}>📷</Text>
        </TouchableOpacity>

        {/* Vị trí */}
        <TouchableOpacity style={styles.attachBtn} onPress={sendLocation}>
          <Text style={styles.attachIcon}>📍</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FFFE' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  dateHeader: {
    alignItems: 'center', marginVertical: 12,
  },
  dateHeaderText: {
    fontSize: 11, fontWeight: '600', color: '#9CA3AF',
    backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 10,
  },

  bubbleWrap:  { marginVertical: 3, maxWidth: '78%' },
  bubbleLeft:  { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },

  senderName: { fontSize: 11, color: '#9CA3AF', marginBottom: 3, marginLeft: 4 },

  bubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: TEAL,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  bubbleTimeRight: { textAlign: 'right', marginRight: 2 },
  bubbleTimeLeft:  { marginLeft: 2 },

  msgImage: {
    width: 200, height: 160, borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },

  uploadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF9', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#D1FAE5',
  },
  uploadText: { fontSize: 13, color: TEAL, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    gap: 8,
  },
  attachBtn:  { padding: 6 },
  attachIcon: { fontSize: 22 },

  input: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#111827',
    maxHeight: 100, backgroundColor: '#F9FAFB',
  },

  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: '#A7F3D0', shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyChatText: { fontSize: 16, color: '#9CA3AF', fontWeight: '600' },
});