import { Request, Response } from 'express';
import { Medicine } from '../models/Product';
import { Message } from '../models/Message';
import { PresetMessage } from '../models/PresetMessage';
import { getSocketIO } from '../socket';
import { chatService } from '../services/chatService';

export class StoreMessageController {
  // Send product suggestion
  public async sendProductSuggestion(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const { productId, message, dosage } = req.body;

      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      const product = await Medicine.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found'
        });
        return;
      }

      const suggestionMessage = await chatService.createMessage({
        chatRoomId: roomId,
        senderId: req.user._id,
        senderType: 'store',
        messageType: 'product_suggestion',
        content: message || `Would you like to try ${product.name}?`,
        metadata: {
          product: productId,
          dosage,
          priceSnapshot: product.price
        }
      });

      // Emit message to room
      const io = getSocketIO();
      io.to(roomId).emit('new_message', suggestionMessage);

      res.status(200).json({
        success: true,
        data: suggestionMessage
      });
    } catch (error) {
      console.error('Error sending product suggestion:', error);
      res.status(500).json({
        success: false,
        error: 'Error sending product suggestion'
      });
    }
  }

  // Handle prescription clarification
  public async handlePrescriptionClarification(req: Request, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const { message, products } = req.body;

      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      const clarificationMessage = await chatService.createMessage({
        chatRoomId: roomId,
        senderId: req.user._id,
        senderType: 'store',
        messageType: 'prescription_clarification',
        content: message,
        metadata: {
          products: products // Array of product IDs from prescription
        }
      });

      // Emit message to room
      const io = getSocketIO();
      io.to(roomId).emit('new_message', clarificationMessage);

      res.status(200).json({
        success: true,
        data: clarificationMessage
      });
    } catch (error) {
      console.error('Error handling prescription clarification:', error);
      res.status(500).json({
        success: false,
        error: 'Error handling prescription clarification'
      });
    }
  }

  // Create preset message
  public async createPresetMessage(req: Request, res: Response): Promise<void> {
    try {
      const { category, message, products, triggerKeywords } = req.body;
      
      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      const presetMessage = await PresetMessage.create({
        storeId: req.user._id,
        category,
        message,
        products: products || [],
        triggerKeywords: triggerKeywords || [],
        isActive: true
      });

      res.status(201).json({
        success: true,
        data: presetMessage
      });
    } catch (error) {
      console.error('Error creating preset message:', error);
      res.status(500).json({
        success: false,
        error: 'Error creating preset message'
      });
    }
  }

  // Update preset message
  public async updatePresetMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { category, message, products, triggerKeywords, isActive } = req.body;
      
      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      // Find preset message and verify ownership
      const existingPresetMessage = await PresetMessage.findById(id);
      if (!existingPresetMessage) {
        res.status(404).json({
          success: false,
          error: 'Preset message not found'
        });
        return;
      }

      if (existingPresetMessage.storeId.toString() !== req.user._id.toString()) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      // Update preset message
      const updatedMessage = await PresetMessage.findByIdAndUpdate(
        id,
        {
          category: category || existingPresetMessage.category,
          message: message || existingPresetMessage.message,
          products: products || existingPresetMessage.products,
          triggerKeywords: triggerKeywords || existingPresetMessage.triggerKeywords,
          isActive: isActive !== undefined ? isActive : existingPresetMessage.isActive
        },
        { new: true }
      );

      res.status(200).json({
        success: true,
        data: updatedMessage
      });
    } catch (error) {
      console.error('Error updating preset message:', error);
      res.status(500).json({
        success: false,
        error: 'Error updating preset message'
      });
    }
  }

  // Delete preset message
  public async deletePresetMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      // Find preset message and verify ownership
      const existingPresetMessage = await PresetMessage.findById(id);
      if (!existingPresetMessage) {
        res.status(404).json({
          success: false,
          error: 'Preset message not found'
        });
        return;
      }

      if (existingPresetMessage.storeId.toString() !== req.user._id.toString()) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      // Delete preset message
      await PresetMessage.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Preset message deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting preset message:', error);
      res.status(500).json({
        success: false,
        error: 'Error deleting preset message'
      });
    }
  }

  // Get store preset messages
  public async getStorePresetMessages(req: Request, res: Response): Promise<void> {
    try {
      // Verify user is store owner
      if (req.user.userType !== 'store') {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      const storeId = req.user._id;
      const category = req.query.category as string | undefined;

      const presetMessages = await chatService.getPresetMessages(storeId.toString(), category);

      res.status(200).json({
        success: true,
        data: presetMessages
      });
    } catch (error) {
      console.error('Error fetching store preset messages:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching store preset messages'
      });
    }
  }
}