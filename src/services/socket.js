import { io } from 'socket.io-client';

// Initialize socket connection
// Use environment variable for URL or default to localhost
const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
    autoConnect: false
});

export const joinSession = (customerId) => {
    if (!socket.connected) socket.connect();
    socket.emit('join_room', customerId);
};

export const sendEmojiSocket = (customerId, emoji) => {
    if (!socket.connected) socket.connect();
    socket.emit('send_emoji', { customerId, emoji });
};
