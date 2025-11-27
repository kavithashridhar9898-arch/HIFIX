import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, API_BASE_URL } from '../config/api';
import { useSocket } from '../context/SocketContext';

const { width } = Dimensions.get('window');

export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherUserId, otherUserName, otherUserAvatar, otherUserPhone } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const socket = useSocket();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bgAnim = useRef(new Animated.Value(0)).current;
  
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    // Socket listeners
    if (socket) {
      // Join conversation room for richer realtime events
      socket.emit('conversation:join', conversationId);
      socket.on('new_message', handleNewMessage);
      socket.on('typing_status', handleTypingStatus);
    }

    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage);
        socket.off('typing_status', handleTypingStatus);
      }
    };
  }, [socket]);

  // Subtle animated gradient background
  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, useNativeDriver: false }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/chat/messages/${conversationId}`);
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await api.put(`/chat/mark-read/${conversationId}`);
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  const handleNewMessage = (data) => {
    if (data.conversationId === conversationId) {
      setMessages(prev => [...prev, data.message]);
      markAsRead();
    }
  };

  const handleTypingStatus = (data) => {
    if (data.conversationId === conversationId && data.userId !== user.id) {
      setIsTyping(data.isTyping);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    console.log('Sending message:', messageText);
    setSending(true);

    try {
      const response = await api.post('/chat/message', {
        conversationId,
        content: messageText,
        messageType: 'text'
      });

      if (response.data.success) {
        setMessages(prev => [...prev, response.data.message]);
        setInputText('');
        updateTypingStatus(false);
      }
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const updateTypingStatus = async (typing) => {
    try {
      await api.post('/chat/typing', {
        conversationId,
        isTyping: typing
      });
    } catch (error) {
      console.error('Typing status error:', error);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing status
    updateTypingStatus(true);

    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadMedia(result.assets[0]);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (result.type === 'success') {
        uploadMedia(result);
      }
    } catch (error) {
      console.error('Pick document error:', error);
    }
  };

  const uploadMedia = async (file) => {
    try {
      console.log('📤 Uploading media:', {
        uri: file.uri,
        type: file.mimeType || file.type,
        name: file.fileName || file.name
      });

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || file.type || 'application/octet-stream',
        name: file.fileName || file.name || `file_${Date.now()}`
      });
      formData.append('conversationId', conversationId);

      const response = await api.post('/chat/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Upload response:', response.data);

      if (response.data.success) {
        console.log('✅ Media uploaded, adding to messages:', response.data.message);
        setMessages(prev => [...prev, response.data.message]);
      }
    } catch (error) {
      console.error('❌ Upload error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload file');
    }
  };

  const makePhoneCall = () => {
    const phone = otherUserPhone?.replace(/[^0-9+]/g, '');
    Alert.alert(
      'Call ' + otherUserName,
      'Choose call type',
      [
        {
          text: 'Voice Call',
          onPress: () => Linking.openURL(`tel:${phone || ''}`)
        },
        {
          text: 'Video Call',
          onPress: () => Alert.alert('Video Call', 'Video calling feature coming soon!')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id;
    const showMedia = item.message_type !== 'text' && item.media_url;

    // Debug logging
    if (showMedia) {
      console.log('📸 Rendering media message:', {
        id: item.id,
        type: item.message_type,
        media_url: item.media_url,
        full_url: getImageUrl(item.media_url)
      });
    }

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {!isMyMessage && (
          <Image
            source={{ uri: getImageUrl(otherUserAvatar) || 'https://via.placeholder.com/40' }}
            style={styles.messageAvatar}
          />
        )}

        <View style={[
          styles.messageBubble,
          isMyMessage 
            ? { backgroundColor: colors.primary } 
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }
        ]}>
          {showMedia && (
            <View style={styles.mediaContainer}>
              {item.message_type === 'image' && (
                <Image
                  source={{ uri: getImageUrl(item.media_url) }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                  onError={(e) => console.error('❌ Image load error:', e.nativeEvent.error)}
                  onLoad={() => console.log('✅ Image loaded:', item.media_url)}
                />
              )}
              {item.message_type === 'video' && (
                <View style={styles.videoPlaceholder}>
                  <Icon name="play-circle-outline" size={50} color={isMyMessage ? '#fff' : colors.primary} />
                  <Text style={{ color: isMyMessage ? '#fff' : colors.text, marginTop: 8 }}>
                    Video
                  </Text>
                </View>
              )}
              {(item.message_type === 'audio' || item.message_type === 'document') && (
                <View style={styles.documentContainer}>
                  <Icon 
                    name={item.message_type === 'audio' ? 'audiotrack' : 'description'} 
                    size={32} 
                    color={isMyMessage ? '#fff' : colors.primary} 
                  />
                  <Text style={[
                    styles.fileName,
                    { color: isMyMessage ? '#fff' : colors.text }
                  ]} numberOfLines={1}>
                    {item.file_name || item.content}
                  </Text>
                </View>
              )}
            </View>
          )}

          {item.content && item.message_type === 'text' && (
            <Text style={[
              styles.messageText,
              { color: isMyMessage ? '#fff' : colors.text }
            ]}>
              {item.content}
            </Text>
          )}

          <Text style={[
            styles.messageTime,
            { color: isMyMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary }
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isMyMessage && (
          <Icon 
            name={item.is_read ? 'done-all' : 'done'} 
            size={16} 
            color={item.is_read ? colors.primary : colors.textSecondary}
            style={styles.readReceipt}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Animated aesthetic background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={{
            position: 'absolute',
            width: width * 1.2,
            height: width * 1.2,
            borderRadius: width * 0.6,
            top: -width * 0.6,
            left: -width * 0.3,
            transform: [{
              translateX: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 40] })
            },{
              translateY: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] })
            }],
            opacity: 0.15,
          }}
        >
          <LinearGradient
            colors={[`${colors.primary}`, '#8A2BE2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: width * 0.6 }}
          />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            width: width,
            height: width,
            borderRadius: width * 0.5,
            bottom: -width * 0.5,
            right: -width * 0.2,
            transform: [{
              translateX: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] })
            },{
              translateY: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] })
            }],
            opacity: 0.12,
          }}
        >
          <LinearGradient
            colors={['#FF6FD8', `${colors.primary}`]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1, borderRadius: width * 0.5 }}
          />
        </Animated.View>
      </View>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerUser}>
          {otherUserAvatar ? (
            <Image source={{ uri: getImageUrl(otherUserAvatar) }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: `${colors.primary}20` }]}>
              <Icon name="person" size={20} color={colors.primary} />
            </View>
          )}
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{otherUserName}</Text>
            {isTyping && (
              <Text style={[styles.typingIndicator, { color: colors.primary }]}>typing...</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={makePhoneCall} style={styles.callButton}>
          <Icon name="call" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onLayout={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
            <Icon name="image" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={pickDocument} style={styles.attachButton}>
            <Icon name="attach-file" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  typingIndicator: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  callButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: width * 0.7,
    borderRadius: 16,
    padding: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  readReceipt: {
    marginLeft: 4,
    marginBottom: 2,
  },
  mediaContainer: {
    marginBottom: 8,
  },
  mediaImage: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: width * 0.6,
    height: width * 0.4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  fileName: {
    marginLeft: 12,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
