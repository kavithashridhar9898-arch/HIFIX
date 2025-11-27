import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context?.socket;
};

// Derive base socket origin from API_BASE_URL (strip /api suffix if present)
let SOCKET_URL = API_BASE_URL.replace(/\/api$/, '');

// Fallback heuristics if API_BASE_URL wasn't set
if (!SOCKET_URL || SOCKET_URL.length === 0) {
  SOCKET_URL = Platform.OS === 'web' ? 'http://localhost:5000' : 'http://10.134.174.251:5000';
}

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (user) {
      // Create socket connection
      const newSocket = io(SOCKET_URL, {
        // Allow fallback to polling if websocket blocked by network/firewall
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1200,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        console.log('✅ Socket connected');
        setConnected(true);
        // Join user's personal room
        newSocket.emit('join', user.id.toString());
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        // Log concise warning instead of giant stack for UX clarity
        console.warn('[socket] connect_error:', error?.message || error);
      });

      newSocket.on('error', (error) => {
        console.warn('[socket] error event:', error?.message || error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  const value = {
    socket,
    connected,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
