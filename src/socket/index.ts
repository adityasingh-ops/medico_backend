import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { chatService } from '../services/chatService';
import { ChatRoom } from '../models/chatRoom';
import { socketConnections } from '../observability/metrics';

interface CustomSocket extends Socket {
  data: {
    userId: string;
    userType: 'user' | 'store';
  };
}

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use(async (socket: CustomSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; type: string };
      socket.data = {
        userId: decoded.id,
        userType: decoded.type as 'user' | 'store'
      };
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Handle connection
  io.on('connection', (socket: CustomSocket) => {
    console.log(`User connected: ${socket.data.userId}`);
    socketConnections.inc();

    // If user is a store, join a store-specific room
    if (socket.data.userType === 'store') {
      socket.join(`store:${socket.data.userId}`);
      console.log(`Store ${socket.data.userId} joined store-specific room`);
    }

    // Join chat room
    socket.on('join_room', async (roomId: string) => {
      try {
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
          socket.emit('error', { message: 'Chat room not found' });
          return;
        }

        // Verify user has access to this room
        const canAccess = 
          chatRoom.userId.toString() === socket.data.userId || 
          (socket.data.userType === 'store' && chatRoom.storeId.toString() === socket.data.userId);

        if (!canAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(roomId);
        console.log(`User ${socket.data.userId} joined room ${roomId}`);

        // Mark messages as read
        await chatService.markMessagesAsRead(roomId, socket.data.userType);

        socket.emit('room_joined', { roomId });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Error joining room' });
      }
    });

    // Define message interface
    interface MessageData {
      roomId: string;
      content: string;
      messageType?: string;
      metadata?: {
        product?: string;
        dosage?: string;
        quantity?: number;
        prescriptionRef?: string;
        cartAction?: 'add_to_cart' | 'remove_from_cart';
        priceSnapshot?: number;
      };
    }

    // Handle new message
    socket.on('send_message', async (data: MessageData) => {
      try {
        const { roomId, content, messageType = 'text', metadata = {} } = data;

        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
          socket.emit('error', { message: 'Chat room not found' });
          return;
        }

        // Verify user has access to this room
        const canAccess = 
          chatRoom.userId.toString() === socket.data.userId || 
          (socket.data.userType === 'store' && chatRoom.storeId.toString() === socket.data.userId);

        if (!canAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Verify message type is allowed
        const allowedTypes = socket.data.userType === 'user' 
          ? chatRoom.allowedMessageTypes.user 
          : chatRoom.allowedMessageTypes.store;

        if (!allowedTypes.includes(messageType)) {
          socket.emit('error', { message: 'Message type not allowed' });
          return;
        }

        const message = await chatService.createMessage({
          chatRoomId: roomId,
          senderId: socket.data.userId,
          senderType: socket.data.userType,
          messageType,
          content,
          metadata
        });

        io.to(roomId).emit('new_message', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Define product action interface
    interface ProductActionData {
      roomId: string;
      productId: string;
      action: 'add_to_cart' | 'remove_from_cart';
      quantity?: number;
    }

    // Handle product action
    socket.on('product_action', async (data: ProductActionData) => {
      try {
        const { roomId, productId, action, quantity = 1 } = data;
        
        // Verify user has access to this room
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
          socket.emit('error', { message: 'Chat room not found' });
          return;
        }

        const canAccess = 
          chatRoom.userId.toString() === socket.data.userId || 
          (socket.data.userType === 'store' && chatRoom.storeId.toString() === socket.data.userId);

        if (!canAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        
        const message = await chatService.handleProductAction(
          roomId,
          socket.data.userId,
          socket.data.userType,
          productId,
          action,
          quantity
        );

        io.to(roomId).emit('product_action_completed', {
          message,
          action,
          quantity
        });
      } catch (error) {
        console.error('Error processing product action:', error);
        socket.emit('error', { message: 'Error processing product action' });
      }
    });

    // Handle typing status
    socket.on('typing_status', (data: { roomId: string; isTyping: boolean }) => {
      const { roomId, isTyping } = data;
      socket.to(roomId).emit('user_typing', {
        userId: socket.data.userId,
        userType: socket.data.userType,
        isTyping
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.userId}`);
      socketConnections.dec();
    });
  });
};

export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};