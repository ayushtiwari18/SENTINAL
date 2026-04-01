const request = require('supertest');
const { app } = require('../../server');   // ← destructure now

describe("Health Check API", () => {

  it("should return 200 with success true", async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return status ok in data", async () => {
    const res = await request(app).get('/health');
    expect(res.body.data.status).toBe("ok");
  });

  it("should return uptime as a number", async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.data.uptime).toBe("number");
  });

  it("should return dbStatus field", async () => {
    const res = await request(app).get('/health');
    expect(res.body.data.dbStatus).toBeDefined();
  });

  it("should return 404 for unknown route", async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });

});
