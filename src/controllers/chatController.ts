import { Request, Response } from 'express';
import { ChatRoom } from '../models/chatRoom';
import { Message } from '../models/Message';
import { PresetMessage } from '../models/PresetMessage';
import { Store } from '../models/Store';
import { getSocketIO } from '../socket';
import { chatService } from '../services/chatService';
import { Types } from 'mongoose';

export class ChatController {
  // Get nearby stores for chat
  public async getNearbyStores(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius = 5000 } = req.body; // radius in meters

      const stores = await Store.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: radius
          }
        },
        isActive: true
      }).select('name address location rating operatingHours');

      res.status(200).json({
        success: true,
        data: stores
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error fetching nearby stores'
      });
    }
  }

  // Create or get existing chat room
  public async createOrGetChatRoom(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, context = 'general' } = req.body;
      const userId = req.user._id;

      // Use chatService to create or get chat room
      const chatRoom = await chatService.createOrGetChatRoom(
        userId.toString(),
        storeId,
        context
      );

      res.status(200).json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      console.error('Error creating chat room:', error);
      res.status(500).json({
        success: false,
        error: 'Error creating chat room'
      });
    }
  }

  // Get chat history
  public async getChatHistory(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      // Use chatService to get chat history
      const messages = await chatService.getChatHistory(roomId, page, limit);

      res.status(200).json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching chat history'
      });
    }
  }

  // Handle prescription upload in chat
  public async handlePrescriptionUpload(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const { prescriptionId } = req.body;

      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        res.status(404).json({
          success: false,
          error: 'Chat room not found'
        });
        return;
      }

      // Update chat room context
      chatRoom.context = 'prescription';
      chatRoom.prescriptionRef = prescriptionId;
      await chatRoom.save();

      // Create system message about prescription
      const systemMessage = await chatService.createMessage({
        chatRoomId: roomId,
        senderId: req.user._id,
        senderType: 'system',
        messageType: 'prescription_clarification',
        content: 'Prescription uploaded for review',
        metadata: {
          prescriptionRef: prescriptionId
        }
      });

      // Notify store about prescription upload
      const io = getSocketIO();
      io.to(`store:${chatRoom.storeId}`).emit('prescription_uploaded', {
        roomId,
        prescriptionId,
        message: systemMessage
      });

      res.status(200).json({
        success: true,
        message: 'Prescription uploaded successfully',
        data: systemMessage
      });
    } catch (error) {
      console.error('Error handling prescription upload:', error);
      res.status(500).json({
        success: false,
        error: 'Error handling prescription upload'
      });
    }
  }

  // Get preset messages for store
  public async getPresetMessages(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const category = req.query.category as string | undefined;

      // Use chatService to get preset messages
      const presetMessages = await chatService.getPresetMessages(storeId, category);

      res.status(200).json({
        success: true,
        data: presetMessages
      });
    } catch (error) {
      console.error('Error fetching preset messages:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching preset messages'
      });
    }
  }

  // Send preset message (for store owners)
  public async sendPresetMessage(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const { presetMessageId } = req.body;
      
      // Verify if store has access to this room
      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        res.status(404).json({
          success: false,
          error: 'Chat room not found'
        });
        return;
      }

      if (chatRoom.storeId.toString() !== req.user._id.toString()) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      // Get preset message
      const presetMessage = await PresetMessage.findById(presetMessageId)
        .populate('products', 'name price');
      
      if (!presetMessage) {
        res.status(404).json({
          success: false,
          error: 'Preset message not found'
        });
        return;
      }

      // Create message
      const message = await chatService.createMessage({
        chatRoomId: roomId,
        senderId: req.user._id,
        senderType: 'store',
        messageType: 'preset_otc',
        content: presetMessage.message,
        isPreset: true,
        metadata: {
          
          product: presetMessage.products && presetMessage.products.length > 0 
            ? (typeof presetMessage.products[0] === 'string' 
                ? presetMessage.products[0] 
                : presetMessage.products[0].toString())
            : undefined

        }
      });

      // Emit to socket
      const io = getSocketIO();
      io.to(roomId).emit('new_message', message);

      res.status(200).json({
        success: true,
        data: message
      });
    } catch (error) {
      console.error('Error sending preset message:', error);
      res.status(500).json({
        success: false,
        error: 'Error sending preset message'
      });
    }
  }

  // Mark messages as read
  public async markMessagesAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const userType = req.user.userType === 'store' ? 'store' : 'user';

      await chatService.markMessagesAsRead(roomId, userType);

      res.status(200).json({
        success: true,
        message: 'Messages marked as read'
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        error: 'Error marking messages as read'
      });
    }
  }

  // Get active chat rooms for the current user or store
  public async getActiveChatRooms(req: Request, res: Response): Promise<void> {
    try {
      // For store users, we need to look for their storeId
      // For regular users, we use their userId
      const userId = req.user._id;
      const userType = req.user.userType === 'store' ? 'store' : 'user';
      
      console.log(`User type: ${userType}, ID: ${userId}`);
      
      // Check if store user
      let storeId = null;
      if (userType === 'store') {
        // The store ID might be in req.user.storeId
        if (req.user.storeId) {
          storeId = req.user.storeId;
        } else {
          // Find store by user ID
          const store = await Store.findOne({ 
            $or: [
              { _id: userId },
              { userId: userId }
            ]
          });
          
          if (store) {
            storeId = store._id;
          } else {
            storeId = userId; // Fallback to user ID if store not found
          }
        }
        
        console.log(`Using store ID: ${storeId} for query`);
        const chatRooms = await chatService.getActiveChatRooms(storeId.toString(), userType);

        res.status(200).json({
          success: true,
          data: chatRooms
        });
      } else {
        // Regular user
        const chatRooms = await chatService.getActiveChatRooms(userId.toString(), userType);
        
        res.status(200).json({
          success: true,
          data: chatRooms
        });
      }
    } catch (error) {
      console.error('Error fetching active chat rooms:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching active chat rooms'
      });
    }
  }
}