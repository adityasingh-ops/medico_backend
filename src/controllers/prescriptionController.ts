import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Medicine } from '../models/Product';
import Prescription from '../models/Prescription';

// Cheapest vision-capable Claude model. Bump to 'claude-sonnet-4-6' for higher
// accuracy on difficult Indian doctor handwriting once volume justifies the cost.
const VLM_MODEL = 'claude-haiku-4-5';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Structured-output schema the model must return.
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Drug/brand name as written' },
          dosage: { type: 'string', description: 'Strength e.g. 500mg, if present' },
          frequency: { type: 'string', description: 'How often, e.g. OD/BD/TDS, if present' },
          confidence: { type: 'number', description: '0-1 confidence of the read' },
        },
        required: ['name', 'dosage', 'frequency', 'confidence'],
      },
    },
  },
  required: ['medicines'],
} as const;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PrescriptionController {
  /**
   * POST /api/prescriptions/extract
   * Body: { imageBase64: string, mediaType?: 'image/jpeg' | 'image/png' }
   * Reads the prescription with a Claude vision model, then matches the extracted
   * drug names against the medicine catalogue so the app can pre-fill the cart.
   */
  static async extract(req: Request, res: Response) {
    try {
      const { imageBase64, mediaType } = req.body as { imageBase64?: string; mediaType?: string };

      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }
      // No API key → fall back to a clearly-labelled demo read instead of a hard
      // 500, so the upload → match → cart flow stays walkable. `demoMode: true`
      // tells the client to badge the result as sample data, never as a real read.
      if (!process.env.ANTHROPIC_API_KEY) {
        return PrescriptionController.demoExtract(req, res);
      }

      const media = (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

      const message = await anthropic.messages.create({
        model: VLM_MODEL,
        max_tokens: 1024,
        system:
          'You are a pharmacist assistant that reads photographed medical prescriptions. ' +
          'Extract every medicine you can identify. Indian prescriptions mix brand names, ' +
          'salts, and Latin abbreviations (OD=once daily, BD=twice, TDS=thrice, SOS=as needed). ' +
          'Return only medicines you can actually read; never invent.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: media, data: imageBase64 } },
              { type: 'text', text: 'Extract the medicines from this prescription.' },
            ],
          },
        ],
        output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      } as any);

      // Pull the JSON text out of the response.
      const textBlock: any = message.content.find((b: any) => b.type === 'text');
      let parsed: { medicines: Array<{ name: string; dosage?: string; frequency?: string; confidence?: number }> } = {
        medicines: [],
      };
      try {
        parsed = JSON.parse(textBlock?.text || '{"medicines":[]}');
      } catch {
        parsed = { medicines: [] };
      }

      const detected = parsed.medicines || [];

      // Match each detected name against the catalogue.
      const matched: any[] = [];
      const unmatched: any[] = [];

      for (const det of detected) {
        const term = (det.name || '').trim();
        if (!term) continue;
        const medicine = await Medicine.findOne({
          name: { $regex: escapeRegex(term), $options: 'i' },
          isAvailable: true,
          stock: { $gte: 1 },
        })
          .populate('stores', 'name address operatingHours rating isVerified')
          .select('name price requiresPrescription images manufacturer stock stores');

        if (medicine) {
          matched.push({ detected: det, medicine });
        } else {
          unmatched.push(det);
        }
      }

      // Persist a lightweight prescription record for history / pharmacist review.
      const prescription = await Prescription.create({
        userId: req.user?._id,
        image: 'inline-base64',
        notes: detected.map((d) => d.name).join(', '),
        status: 'pending',
      });

      return res.json({
        success: true,
        prescriptionId: prescription._id,
        matched,
        unmatched,
        raw: detected,
      });
    } catch (error: any) {
      console.error('Prescription extract error:', error?.message || error);
      return res.status(500).json({ error: 'Failed to read prescription. Please try a clearer photo.' });
    }
  }

  /**
   * Deterministic stand-in for the vision model, used only when
   * ANTHROPIC_API_KEY is unset. Picks real catalogue medicines so the matching
   * and add-to-cart steps exercise the same code paths as a live read.
   * Always flagged `demoMode: true` — this is sample data, not an OCR result.
   */
  private static async demoExtract(req: Request, res: Response) {
    const sample = await Medicine.find({ isAvailable: true, stock: { $gte: 1 } })
      .limit(3)
      .populate('stores', 'name address operatingHours rating isVerified')
      .select('name price requiresPrescription images manufacturer stock stores');

    const matched = sample.map((medicine: any) => ({
      detected: {
        name: medicine.name,
        dosage: '',
        frequency: 'BD',
        confidence: 0.75,
      },
      medicine,
    }));

    const prescription = await Prescription.create({
      userId: req.user?._id,
      image: 'inline-base64',
      notes: `[demo] ${matched.map((m) => m.detected.name).join(', ')}`,
      status: 'pending',
    });

    return res.json({
      success: true,
      demoMode: true,
      notice: 'Sample data — set ANTHROPIC_API_KEY to read real prescriptions.',
      prescriptionId: prescription._id,
      matched,
      unmatched: [],
      raw: matched.map((m) => m.detected),
    });
  }
}
