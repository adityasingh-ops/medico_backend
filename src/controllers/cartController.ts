import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Medicine } from '../models/Product';
import { Store } from '../models/Store';

export class CartController {
    // Add item to cart
    static async addItem(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { medicineId, storeId, quantity } = req.body;

            // Validate medicine availability and price
            const medicine = await Medicine.findById(medicineId);
            if (!medicine || !medicine.isAvailable) {
                return res.status(400).json({ message: 'Medicine not available' });
            }

            // Validate store
            const store = await Store.findById(storeId);
            if (!store || !store.isActive) {
                return res.status(400).json({ message: 'Store not available' });
            }

            // Find or create cart
            let cart = await Cart.findOne({ userId });
            if (!cart) {
                cart = new Cart({ userId, items: [] });
            }

            // Check if item already exists in cart
            const existingItemIndex = cart.items.findIndex(
                item => item.medicineId.toString() === medicineId && item.storeId.toString() === storeId
            );

            if (existingItemIndex > -1) {
                // Update existing item quantity
                cart.items[existingItemIndex].quantity += quantity;
            } else {
                // Add new item
                cart.items.push({
                    medicineId,
                    storeId,
                    quantity,
                    price: medicine.price
                });
            }

            await cart.save();
            return res.status(200).json(cart);
        } catch (error) {
            return res.status(500).json({ message: 'Error adding item to cart', error });
        }
    }

    // Update item quantity
    static async updateItemQuantity(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { medicineId, storeId, quantity } = req.body;

            const cart = await Cart.findOne({ userId });
            if (!cart) {
                return res.status(404).json({ message: 'Cart not found' });
            }

            const itemIndex = cart.items.findIndex(
                item => item.medicineId.toString() === medicineId && item.storeId.toString() === storeId
            );

            if (itemIndex === -1) {
                return res.status(404).json({ message: 'Item not found in cart' });
            }

            if (quantity < 1) {
                cart.items.splice(itemIndex, 1);
            } else {
                cart.items[itemIndex].quantity = quantity;
            }

            await cart.save();
            return res.status(200).json(cart);
        } catch (error) {
            return res.status(500).json({ message: 'Error updating cart item', error });
        }
    }

    // Remove item from cart
    static async removeItem(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { medicineId} = req.body;

            const cart = await Cart.findOne({ userId });
            if (!cart) {
                return res.status(404).json({ message: 'Cart not found' });
            }

            cart.items = cart.items.filter(
                item => !(item.medicineId.toString() === medicineId )
            );

            await cart.save();
            return res.status(200).json(cart);
        } catch (error) {
            return res.status(500).json({ message: 'Error removing item from cart', error });
        }
    }

    // Clear cart
    static async clearCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;

            const cart = await Cart.findOne({ userId });
            // Nothing to clear is the desired end state, so report success.
            if (!cart) {
                return res.status(200).json({ userId, items: [], totalAmount: 0 });
            }

            cart.items = [];
            await cart.save();
            return res.status(200).json(cart);
        } catch (error) {
            return res.status(500).json({ message: 'Error clearing cart', error });
        }
    }

    // Get cart
    static async getCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;

            const cart = await Cart.findOne({ userId })
                .populate('items.medicineId')
                .populate('items.storeId');

            // A user who has never added anything has no Cart document. That is an
            // empty cart, not an error — 404 here made the client show a failure
            // state on a brand-new account.
            if (!cart) {
                return res.status(200).json({ userId, items: [], totalAmount: 0 });
            }

            return res.status(200).json(cart);
        } catch (error) {
            return res.status(500).json({ message: 'Error fetching cart', error });
        }
    }
}