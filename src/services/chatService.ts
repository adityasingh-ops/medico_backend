import { ChatRoom } from '../models/chatRoom';
import { Message } from '../models/Message';
import { PresetMessage } from '../models/PresetMessage';
import { Types } from 'mongoose';

export class ChatService {
  // Create or get chat room
  async createOrGetChatRoom(userId: string, storeId: string, context: string = 'general') {
    try {
      let chatRoom = await ChatRoom.findOne({
        userId,
        storeId,
        isActive: true
      });

      if (!chatRoom) {
        const allowedMessageTypes = {
          store: ['text', 'product_suggestion'],
          user: ['text']
        };

        if (context === 'otc_recommendation') {
          allowedMessageTypes.store.push('preset_otc');
        }

        chatRoom = await ChatRoom.create({
          userId: new Types.ObjectId(userId),
          storeId: new Types.ObjectId(storeId),
          context,
          allowedMessageTypes,
          lastMessage: new Date()
        });

        // Send welcome preset message if exists
        const welcomeMessage = await PresetMessage.findOne({
          storeId,
          category: 'greeting',
          isActive: true
        });

        if (welcomeMessage) {
          await this.createMessage({
            chatRoomId: chatRoom._id.toString(),
            senderId: storeId,
            senderType: 'store',
            messageType: 'preset_otc',
            content: welcomeMessage.message,
            isPreset: true
          });
        }
      }

      return chatRoom;
    } catch (error) {
      throw new Error(`Error creating chat room: ${error}`);
    }
  }

  // Create message
  async createMessage(messageData: {
    chatRoomId: string;
    senderId: string;
    senderType: 'user' | 'store' | 'system';
    messageType: string;
    content: string;
    metadata?: any;
    isPreset?: boolean;
  }) {
    try {
      const message = await Message.create({
        ...messageData,
        chatRoomId: new Types.ObjectId(messageData.chatRoomId),
        senderId: new Types.ObjectId(messageData.senderId)
      });

      // Update chat room's last message timestamp
      await ChatRoom.findByIdAndUpdate(
        messageData.chatRoomId,
        { 
          lastMessage: new Date(),
          updatedAt: new Date()
        }
      );

      return message;
    } catch (error) {
      throw new Error(`Error creating message: ${error}`);
    }
  }

  // Get chat history
  async getChatHistory(roomId: string, page: number = 1, limit: number = 50) {
    try {
      const messages = await Message.find({ chatRoomId: roomId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('metadata.product', 'name price')
        .populate('metadata.prescriptionRef', 'image')
        .sort({ createdAt: 1 });

      return messages;
    } catch (error) {
      throw new Error(`Error fetching chat history: ${error}`);
    }
  }

  // Mark messages as read
  async markMessagesAsRead(roomId: string, senderType: 'user' | 'store') {
    try {
      await Message.updateMany(
        { 
          chatRoomId: roomId,
          senderType: senderType === 'user' ? 'store' : 'user',
          read: false
        },
        { read: true }
      );
    } catch (error) {
      throw new Error(`Error marking messages as read: ${error}`);
    }
  }

  // Handle product action
  async handleProductAction(
    roomId: string,
    userId: string,
    userType: string,
    productId: string,
    action: 'add_to_cart' | 'remove_from_cart',
    quantity: number = 1
  ) {
    try {
      const message = await this.createMessage({
        chatRoomId: roomId,
        senderId: userId,
        senderType: userType as 'user' | 'store',
        messageType: 'cart_action',
        content: `Product ${action === 'add_to_cart' ? 'added to' : 'removed from'} cart`,
        metadata: {
          product: new Types.ObjectId(productId),
          cartAction: action,
          quantity
        }
      });

      return message;
    } catch (error) {
      throw new Error(`Error handling product action: ${error}`);
    }
  }

  // Get preset messages
  async getPresetMessages(storeId: string, category?: string) {
    try {
      const query: any = {
        storeId: new Types.ObjectId(storeId),
        isActive: true
      };

      if (category) {
        query.category = category;
      }

      const presetMessages = await PresetMessage.find(query)
        .populate('products', 'name price');

      return presetMessages;
    } catch (error) {
      throw new Error(`Error fetching preset messages: ${error}`);
    }
  }

  // Get active chat rooms for a user or store
  async getActiveChatRooms(id: string, userType: 'user' | 'store') {
    try {
      console.log('Getting chat rooms for:', {
        id,
        userType
      });
      
      // Build the correct query
      let query: any = { isActive: true };
      
      if (userType === 'user') {
        query.userId = new Types.ObjectId(id);
      } else {
        query.storeId = new Types.ObjectId(id);
      }
      
      console.log('Query:', JSON.stringify(query));
      
      const chatRooms = await ChatRoom.find(query)
        .populate(userType === 'user' ? 'storeId' : 'userId', 'name')
        .sort({ lastMessage: -1 });
      
      console.log(`Found ${chatRooms.length} chat rooms`);
      
      // Debug: Print out all chatrooms in the database to see what exists
      const allRooms = await ChatRoom.find({});
      console.log(`Total rooms in database: ${allRooms.length}`);
      if (userType === 'store') {
        console.log('Store ID being used for query:', id);
        console.log('All store IDs in database:', allRooms.map(room => room.storeId.toString()));
      }
      
      return chatRooms;
    } catch (error) {
      throw new Error(`Error fetching active chat rooms: ${error}`);
    }
  }
}  

export const chatService = new ChatService();