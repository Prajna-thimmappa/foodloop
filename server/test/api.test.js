process.env.NODE_ENV = 'test';

import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';
import http from 'node:http';
import { app, connectDatabase } from '../src/index.js';
import { User } from '../src/models.js';
import bcrypt from 'bcryptjs';

let server;
let baseUrl;
let donorToken;
let volunteerToken;
let adminToken;
let donationId;
let pickupCode;

async function request(method, path, body, token) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  if (token) init.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function register(role, email, name) {
  const { status, data } = await request('POST', '/api/auth/register', {
    name, email, password: 'Password123!', role,
  });
  return { status, data };
}

async function login(email) {
  const { status, data } = await request('POST', '/api/auth/login', { email, password: 'Password123!' });
  return { status, data };
}

async function createAdmin() {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await User.create({
    name: 'Admin One',
    organization: 'FoodLoop',
    email: 'admin@test.foodloop.org',
    passwordHash,
    role: 'admin',
  });
  return user;
}

describe('FoodLoop API', () => {
  before(async () => {
    await connectDatabase();
    await createAdmin();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('auth', () => {
    it('registers a donor, an NGO, and a volunteer', async () => {
      const donor = await register('donor', 'donor@test.foodloop.org', 'Donor One');
      assert.equal(donor.status, 201, JSON.stringify(donor.data));
      donorToken = donor.data.token;

      const ngo = await register('ngo', 'ngo@test.foodloop.org', 'NGO One');
      assert.equal(ngo.status, 201, JSON.stringify(ngo.data));

      const volunteer = await register('volunteer', 'volunteer@test.foodloop.org', 'Volunteer One');
      assert.equal(volunteer.status, 201, JSON.stringify(volunteer.data));
      volunteerToken = volunteer.data.token;
    });

    it('rejects admin registration via public endpoint', async () => {
      const res = await register('admin', 'bad-admin@test.foodloop.org', 'Bad Admin');
      assert.equal(res.status, 400);
    });

    it('rejects duplicate email', async () => {
      const res = await register('ngo', 'donor@test.foodloop.org', 'Duplicate');
      assert.equal(res.status, 409);
    });

    it('rejects short password', async () => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Short', email: 'short@test.foodloop.org', password: 'short', role: 'ngo',
      });
      assert.equal(res.status, 400);
    });

    it('logs in and rejects bad credentials', async () => {
      const ok = await login('donor@test.foodloop.org');
      assert.equal(ok.status, 200);
      assert.ok(ok.data.token);

      const bad = await request('POST', '/api/auth/login', { email: 'donor@test.foodloop.org', password: 'WrongPassword123!' });
      assert.equal(bad.status, 401);
    });

    it('logs in as admin', async () => {
      const ok = await login('admin@test.foodloop.org');
      assert.equal(ok.status, 200);
      assert.ok(ok.data.token);
      adminToken = ok.data.token;
    });

    it('logs out and invalidates the session', async () => {
      const res = await request('POST', '/api/auth/logout', {}, donorToken);
      assert.equal(res.status, 200);

      const me = await request('GET', '/api/donations/mine', undefined, donorToken);
      assert.equal(me.status, 401);
    });
  });

  describe('donations', () => {
    before(async () => {
      const logged = await login('donor@test.foodloop.org');
      donorToken = logged.data.token;
    });

    it('lists available donations', async () => {
      const res = await request('GET', '/api/donations?status=available');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.donations));
    });

    it('creates a donation as a donor', async () => {
      const res = await request('POST', '/api/donations', {
        name: 'Test Donation',
        category: 'Prepared meals',
        description: 'A test donation.',
        quantity: '5 meals',
        location: 'Test Kitchen',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        dietary: 'Vegetarian',
      }, donorToken);
      assert.equal(res.status, 201, JSON.stringify(res.data));
      assert.ok(res.data.donation);
      donationId = res.data.donation.id;
    });

    it('rejects donation creation with missing fields', async () => {
      const res = await request('POST', '/api/donations', { name: 'Incomplete' }, donorToken);
      assert.equal(res.status, 400);
    });

    it('rejects non-donor creating a donation', async () => {
      const res = await request('POST', '/api/donations', {
        name: 'Bad Donation', category: 'Prepared meals', quantity: '1 meal',
        location: 'Somewhere', expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      }, volunteerToken);
      assert.equal(res.status, 403);
    });

    it('gets my donations as a donor', async () => {
      const res = await request('GET', '/api/donations/mine', undefined, donorToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.donations));
    });

    it('gets pickups as a volunteer', async () => {
      const res = await request('GET', '/api/donations/pickups', undefined, volunteerToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.donations));
    });

    it('denies pickups to a donor', async () => {
      const res = await request('GET', '/api/donations/pickups', undefined, donorToken);
      assert.equal(res.status, 403);
    });
  });

  describe('claim and pickup verification', () => {
    before(async () => {
      const logged = await login('volunteer@test.foodloop.org');
      volunteerToken = logged.data.token;
    });

    it('claims an available donation', async () => {
      const res = await request('PATCH', `/api/donations/${donationId}/claim`, {}, volunteerToken);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.donation.status, 'claimed');
    });

    it('rejects claiming an already claimed donation', async () => {
      const res = await request('PATCH', `/api/donations/${donationId}/claim`, {}, volunteerToken);
      assert.equal(res.status, 409);
    });

    it('denies claim to a donor', async () => {
      const { status } = await request('PATCH', `/api/donations/${donationId}/claim`, {}, donorToken);
      assert.equal(status, 403);
    });

    it('generates a pickup code as the donor', async () => {
      const res = await request('POST', `/api/donations/${donationId}/pickup-code`, {}, donorToken);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.ok(res.data.pickupCode);
      pickupCode = res.data.pickupCode;
    });

    it('denies pickup code to a non-donor', async () => {
      const { status } = await request('POST', `/api/donations/${donationId}/pickup-code`, {}, volunteerToken);
      assert.equal(status, 403);
    });

    it('verifies pickup with the correct code', async () => {
      const res = await request('PATCH', `/api/donations/${donationId}/verify-pickup`, { otp: pickupCode }, volunteerToken);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.donation.status, 'collected');
    });

    it('rejects pickup with a wrong code', async () => {
      const created = await request('POST', '/api/donations', {
        name: 'Wrong Code Donation', category: 'Produce', description: 'x',
        quantity: '3 meals', location: 'Test Kitchen',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      }, donorToken);
      const id2 = created.data.donation.id;
      await request('PATCH', `/api/donations/${id2}/claim`, {}, volunteerToken);
      await request('POST', `/api/donations/${id2}/pickup-code`, {}, donorToken);

      const res = await request('PATCH', `/api/donations/${id2}/verify-pickup`, { otp: '000000' }, volunteerToken);
      assert.equal(res.status, 400);
    });

    it('denies verify-pickup to a non-claimant', async () => {
      const { status } = await request('PATCH', `/api/donations/${donationId}/verify-pickup`, { otp: pickupCode }, donorToken);
      assert.equal(status, 403);
    });
  });

  describe('reports', () => {
    it('creates a report', async () => {
      const res = await request('POST', '/api/reports', {
        donationId, reason: 'Unsafe food', details: 'Smelled off.',
      }, volunteerToken);
      assert.equal(res.status, 201, JSON.stringify(res.data));
      assert.equal(res.data.report.status, 'open');
    });

    it('rejects a report with invalid reason', async () => {
      const res = await request('POST', '/api/reports', {
        donationId, reason: 'Not a valid reason', details: 'x',
      }, volunteerToken);
      assert.equal(res.status, 400);
    });

    it('rejects a report without a donationId', async () => {
      const res = await request('POST', '/api/reports', { reason: 'Unsafe food', details: 'x' }, volunteerToken);
      assert.equal(res.status, 400);
    });
  });

  describe('admin', () => {
    it('gets admin stats', async () => {
      const res = await request('GET', '/api/admin/stats', undefined, adminToken);
      assert.equal(res.status, 200);
      assert.ok(typeof res.data.users === 'number');
      assert.ok(typeof res.data.available === 'number');
    });

    it('gets admin users', async () => {
      const res = await request('GET', '/api/admin/users', undefined, adminToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.users));
    });

    it('denies admin endpoints to a non-admin', async () => {
      const stats = await request('GET', '/api/admin/stats', undefined, volunteerToken);
      assert.equal(stats.status, 403);
      const users = await request('GET', '/api/admin/users', undefined, volunteerToken);
      assert.equal(users.status, 403);
    });
  });

  describe('health', () => {
    it('reports healthy', async () => {
      const res = await request('GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'ok');
    });
  });
});
