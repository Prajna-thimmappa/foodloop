import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { user } from './data.js';
import {
  hashPassword,
  verifyPassword,
  dummyPasswordHash,
  createSessionToken,
  hashSessionToken,
} from './auth.js';
import {
  getDonations,
  findDonation,
  saveDonation,
  getReports,
  saveReport,
  getImpactSummary,
  saveImpactSummary,
  findUserByEmail,
  createUser,
  listUsers,
  createSession,
  findUserBySessionTokenHash,
  deleteSession,
} from './database.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4000);
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
}));

const buildUserResponse = (profile = {}) => ({
  id: profile.id ?? user.id,
  name: profile.name ?? user.name,
  role: profile.role ?? user.role,
  organization: profile.organization ?? user.organization,
  email: profile.email ?? user.email,
  city: profile.city ?? user.city,
  streak: profile.streak ?? user.streak,
  mealsShared: profile.mealsShared ?? user.mealsShared,
  impactThisMonth: profile.impactThisMonth ?? user.impactThisMonth,
  notifications: profile.notifications ?? user.notifications,
});

const parseServings = (value) => {
  if (value === null || value === undefined || value === '') return 1;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  if (typeof value === 'string') {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) {
      const numericValue = Number(match[0]);
      if (Number.isFinite(numericValue)) return Math.max(1, Math.round(numericValue));
    }
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(1, Math.round(numericValue)) : 1;
};

const formatExpiry = (value) => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return new Intl.DateTimeFormat('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
};

const normalizeDonation = (donation) => {
  const servings = Number(donation.servings ?? parseServings(donation.quantity ?? 1));
  return {
    ...donation,
    id: donation.id,
    name: donation.name,
    donor: donation.donor ?? 'FoodLoop partner',
    quantity: donation.quantity ?? `${servings} meals`,
    servings: Number.isFinite(servings) ? servings : 1,
    category: donation.category ?? 'Prepared meals',
    location: donation.location ?? 'Neighborhood',
    expiresIn: donation.expiresIn ?? formatExpiry(donation.expiresAt),
    expiresAt: donation.expiresAt ?? new Date().toISOString(),
    status: donation.status ?? 'available',
    claimedBy: donation.claimedBy ?? null,
    image: donation.image || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80',
    description: donation.description ?? 'Fresh food ready for a new home.',
    distance: donation.distance ?? 'Nearby',
    pickupCode: donation.pickupCode ?? undefined,
  };
};

const refreshAvailableListings = () => {
  const impactSummary = getImpactSummary();
  impactSummary.availableListings = getDonations().filter((item) => (item.status ?? 'available') === 'available').length;
  saveImpactSummary(impactSummary);
  return impactSummary;
};

const requireAuth = (req, res, next) => {
  const match = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(req.get('authorization') || '');
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

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.role) return res.status(401).json({ message: 'Please sign in to continue.' });
  const normalized = String(req.user.role).trim().toLowerCase();
  if (!allowedRoles.map((role) => String(role).trim().toLowerCase()).includes(normalized)) {
    return res.status(403).json({ message: 'You do not have permission to do that.' });
  }
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

const getDonationStats = () => {
  const donations = getDonations();
  const reports = getReports();
  const users = listUsers();
  return {
    users: users.length,
    donors: users.filter((userEntry) => userEntry.role === 'donor').length,
    ngos: users.filter((userEntry) => userEntry.role === 'ngo').length,
    available: donations.filter((item) => (item.status ?? 'available') === 'available').length,
    claimed: donations.filter((item) => (item.status ?? 'available') === 'claimed').length,
    collected: donations.filter((item) => (item.status ?? 'available') === 'collected').length,
    openReports: reports.filter((item) => item.status === 'open').length,
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'FoodLoop API', timestamp: new Date().toISOString(), database: 'connected' });
});

app.get('/api/profile', requireAuth, (req, res) => {
  res.json(buildUserResponse(req.user));
});

app.get('/api/overview', (_req, res) => {
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
  const list = getDonations().map(normalizeDonation);
  const status = String(req.query.status ?? 'available');
  const category = String(req.query.category ?? '');
  const search = String(req.query.search ?? '').trim();

  const filtered = list.filter((donation) => {
    if (status && donation.status !== status) return false;
    if (category && category !== 'All food' && donation.category !== category) return false;
    if (!search) return true;
    const haystack = `${donation.name} ${donation.donor} ${donation.location} ${donation.category}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  res.json({ donations: filtered });
});

app.get('/api/donations/:id', (req, res) => {
  const donation = findDonation(req.params.id);
  if (!donation) return res.status(404).json({ message: 'Donation not found.' });
  res.json({ donation: normalizeDonation(donation) });
});

app.get('/api/donations/mine', requireAuth, requireRole('donor'), (req, res) => {
  const donations = getDonations()
    .filter((donation) => {
      const donorId = donation.donorId ?? donation.donor;
      return donorId === req.user.id || donation.donor === req.user.organization || donation.donor === req.user.name;
    })
    .map(normalizeDonation);
  res.json({ donations });
});

app.get('/api/donations/pickups', requireAuth, requireRole('ngo', 'volunteer'), (req, res) => {
  const donations = getDonations()
    .filter((donation) => {
      const claimedBy = donation.claimedBy ?? '';
      return donation.status === 'claimed' || donation.status === 'collected'
        ? claimedBy === req.user.name || claimedBy === req.user.id || claimedBy === req.user.organization
        : false;
    })
    .map(normalizeDonation);
  res.json({ donations });
});

app.post('/api/donations', requireAuth, requireRole('donor', 'admin'), (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || payload.title || '').trim();
  const category = String(payload.category || 'Prepared meals').trim();
  const quantity = String(payload.quantity || payload.servings || '1 meal');
  const location = String(payload.location || 'Neighborhood').trim();
  const expiresAt = payload.expiresAt || payload.expiresIn || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const image = payload.image || payload.photo || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';
  const servings = Number(payload.servings ?? parseServings(quantity));

  if (!name || !category || !location) {
    return res.status(400).json({ message: 'Provide food details, a pickup location, and a future expiry time.' });
  }

  const donation = {
    id: `don-${Date.now()}`,
    name,
    donor: payload.donor || req.user.organization || req.user.name,
    donorId: req.user.id,
    quantity,
    servings,
    category,
    description: payload.description || 'Fresh food ready for a new home.',
    location,
    image,
    expiresAt,
    expiresIn: payload.expiresIn || formatExpiry(expiresAt),
    distance: payload.distance || 'Nearby',
    status: 'available',
    claimedBy: null,
    claimedAt: null,
    collectedAt: null,
    dietary: payload.dietary || 'No preference',
  };

  saveDonation(donation);
  refreshAvailableListings();
  return res.status(201).json({ donation: normalizeDonation(donation) });
});

app.patch('/api/donations/:id/claim', requireAuth, requireRole('ngo', 'volunteer'), (req, res) => {
  const donation = findDonation(req.params.id);
  if (!donation) return res.status(404).json({ message: 'Donation not found.' });
  if (donation.status !== 'available') return res.status(409).json({ message: 'This listing is no longer available.' });

  donation.status = 'claimed';
  donation.claimedBy = req.user.name;
  donation.claimedAt = new Date().toISOString();
  saveDonation(donation);
  refreshAvailableListings();
  return res.json({ donation: normalizeDonation(donation) });
});

app.post('/api/donations/:id/pickup-code', requireAuth, requireRole('donor'), (req, res) => {
  const donation = findDonation(req.params.id);
  if (!donation) return res.status(404).json({ message: 'Donation not found.' });

  const pickupCode = String(100000 + Math.floor(Math.random() * 900000));
  donation.pickupCode = pickupCode;
  saveDonation(donation);
  return res.json({ pickupCode });
});

app.patch('/api/donations/:id/verify-pickup', requireAuth, requireRole('ngo', 'volunteer'), (req, res) => {
  const donation = findDonation(req.params.id);
  if (!donation) return res.status(404).json({ message: 'No active pickup was found for this account.' });
  if (donation.status !== 'claimed' || donation.claimedBy !== req.user.name) {
    return res.status(404).json({ message: 'No active pickup was found for this account.' });
  }

  const otp = String(req.body?.otp ?? '');
  if (!otp || !donation.pickupCode || String(donation.pickupCode) !== otp) {
    return res.status(400).json({ message: 'The pickup code is invalid or expired.' });
  }

  donation.status = 'collected';
  donation.collectedAt = new Date().toISOString();
  saveDonation(donation);
  refreshAvailableListings();
  return res.json({ donation: { id: donation.id, status: donation.status, collectedAt: donation.collectedAt } });
});

app.post('/api/reports', requireAuth, (req, res) => {
  const payload = req.body || {};
  const donationId = payload.donationId || payload.donation || null;
  const reason = payload.reason || 'Other';
  const details = payload.details || '';

  if (!donationId || !['Unsafe food', 'Incorrect details', 'Suspicious listing', 'Other'].includes(reason)) {
    return res.status(400).json({ message: 'Choose a report reason.' });
  }

  const report = {
    id: `report-${Date.now()}`,
    donationId,
    reason,
    details,
    status: 'open',
  };

  saveReport(report);
  res.status(201).json({ report: { id: report.id, status: report.status } });
});

app.get('/api/community/stats', (_req, res) => {
  const donations = getDonations();
  const mealsRedirected = donations
    .filter((item) => (item.status ?? 'available') === 'collected')
    .reduce((total, item) => total + Number(item.servings || parseServings(item.quantity || '1')), 0);
  const partners = 36;
  res.json({ mealsRedirected, completedPickups: donations.filter((item) => (item.status ?? 'available') === 'collected').length, partners });
});

app.post('/api/uploads', requireAuth, (req, res) => {
  const image = req.body?.image || req.body?.url || req.body?.photo;
  if (!image) return res.status(400).json({ message: 'Choose an image to upload.' });
  return res.status(201).json({ url: String(image) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password || password.length > 128) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const account = findUserByEmail(email);
  const passwordMatches = await verifyPassword(password, account?.passwordHash || dummyPasswordHash);
  if (!account || !passwordMatches) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }

  const { passwordHash: _ignored, ...profile } = account;
  return issueSession(profile, res);
});

app.post('/api/auth/register', async (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || '').trim();
  const organization = String(payload.organization || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = String(payload.role || 'ngo').trim().toLowerCase();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const supportedRoles = new Set(['ngo', 'volunteer', 'donor', 'admin']);

  if (!name || !emailIsValid || !password || password.length < 8 || password.length > 128 || !supportedRoles.has(role) || organization.length > 120 || name.length > 80) {
    return res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const profile = {
    id: `user-${randomUUID()}`,
    name,
    organization: organization || name,
    email,
    role,
    city: user.city,
    streak: 0,
    mealsShared: 0,
    impactThisMonth: 0,
    notifications: 0,
  };

  const passwordHash = await hashPassword(password);
  createUser({ id: profile.id, email, passwordHash, profile });
  return issueSession(profile, res, 201);
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  deleteSession(req.sessionTokenHash);
  res.json({ success: true });
});

app.get('/api/admin/stats', requireAuth, requireRole('admin'), (_req, res) => {
  res.json(getDonationStats());
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), (_req, res) => {
  const users = listUsers().map((profile) => buildUserResponse(profile));
  res.json({ users });
});

app.get('/api/impact', (_req, res) => {
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

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(distPath, 'index.html'));
});

const seedDemoAccounts = async () => {
  const accounts = [
    { email: 'donor@foodloop.org', password: 'password123', name: 'Asha Patel', organization: 'Amma Kitchen', role: 'donor' },
    { email: 'volunteer@foodloop.org', password: 'password123', name: 'Leah Kim', organization: 'Community Table', role: 'volunteer' },
    { email: 'admin@foodloop.org', password: 'password123', name: 'FoodLoop Admin', organization: 'FoodLoop', role: 'admin' },
  ];

  for (const account of accounts) {
    if (!findUserByEmail(account.email)) {
      const profile = {
        id: `user-${randomUUID()}`,
        name: account.name,
        organization: account.organization,
        email: account.email,
        role: account.role,
        city: user.city,
        streak: 0,
        mealsShared: 0,
        impactThisMonth: 0,
        notifications: 0,
      };
      const passwordHash = await hashPassword(account.password);
      createUser({ id: profile.id, email: account.email, passwordHash, profile });
    }
  }
};

const startServer = async () => {
  await seedDemoAccounts();
  app.listen(PORT, () => {
    console.log(`FoodLoop backend running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
