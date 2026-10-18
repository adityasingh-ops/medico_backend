import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';

// No database is needed: these tests cover the endpoints Kubernetes and
// Prometheus depend on, plus the feature flag.

const setReadyState = (state: number) => {
  Object.defineProperty(mongoose.connection, 'readyState', { value: state, configurable: true });
};

describe('ops endpoints', () => {
  test('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /readyz returns 503 when MongoDB is not connected', async () => {
    setReadyState(0);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
  });

  test('GET /readyz returns 200 when MongoDB is connected', async () => {
    setReadyState(1);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
  });

  test('GET /version reports the build from env', async () => {
    process.env.APP_VERSION = 'abc1234';
    const res = await request(app).get('/version');
    expect(res.body.version).toBe('abc1234');
  });

  test('GET /metrics exposes request metrics', async () => {
    await request(app).get('/');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('feature flag', () => {
  afterEach(() => {
    delete process.env.FEATURE_AI_PRESCRIPTIONS;
  });

  test('prescription extract returns 503 when the flag is off', async () => {
    process.env.FEATURE_AI_PRESCRIPTIONS = 'false';
    const res = await request(app).post('/api/prescriptions/extract');
    expect(res.status).toBe(503);
  });

  test('prescription extract needs auth when the flag is on', async () => {
    const res = await request(app).post('/api/prescriptions/extract');
    expect(res.status).toBe(401);
  });
});
