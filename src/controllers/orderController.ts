import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';
import { Medicine } from '../models/Product';
import { Store } from '../models/Store';
import mongoose from 'mongoose';

export class OrderController {
    // Create a new order with optimal store selection algorithm
    async createOrder(req: Request, res: Response): Promise<void> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const userId = req.user._id;
            const { longitude, latitude, deliveryAddress, paymentMethod = 'COD' } = req.body;
            const maxDistance = req.body.maxDistance || 5000; // Default 5km
            console.log('Request body:', req.body);
            console.log('Auth user:', userId);
            console.log('Cart before order:', await Cart.findOne({ userId: req.user?.id || req.body.userId }));

            // 1. Get the user's cart
            const cart = await Cart.findOne({ userId }).session(session);
            if (!cart || !cart.items || cart.items.length === 0) {
                await session.abortTransaction();
                session.endSession();
                res.status(400).json({ success: false, error: 'Cart is empty' });
                return;
            }

            // 2. Extract all medicine IDs
            const medicineIds = cart.items.map(item => item.medicineId);

            // 3. Fetch all medicines in one query for efficiency
            const medicines = await Medicine.find({ _id: { $in: medicineIds } }).session(session);

            // 4. Create a lookup map for easier access
            const medicineMap: { [key: string]: typeof Medicine.prototype } = {};
            medicines.forEach(med => {
                medicineMap[med._id.toString()] = med;
            });

            // 5. Get nearby stores
            const nearbyStores = await Store.find({
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [Number(longitude), Number(latitude)]
                        },
                        $maxDistance: Number(maxDistance)
                    }
                },
                isVerified: true,
                isActive: true
            }).session(session);

            if (nearbyStores.length === 0) {
                await session.abortTransaction();
                session.endSession();
                res.status(404).json({ success: false, error: 'No stores found nearby' });
                return;
            }

            // 6. First try: Find a single store with all medicines
            for (const store of nearbyStores) {
                const storeId = store._id.toString();

                const availableMedicines = await Medicine.find({
                    _id: { $in: medicineIds },
                    stores: storeId,
                    isAvailable: true,
                    stock: { $gte: 1 } // At least 1 in stock
                }).session(session);

                if (availableMedicines.length === medicineIds.length) {
                    // All medicines available in this store - create a single order
                    const items = cart.items.map(item => {
                        const medicine = medicineMap[item.medicineId.toString()];
                        return {
                            medicineId: item.medicineId,
                            name: medicine.name,
                            quantity: item.quantity,
                            price: item.price
                        };
                    });

                    // Calculate total amounts
                    const totalAmount = cart.totalAmount;
                    const tax = totalAmount * 0.18; // 18% GST
                    const deliveryFee = 40; // Fixed delivery fee
                    const finalAmount = totalAmount + tax + deliveryFee;

                    // Check if any medicine requires prescription
                    const prescriptionRequired = await Medicine.findOne({
                        _id: { $in: medicineIds },
                        requiresPrescription: true
                    }).session(session);

                    // Create order
                    const order = await Order.create(
                        [{
                            userId,
                            storeId: store._id,
                            items,
                            totalAmount,
                            tax,
                            deliveryFee,
                            finalAmount,
                            paymentMethod,
                            paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
                            deliveryAddress,
                            currentStatus: 'PENDING',
                            statusHistory: [
                                {
                                    status: 'PENDING',
                                    timestamp: new Date(),
                                    notes: 'Order placed successfully'
                                }
                            ],
                            estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                            prescriptionRequired: !!prescriptionRequired,
                            isPrescriptionVerified: false
                        }],
                        { session }
                    );

                    // Clear cart after successful order
                    await Cart.findByIdAndUpdate(
                        cart._id,
                        { items: [], totalAmount: 0 },
                        { session }
                    );

                    // Commit transaction
                    await session.commitTransaction();
                    session.endSession();

                    // Return successful response
                    res.status(201).json({
                        success: true,
                        message: 'Order created successfully',
                        data: order[0]
                    });
                    return;
                }
            }

            // 7. Second try: Find optimal combination of two stores
            let bestCombination = null;
            let maxCoverage = 0;

            // For each pair of stores
            for (let i = 0; i < nearbyStores.length; i++) {
                for (let j = i + 1; j < nearbyStores.length; j++) {
                    const store1 = nearbyStores[i];
                    const store2 = nearbyStores[j];

                    // Get medicines available in store1
                    const availableMedicinesStore1 = await Medicine.find({
                        _id: { $in: medicineIds },
                        stores: store1._id.toString(),
                        isAvailable: true,
                        stock: { $gt: 0 }
                    }).session(session);

                    // Get medicines available in store2
                    const availableMedicinesStore2 = await Medicine.find({
                        _id: { $in: medicineIds },
                        stores: store2._id.toString(),
                        isAvailable: true,
                        stock: { $gt: 0 }
                    }).session(session);

                    // Create sets for easy comparison
                    const availableInStore1 = new Set(availableMedicinesStore1.map(med => med._id.toString()));
                    const availableInStore2 = new Set(availableMedicinesStore2.map(med => med._id.toString()));

                    // Find total unique medicines covered by both stores
                    const combinedCoverage = new Set([...availableInStore1, ...availableInStore2]);

                    // If this combination covers more medicines than our current best, update it
                    if (combinedCoverage.size > maxCoverage) {
                        maxCoverage = combinedCoverage.size;
                        bestCombination = {
                            store1: {
                                storeId: store1._id,
                                storeName: store1.name,
                                medicines: [...availableInStore1]
                            },
                            store2: {
                                storeId: store2._id,
                                storeName: store2.name,
                                medicines: [...availableInStore2].filter(id => !availableInStore1.has(id)) // Only unique to store2
                            },
                            totalCoverage: combinedCoverage.size
                        };

                        // If we found a combination that covers all medicines, break early
                        if (combinedCoverage.size === medicineIds.length) {
                            break;
                        }
                    }
                }

                // Break outer loop too if we found complete coverage
                if (maxCoverage === medicineIds.length) {
                    break;
                }
            }

            // 8. Process the best two-store combination
            if (bestCombination && maxCoverage === medicineIds.length) {
                // Create items for store 1
                const store1Items = cart.items
                    .filter(item => bestCombination.store1.medicines.includes(item.medicineId.toString()))
                    .map(item => {
                        const medicine = medicineMap[item.medicineId.toString()];
                        return {
                            medicineId: item.medicineId,
                            name: medicine.name,
                            quantity: item.quantity,
                            price: item.price
                        };
                    });

                // Create items for store 2
                const store2Items = cart.items
                    .filter(item => bestCombination.store2.medicines.includes(item.medicineId.toString()))
                    .map(item => {
                        const medicine = medicineMap[item.medicineId.toString()];
                        return {
                            medicineId: item.medicineId,
                            name: medicine.name,
                            quantity: item.quantity,
                            price: item.price
                        };
                    });

                // Calculate amounts for each store
                const store1Total = store1Items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const store2Total = store2Items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                const store1Tax = store1Total * 0.18;
                const store2Tax = store2Total * 0.18;

                const deliveryFee = 40; // Per store

                const store1Final = store1Total + store1Tax + deliveryFee;
                const store2Final = store2Total + store2Tax + deliveryFee;

                // Check if any medicine requires prescription for each store
                const store1PrescriptionRequired = medicines.some(med =>
                    bestCombination.store1.medicines.includes(med._id.toString()) &&
                    med.requiresPrescription
                );

                const store2PrescriptionRequired = medicines.some(med =>
                    bestCombination.store2.medicines.includes(med._id.toString()) &&
                    med.requiresPrescription
                );

                // Create two orders
                const order1 = await Order.create(
                    [{
                        userId,
                        storeId: bestCombination.store1.storeId,
                        items: store1Items,
                        totalAmount: store1Total,
                        tax: store1Tax,
                        deliveryFee,
                        finalAmount: store1Final,
                        paymentMethod,
                        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
                        deliveryAddress,
                        currentStatus: 'PENDING',
                        statusHistory: [
                            {
                                status: 'PENDING',
                                timestamp: new Date(),
                                notes: 'Order placed successfully'
                            }
                        ],
                        estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                        prescriptionRequired: store1PrescriptionRequired,
                        isPrescriptionVerified: false
                    }],
                    { session }
                );

                const order2 = await Order.create(
                    [{
                        userId,
                        storeId: bestCombination.store2.storeId,
                        items: store2Items,
                        totalAmount: store2Total,
                        tax: store2Tax,
                        deliveryFee,
                        finalAmount: store2Final,
                        paymentMethod,
                        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
                        deliveryAddress,
                        currentStatus: 'PENDING',
                        statusHistory: [
                            {
                                status: 'PENDING',
                                timestamp: new Date(),
                                notes: 'Order placed successfully'
                            }
                        ],
                        estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                        prescriptionRequired: store2PrescriptionRequired,
                        isPrescriptionVerified: false
                    }],
                    { session }
                );

                // Clear cart after successful order creation
                await Cart.findByIdAndUpdate(
                    cart._id,
                    { items: [], totalAmount: 0 },
                    { session }
                );

                // Commit transaction
                await session.commitTransaction();
                session.endSession();

                // Return successful response
                res.status(201).json({
                    success: true,
                    message: 'Orders split between two stores successfully',
                    data: {
                        orders: [order1[0], order2[0]],
                        store1: bestCombination.store1.storeName,
                        store2: bestCombination.store2.storeName
                    }
                });
                return;
            }

            // 9. If we can't fulfill all medicines even with two stores
            await session.abortTransaction();
            session.endSession();
            res.status(404).json({
                success: false,
                error: 'Cannot fulfill your order even with two stores',
                availableMedicines: maxCoverage,
                totalMedicines: medicineIds.length
            });

        } catch (error) {
            // Abort transaction on error
            await session.abortTransaction();
            session.endSession();

            console.error('Order creation error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    // Get all orders for a user
    async getUserOrders(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user._id //we can take either from the params or from the token

            const orders = await Order.find({ userId })
                .sort({ createdAt: -1 })
                .populate('storeId', 'name address phone')
                .exec();

            res.status(200).json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Get user orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
    async getStoreOrders(req: Request, res: Response): Promise<void> {
        try {
            console.log('Store ID:', req.params.storeId);
            const storeId = req.params.storeId;
            
            // // Ensure the user has permission to access this store's orders
            // if (req.user.role !== 'admin' && req.user._id.toString() !== storeId) {
            //     res.status(403).json({
            //         success: false,
            //         error: 'Not authorized to access this store\'s orders'
            //     });
            //     return;
            // }
            console.log('Store ID:', storeId);
            const orders = await Order.find({ storeId })
                .sort({ createdAt: -1 })
                .populate('userId', 'name phone email')
                .exec();
    
            res.status(200).json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Get store orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    // Get single order details
    async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            console.log('Order ID:', req.params.id);
            const order = await Order.findById(req.params.id)
                .populate('storeId', 'name address phone location')
                .populate('userId', 'name phone')
                .exec();

            if (!order) {
                res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
                return;
            }
            console.log('Order:', order);
            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error) {
            console.error('Get order details error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    // Update order status (for store owners and admins)
    async updateOrderStatus(req: Request, res: Response): Promise<void> {
        try {
            const { status, notes } = req.body;

            // Validate status
            const validStatuses = ['ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid status value'
                });
                return;
            }

            const order = await Order.findById(req.params.id);

            if (!order) {
                res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
                return;
            }

            // Check if the user is authorized to update this order
            if (
                req.user?.id !== order.storeId.toString() &&
                req.user?.role !== 'admin'
            ) {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to update this order'
                });
                return;
            }

            // Add to status history
            const statusUpdate = {
                status,
                timestamp: new Date(),
                notes: notes || '',
                updatedBy: req.user?.id
            };

            // Update order
            const updatedOrder = await Order.findByIdAndUpdate(
                req.params.id,
                {
                    currentStatus: status,
                    $push: { statusHistory: statusUpdate },
                    ...(status === 'DELIVERED' ? { actualDeliveryTime: new Date() } : {})
                },
                { new: true }
            )
                .populate('storeId', 'name address phone location')
                .populate('userId', 'name phone')
                .exec();

            res.status(200).json({
                success: true,
                data: updatedOrder
            });
        } catch (error) {
            console.error('Update order status error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    //   // Upload and verify prescription
    //   async uploadPrescription(req: Request, res: Response): Promise<void> {
    //     try {
    //       // Assuming the image is uploaded and available at req.file.path
    //       if (!req.file) {
    //         res.status(400).json({
    //           success: false,
    //           error: 'No prescription image uploaded'
    //         });
    //         return;
    //       }

    //       const order = await Order.findById(req.params.id);

    //       if (!order) {
    //         res.status(404).json({
    //           success: false,
    //           error: 'Order not found'
    //         });
    //         return;
    //       }

    //       // Check if the user is authorized to upload for this order
    //       if (req.user?.id !== order.userId.toString()) {
    //         res.status(403).json({
    //           success: false,
    //           error: 'Not authorized to upload prescription for this order'
    //         });
    //         return;
    //       }

    //       // Update the order with prescription image
    //       const updatedOrder = await Order.findByIdAndUpdate(
    //         req.params.id,
    //         {
    //           prescriptionImage: req.file.path,
    //           isPrescriptionVerified: false // Reset verification status
    //         },
    //         { new: true }
    //       );

    //       res.status(200).json({
    //         success: true,
    //         message: 'Prescription uploaded successfully',
    //         data: updatedOrder
    //       });
    //     } catch (error) {
    //       console.error('Upload prescription error:', error);
    //       res.status(500).json({
    //         success: false,
    //         error: 'Server Error'
    //       });
    //     }
    //   }

    //   // Verify prescription (for store owners only)
    //   async verifyPrescription(req: Request, res: Response): Promise<void> {
    //     try {
    //       const { verified, notes } = req.body;

    //       const order = await Order.findById(req.params.id);

    //       if (!order) {
    //         res.status(404).json({
    //           success: false,
    //           error: 'Order not found'
    //         });
    //         return;
    //       }

    //       // Check if the user is authorized to verify for this order
    //       if (
    //         req.user?.id !== order.storeId.toString() &&
    //         req.user?.role !== 'admin'
    //       ) {
    //         res.status(403).json({
    //           success: false,
    //           error: 'Not authorized to verify prescription for this order'
    //         });
    //         return;
    //       }

    //       // If prescription is rejected, update order status to CANCELLED
    //       let updateData: any = {
    //         isPrescriptionVerified: verified
    //       };

    //       if (!verified) {
    //         updateData.currentStatus = 'CANCELLED';
    //         updateData.statusHistory = [
    //           ...order.statusHistory,
    //           {
    //             status: 'CANCELLED',
    //             timestamp: new Date(),
    //             notes: notes || 'Prescription rejected',
    //             updatedBy: req.user?.id
    //           }
    //         ];
    //       }

    //       // Update the order
    //       const updatedOrder = await Order.findByIdAndUpdate(
    //         req.params.id,
    //         updateData,
    //         { new: true }
    //       );

    //       res.status(200).json({
    //         success: true,
    //         message: verified ? 'Prescription verified successfully' : 'Prescription rejected',
    //         data: updatedOrder
    //       });
    //     } catch (error) {
    //       console.error('Verify prescription error:', error);
    //       res.status(500).json({
    //         success: false,
    //         error: 'Server Error'
    //       });
    //     }
    //   }

    // Add review and rating to order
    async addReview(req: Request, res: Response): Promise<void> {
        try {
            const { rating, review } = req.body;

            // Validate rating
            if (rating < 1 || rating > 5) {
                res.status(400).json({
                    success: false,
                    error: 'Rating must be between 1 and 5'
                });
                return;
            }

            const order = await Order.findById(req.params.id);

            if (!order) {
                res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
                return;
            }

            // Check if the user is authorized to add review for this order
            if (req.user?.id !== order.userId.toString()) {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to add review for this order'
                });
                return;
            }

            // Check if the order is delivered
            if (order.currentStatus !== 'DELIVERED') {
                res.status(400).json({
                    success: false,
                    error: 'Can only review delivered orders'
                });
                return;
            }

            // Update the order with review
            const updatedOrder = await Order.findByIdAndUpdate(
                req.params.id,
                {
                    rating,
                    review
                },
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: 'Review added successfully',
                data: updatedOrder
            });
        } catch (error) {
            console.error('Add review error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    // Get active orders count (for stores)
    async getActiveOrdersCount(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.params.storeId || req.user?.id;

            const activeOrdersCount = await Order.countDocuments({
                storeId,
                currentStatus: { $in: ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY'] }
            });

            res.status(200).json({
                success: true,
                count: activeOrdersCount
            });
        } catch (error) {
            console.error('Get active orders count error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }

    // Get orders by status for a store
    async getOrdersByStatus(req: Request, res: Response): Promise<void> {
        try {
            const storeId = req.params.storeId || req.user?.id;
            const { status } = req.query;

            // Validate status if provided
            if (status) {
                const validStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
                if (!validStatuses.includes(status as string)) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid status value'
                    });
                    return;
                }
            }

            // Build query
            const query: any = { storeId };
            if (status) {
                query.currentStatus = status;
            }

            const orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .populate('userId', 'name phone')
                .exec();

            res.status(200).json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Get orders by status error:', error);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
}