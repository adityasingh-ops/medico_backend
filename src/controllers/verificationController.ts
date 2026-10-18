import { Request, Response } from 'express';
import Verification from '../models/Verification';
import Prescription from '../models/Prescription';

// Pool of partner doctors assigned to verification calls (demo).
const DOCTORS = ['Dr. Meera Rao', 'Dr. Arjun Nair', 'Dr. Kavya Reddy', 'Dr. Sanjay Gupta'];
const pickDoctor = () => DOCTORS[Math.floor(Math.random() * DOCTORS.length)];

export class VerificationController {
  /**
   * POST /api/verifications
   * Body: { items?: [{medicineId, name}], prescriptionId?, type?, phone? }
   * Creates a verification request. A doctor is assigned and (in production) calls
   * the customer; the request stays `pending_call` until a decision arrives.
   */
  static async create(req: Request, res: Response) {
    try {
      const { items = [], prescriptionId, type, phone } = req.body;

      const verification = await Verification.create({
        userId: req.user?._id,
        phone: phone || req.user?.phone,
        type: type || (prescriptionId ? 'rx_upload' : 'rx_medicine'),
        items,
        prescriptionId,
        doctorName: pickDoctor(),
        status: 'pending_call',
      });

      return res.status(201).json({ success: true, data: verification });
    } catch (error: any) {
      console.error('Verification create error:', error?.message || error);
      return res.status(500).json({ error: 'Failed to start verification' });
    }
  }

  // GET /api/verifications/:id — poll status.
  static async get(req: Request, res: Response) {
    try {
      const verification = await Verification.findById(req.params.id);
      if (!verification) return res.status(404).json({ error: 'Verification not found' });
      return res.json({ success: true, data: verification });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to fetch verification' });
    }
  }

  /**
   * PUT /api/verifications/:id/decision  — DOCTOR-SIDE CONTRACT.
   * The doctor/telephony app calls this after the verification call.
   * Body: { decision: 'approved'|'rejected', doctorName?, notes? }
   * On approval, a signed e-prescription is created and linked.
   */
  static async decide(req: Request, res: Response) {
    try {
      const { decision, doctorName, notes } = req.body as {
        decision: 'approved' | 'rejected';
        doctorName?: string;
        notes?: string;
      };
      const verification = await Verification.findById(req.params.id);
      if (!verification) return res.status(404).json({ error: 'Verification not found' });
      if (verification.status !== 'pending_call') {
        return res.status(409).json({ error: `Already ${verification.status}` });
      }

      const docName = doctorName || verification.doctorName || pickDoctor();

      if (decision === 'approved') {
        // Issue a signed e-prescription.
        const signed = await Prescription.create({
          userId: verification.userId,
          image: 'e-signed',
          status: 'approved',
          notes: `E-signed by ${docName} after televerification. Items: ${verification.items
            .map((i: any) => i.name)
            .filter(Boolean)
            .join(', ')}`,
        });
        verification.signedPrescriptionId = signed._id as any;
        verification.status = 'approved';
      } else {
        verification.status = 'rejected';
      }
      verification.doctorName = docName;
      verification.notes = notes;
      verification.decidedAt = new Date();
      await verification.save();

      return res.json({ success: true, data: verification });
    } catch (error: any) {
      console.error('Verification decide error:', error?.message || error);
      return res.status(500).json({ error: 'Failed to record decision' });
    }
  }

  /**
   * POST /api/verifications/:id/simulate — DEV ONLY.
   * Approves the request immediately so the flow can be demoed without a real
   * doctor app. Disabled in production.
   */
  static async simulate(req: Request, res: Response) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    req.body = { decision: 'approved', notes: 'Auto-approved (demo)' };
    return VerificationController.decide(req, res);
  }
}
