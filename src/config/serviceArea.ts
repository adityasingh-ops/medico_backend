/**
 * Single source of truth for how far a pharmacy will serve.
 *
 * Browsing the catalogue, listing nearby stores and routing an order all use
 * this same radius, so what the user sees and what checkout accepts can never
 * disagree. Previously each endpoint had its own cutoff (and one escalated
 * silently), which made the catalogue appear and disappear unpredictably.
 */
export const SERVICE_RADIUS_M = Number(process.env.SERVICE_RADIUS_M || 10000);
