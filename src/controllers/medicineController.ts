import { Request, Response } from 'express';
import { Medicine } from '../models/Product';

export class MedicineController {
    async create(req: Request, res: Response) {
        try {
            const medicine = new Medicine(req.body);
            await medicine.save();
            return res.status(201).json(medicine);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const { tags, store, category } = req.query;
            let query: any = {};

            if (tags) query.tags = { $in: tags };
            if (store) query.stores = store;
            if (category) query.categoryId = category;

            const medicines = await Medicine.find(query)
                .populate('categoryId')
                .populate('stores');
            return res.json(medicines);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }
    async getMedicineByCategory(req: Request, res: Response) {
        try {
            const { categoryId } = req.params;
            const medicines = await Medicine.find({ categoryId })
                .populate('categoryId')
                .populate('stores')
                .sort({ createdAt: -1 });

            if (!medicines.length) {
                return res.status(404).json({ 
                    message: 'No medicines found in this category' 
                });
            }

            return res.json(medicines);
        } catch (error: any) {
            return res.status(500).json({
                error: error.message
            });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const medicine = await Medicine.findById(req.params.id)
                .populate('categoryId')
                .populate('stores');
            if (!medicine) {
                return res.status(404).json({ error: 'Medicine not found' });
            }
            return res.json(medicine);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const medicine = await Medicine.findByIdAndUpdate(
                req.params.id,
                { ...req.body, updatedAt: new Date() },
                { new: true }
            );
            if (!medicine) {
                return res.status(404).json({ error: 'Medicine not found' });
            }
            return res.json(medicine);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const medicine = await Medicine.findByIdAndDelete(req.params.id);
            if (!medicine) {
                return res.status(404).json({ error: 'Medicine not found' });
            }
            return res.json({ message: 'Medicine deleted successfully' });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }
    async bulkCreate(req: Request, res: Response): Promise<void> {
        try {
            // Check if request body is an array
            if (!Array.isArray(req.body)) {
                res.status(400).json({
                    success: false,
                    error: 'Request body must be an array of medicines'
                });
                return;
            }

            // Validate the length of the array
            if (req.body.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No medicines provided'
                });
                return;
            }

            // Create all medicines
            const medicines = await Medicine.insertMany(req.body, { 
                ordered: false, // Continue inserting even if some documents error
                rawResult: true // Get detailed information about the insert
            });

            res.status(201).json({
                success: true,
                data: {
                    inserted: medicines.insertedCount,
                    medicines: medicines.insertedIds
                }
            });
        } catch (error: any) {
            if (error.code === 11000) {
                // Handle duplicate key errors
                res.status(400).json({
                    success: false,
                    error: 'Some medicines have duplicate SKUs'
                });
                return;
            }

            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map((err: any) => err.message);
                res.status(400).json({
                    success: false,
                    error: messages
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
}