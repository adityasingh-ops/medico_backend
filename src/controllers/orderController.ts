import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';
import { Medicine } from '../models/Product';
import { Store } from '../models/Store';
import Verification from '../models/Verification';
import { SERVICE_RADIUS_M } from '../config/serviceArea';
import mongoose from 'mongoose';

export class OrderController {
    // Create a new order with optimal store selection algorithm
    async createOrder(req: Request, res: Response): Promise<void> {
        const { longitude, latitude, deliveryAddress, paymentMethod = 'COD', verificationId } = req.body;
        const maxDistance = req.body.maxDistance || SERVICE_RADIUS_M;

        // Validate coordinates before touching the DB
        const lng = Number(longitude);
        const lat = Number(latitude);
        if (!longitude || !latitude || isNaN(lng) || isNaN(lat)) {
            res.status(400).json({ success: false, error: 'Valid location is required to place an order' });
            return;
        }

        // MongoDB does NOT allow $near inside transactions — run this before starting
        // the session. Uses the same service radius as the catalogue, so anything the
        // user could add to the cart is genuinely orderable from their address.
        const matchedRadius = Number(maxDistance) || SERVICE_RADIUS_M;

        let nearbyStores: any[] = [];
        try {
            nearbyStores = await Store.find({
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [lng, lat] },
                        $maxDistance: matchedRadius
                    }
                },
                isVerified: true,
                isActive: true
            });
        } catch (geoError) {
            console.error('Geo query error:', geoError);
            res.status(500).json({ success: false, error: 'Location search failed' });
            return;
        }

        if (nearbyStores.length === 0) {
            res.status(404).json({
                success: false,
                error: `We don't deliver to this address yet — no partner pharmacy within ${Math.round(matchedRadius / 1000)} km`,
                serviceRadiusKm: Math.round(matchedRadius / 1000)
            });
            return;
        }

        const nearbyStoreIds = nearbyStores.map((s: any) => s._id);

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const userId = req.user._id;

            // If a doctor verification was completed, the order carries a signed e-prescription.
            let prescriptionVerified = false;
            let signedPrescriptionRef: any = undefined;
            if (verificationId) {
                const verification = await Verification.findById(verificationId).session(session);
                if (verification && verification.status === 'approved') {
                    prescriptionVerified = true;
                    signedPrescriptionRef = verification.signedPrescriptionId;
                }
            }

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

            // 6. Single aggregation: for every nearby store, which cart medicines are in stock?
            //    This replaces O(S + S²) separate Medicine.find() calls with one round-trip.
            //
            //    Result shape: [{ _id: storeId, meds: [medicineId, ...] }]
            const coverageRaw: { _id: mongoose.Types.ObjectId; meds: mongoose.Types.ObjectId[] }[] =
                await Medicine.aggregate([
                    { $match: { _id: { $in: medicineIds }, isAvailable: true, stock: { $gte: 1 } } },
                    // Keep only stores that are in the nearby list
                    { $project: {
                        stores: { $filter: { input: '$stores', as: 's', cond: { $in: ['$$s', nearbyStoreIds] } } }
                    }},
                    { $unwind: '$stores' },
                    { $group: { _id: '$stores', meds: { $addToSet: '$_id' } } }
                ]);

            // coverage: storeId (string) → Set of medicineId strings it can fulfil
            const coverage = new Map<string, Set<string>>();
            for (const { _id, meds } of coverageRaw) {
                coverage.set(_id.toString(), new Set(meds.map(id => id.toString())));
            }

            const needed = new Set(medicineIds.map((id: any) => id.toString()));
            const prescriptionRequired = medicines.some((m: any) => m.requiresPrescription);

            // Helper: build order payload for a set of medicineId strings going to one store
            const buildItems = (medIdSet: Set<string>) =>
                cart.items
                    .filter((item: any) => medIdSet.has(item.medicineId.toString()))
                    .map((item: any) => {
                        const med = medicineMap[item.medicineId.toString()];
                        return { medicineId: item.medicineId, name: med.name, quantity: item.quantity, price: item.price };
                    });

            const DELIVERY_FEE = 40;
            const GST = 0.18;

            const makeOrderDoc = (storeId: any, items: any[], rxRequired: boolean) => {
                const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
                const tax = total * GST;
                return {
                    userId, storeId,
                    items, totalAmount: total, tax,
                    deliveryFee: DELIVERY_FEE, finalAmount: total + tax + DELIVERY_FEE,
                    paymentMethod, paymentStatus: 'PENDING', deliveryAddress,
                    currentStatus: 'PENDING',
                    statusHistory: [{ status: 'PENDING', timestamp: new Date(), notes: 'Order placed successfully' }],
                    estimatedDeliveryTime: new Date(Date.now() + 20 * 60 * 1000),
                    prescriptionRequired: rxRequired, isPrescriptionVerified: prescriptionVerified,
                    ...(signedPrescriptionRef ? { prescriptionImage: String(signedPrescriptionRef) } : {})
                };
            };

            // 7. Phase 1 — single store, nearest first (in-memory check, no extra DB queries)
            for (const store of nearbyStores) {
                const covered = coverage.get(store._id.toString());
                if (!covered) continue;
                // Does this store carry every medicine we need?
                if ([...needed].every(id => covered.has(id))) {
                    const order = await Order.create(
                        [makeOrderDoc(store._id, buildItems(needed), prescriptionRequired)],
                        { session }
                    );
                    await Cart.findByIdAndUpdate(cart._id, { items: [], totalAmount: 0 }, { session });
                    await session.commitTransaction();
                    session.endSession();
                    res.status(201).json({
                        success: true,
                        message: 'Order created successfully',
                        data: order[0],
                        store: store.name,
                        serviceRadiusKm: Math.round(matchedRadius / 1000)
                    });
                    return;
                }
            }

            // 8. Phase 2 — greedy 2-store cover, still in-memory (S² pairs, zero extra DB queries)
            //
            //    Iterate pairs in distance order so the combination with the two closest stores
            //    that achieves full coverage wins.  For each valid pair we assign:
            //      • store1 (closer) gets every item it can cover
            //      • store2 (farther) gets whatever store1 cannot cover
            //    This minimises the farther leg of the split.
            for (let i = 0; i < nearbyStores.length; i++) {
                const s1 = nearbyStores[i];
                const c1 = coverage.get(s1._id.toString()) ?? new Set<string>();
                for (let j = i + 1; j < nearbyStores.length; j++) {
                    const s2 = nearbyStores[j];
                    const c2 = coverage.get(s2._id.toString()) ?? new Set<string>();
                    // Union covers everything?
                    if ([...needed].every(id => c1.has(id) || c2.has(id))) {
                        const s1Meds = new Set([...needed].filter(id => c1.has(id)));
                        const s2Meds = new Set([...needed].filter(id => !c1.has(id)));

                        const rx1 = medicines.some((m: any) => s1Meds.has(m._id.toString()) && m.requiresPrescription);
                        const rx2 = medicines.some((m: any) => s2Meds.has(m._id.toString()) && m.requiresPrescription);

                        const [order1, order2] = await Promise.all([
                            Order.create([makeOrderDoc(s1._id, buildItems(s1Meds), rx1)], { session }),
                            Order.create([makeOrderDoc(s2._id, buildItems(s2Meds), rx2)], { session }),
                        ]);

                        await Cart.findByIdAndUpdate(cart._id, { items: [], totalAmount: 0 }, { session });
                        await session.commitTransaction();
                        session.endSession();
                        res.status(201).json({
                            success: true,
                            message: 'Orders split between two stores successfully',
                            data: {
                                orders: [order1[0], order2[0]],
                                store1: s1.name,
                                store2: s2.name,
                                serviceRadiusKm: Math.round(matchedRadius / 1000)
                            }
                        });
                        return;
                    }
                }
            }

            // 9. No combination of ≤ 2 nearby stores can cover the full cart
            await session.abortTransaction();
            session.endSession();
            // Name the items no reachable pharmacy stocks — a bare failure gave the
            // user nothing to act on.
            const coverable = new Set<string>();
            for (const set of coverage.values()) for (const id of set) coverable.add(id);
            const unavailable = [...needed]
                .filter(id => !coverable.has(id))
                .map(id => medicineMap[id]?.name)
                .filter(Boolean);

            res.status(404).json({
                success: false,
                error: unavailable.length
                    ? `Not stocked by any pharmacy near you: ${unavailable.join(', ')}`
                    : 'No single pharmacy (or pair) near you can cover your whole cart',
                unavailableItems: unavailable,
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
            console.log('Order ID:', req.params.id);
            const order = await Order.findById(req.params.id);

            if (!order) {
                res.status(404).json({
                    success: false,
                    error: 'Order not found'
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