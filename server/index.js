const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { randomUUID } = require('node:crypto');
const { user } = require('./data');
const {
  hashPassword,
  verifyPassword,
  dummyPasswordHash,
  createSessionToken,
  hashSessionToken,
} = require('./auth');
const {
  getDonations,
  findDonation,
  saveDonation,
  getReports,
  saveReport,
  getImpactSummary,
  saveImpactSummary,
  findUserByEmail,
  createUser,
  createSession,
  findUserBySessionTokenHash,
  deleteSession,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 4000;
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const buildUserResponse = (overrides = {}) => ({
  ...user,
  ...overrides,
  notifications: 3,
});

const refreshAvailableListings = () => {
  const impactSummary = getImpactSummary();
  impactSummary.availableListings = getDonations().filter((item) => item.status === 'available').length;
  saveImpactSummary(impactSummary);
  return impactSummary;
};

const requireAuth = (req, res, next) => {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.get('authorization') || '');
  if (!match) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  const tokenHash = hashSessionToken(match[1]);
  const authenticatedUser = findUserBySessionTokenHash(tokenHash);
  if (!authenticatedUser) {
    return res.status(401).json({ message: 'Your session is invalid or expired. Please sign in again.' });
  }

  req.user = authenticatedUser;
  req.sessionTokenHash = tokenHash;
  return next();
};

const issueSession = (profile, res, status = 200) => {
  const token = createSessionToken();
  createSession(hashSessionToken(token), profile.id, Date.now() + sessionLifetimeMs);
  return res.status(status).json({
    success: true,
    user: buildUserResponse(profile),
    token,
  });
};

const parseServings = (value) => {
  if (value === null || value === undefined || value === '') {
    return 1;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === 'string') {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) {
      const numericValue = Number(match[0]);
      if (Number.isFinite(numericValue)) {
        return Math.max(1, Math.round(numericValue));
      }
    }
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(1, Math.round(numericValue)) : 1;
};

const getDonationStats = () => {
  const donations = getDonations();
  const reports = getReports();
  const available = donations.filter((item) => item.status === 'available').length;
  const claimed = donations.filter((item) => item.status === 'claimed').length;
  const collected = donations.filter((item) => item.status === 'collected').length;

  return {
    users: 128,
    donors: 24,
    ngos: 19,
    available,
    claimed,
    collected,
    openReports: reports.filter((item) => item.status === 'open').length,
  };
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'FoodLoop API', timestamp: new Date().toISOString() });
});

app.get('/api/profile', requireAuth, (req, res) => {
  res.json(buildUserResponse(req.user));
});

app.get('/api/overview', (req, res) => {
  const impactSummary = getImpactSummary();
  res.json({
    city: user.city,
    greeting: `Good afternoon, ${user.name}. Here’s what’s happening around you.`,
    stats: {
      mealsRedirected: impactSummary.redirectedMeals,
      listingsNearYou: impactSummary.availableListings,
      activePartners: impactSummary.activePartners,
      monthlyProgress: impactSummary.monthlyProgress,
      monthlyGoal: impactSummary.monthlyGoal,
    },
    streak: user.streak,
    mealsShared: user.mealsShared,
  });
});

app.get('/api/donations', (req, res) => {
  res.json({ donations: getDonations() });
});

app.post('/api/donations', requireAuth, (req, res) => {
  const payload = req.body || {};
  const name = payload.name || payload.title;
  const quantity = payload.quantity || payload.servings || '1 meal';
  const category = payload.category || 'Prepared meals';
  const location = payload.location || 'Neighborhood';
  const expiresIn = payload.expiresIn || 'Today · 6:30 PM';
  const image = payload.image || payload.photo || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';
  const servings = parseServings(payload.servings ?? quantity);

  if (!name) {
    return res.status(400).json({ message: 'Donation name is required.' });
  }

  const donation = {
    id: `don-${Date.now()}`,
    name,
    donor: payload.donor || req.user.organization,
    quantity: String(quantity),
    servings,
    category,
    location,
    expiresIn,
    distance: payload.distance || '1.2 km',
    status: 'available',
    claimedBy: null,
    image,
    description: payload.description || 'Fresh food ready for a new home.',
  };

  saveDonation(donation);
  refreshAvailableListings();

  return res.status(201).json({ donation });
});

app.patch('/api/donations/:id/claim', requireAuth, (req, res) => {
  const donation = findDonation(req.params.id);

  if (!donation) {
    return res.status(404).json({ message: 'Donation not found.' });
  }

  donation.status = 'claimed';
  donation.claimedBy = req.user.name;
  saveDonation(donation);
  refreshAvailableListings();

  return res.json({ donation });
});

app.post('/api/donations/:id/collect', requireAuth, (req, res) => {
  const donation = findDonation(req.params.id);

  if (!donation) {
    return res.status(404).json({ message: 'Donation not found.' });
  }

  donation.status = 'collected';
  donation.claimedBy = donation.claimedBy || req.user.name;
  saveDonation(donation);
  const impactSummary = refreshAvailableListings();
  impactSummary.redirectedMeals += parseServings(donation.servings ?? donation.quantity ?? 1);
  saveImpactSummary(impactSummary);

  return res.json({ donation, success: true });
});

app.post('/api/donations/:id/pickup-code', requireAuth, (req, res) => {
  const donation = findDonation(req.params.id);

  if (!donation) {
    return res.status(404).json({ message: 'Donation not found.' });
  }

  donation.pickupCode = donation.pickupCode || String(100000 + Math.floor(Math.random() * 900000));
  saveDonation(donation);
  return res.json({ pickupCode: donation.pickupCode });
});

app.get('/api/admin/stats', (req, res) => {
  res.json(getDonationStats());
});

app.post('/api/reports', requireAuth, (req, res) => {
  const payload = req.body || {};
  const report = {
    id: `report-${Date.now()}`,
    donationId: payload.donationId || null,
    reason: payload.reason || 'General concern',
    status: 'open',
  };
  saveReport(report);
  res.status(201).json({ report });
});

app.post('/api/uploads', requireAuth, (req, res) => {
  const { image } = req.body || {};

  if (!image) {
    return res.status(400).json({ message: 'Image payload is required.' });
  }

  const payload = typeof image === 'string' && image.startsWith('data:image') ? image : image;
  return res.json({ url: payload });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || email.length > 254 || !password || password.length > 128) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const account = findUserByEmail(email);
  const passwordMatches = await verifyPassword(password, account?.passwordHash || dummyPasswordHash);
  if (!account || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const { passwordHash, ...profile } = account;
  return issueSession(profile, res);
});

app.post('/api/auth/register', async (req, res) => {
  const payload = req.body || {};
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const name = String(payload.name || '').trim();
  const organization = String(payload.organization || '').trim();
  const allowedRoles = new Set(['ngo', 'volunteer', 'donor']);
  const emailIsValid = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailIsValid || password.length < 8 || password.length > 128 || !name || name.length > 80 || organization.length > 120 || !allowedRoles.has(payload.role)) {
    return res.status(400).json({
      message: 'Provide a valid email, a name, a supported account type, and a password of 8 to 128 characters.',
    });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const profile = {
    id: `user-${randomUUID()}`,
    name,
    role: payload.role,
    organization: organization || name,
    email,
    city: user.city,
    streak: 0,
    mealsShared: 0,
    impactThisMonth: 0,
    notifications: 0,
  };
  const passwordHash = await hashPassword(password);
  if (findUserByEmail(email)) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }
  createUser({ id: profile.id, email, passwordHash, profile });
  return issueSession(profile, res, 201);
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  deleteSession(req.sessionTokenHash);
  res.json({ success: true });
});

app.get('/api/impact', (req, res) => {
  const impactSummary = getImpactSummary();
  res.json({
    summary: {
      mealsThisMonth: user.mealsShared,
      redirectedMeals: impactSummary.redirectedMeals,
      monthlyProgress: impactSummary.monthlyProgress,
      visibleListings: impactSummary.availableListings,
      activePartners: impactSummary.activePartners,
    },
    recentActivity: [
      { type: 'pickup', label: 'Warm bowls, warm hearts', value: 'Confirmed' },
      { type: 'listing', label: 'Farm-fresh produce box', value: 'Available' },
    ],
  });
});

const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  return res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FoodLoop backend running on http://localhost:${PORT}`);
});
