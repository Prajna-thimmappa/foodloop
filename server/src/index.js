import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Donation, PickupVerification, Report, User } from './models.js';
import { VALID_ROLES, isRegistrationRole, normalizeEmail, normalizeRole } from './roles.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../.env') });

const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'local-development-secret-change-me');
if (isProduction && jwtSecret.length < 32) throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production.');
const uploadsDirectory = path.resolve(currentDirectory, '../uploads');
let mongoMemoryServer;

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDirectory));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
}));

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadsDirectory),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Upload a JPG, PNG, or WebP image.'));
    callback(null, true);
  },
});

const databaseReady = () => mongoose.connection.readyState === 1;

function requireDatabase(_request, response, next) {
  if (!databaseReady()) return response.status(503).json({ message: 'Database is not connected. Configure MONGODB_URI to use the API.' });
  next();
}

async function authenticate(request, response, next) {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ message: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    request.user = await User.findById(payload.sub).select('-passwordHash');
    if (!request.user || !request.user.role) return response.status(401).json({ message: 'Your account could not be found.' });
    if (Number(payload.ver || 0) !== Number(request.user.tokenVersion || 0)) return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    next();
  } catch {
    response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !request.user.role) return response.status(401).json({ message: 'Please sign in to continue.' });
    const normalizedRoles = roles.map((role) => normalizeRole(role));
    if (!normalizedRoles.includes(normalizeRole(request.user.role))) return response.status(403).json({ message: 'You do not have permission to do that.' });
    next();
  };
}

function makeToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, ver: user.tokenVersion || 0 }, jwtSecret, { expiresIn: '7d' });
}

function serializeUser(user) {
  return { id: user.id, name: user.name, organization: user.organization, email: user.email, role: user.role };
}

function formatExpiry(date) {
  if (!date) return 'Check with donor';
  return new Intl.DateTimeFormat('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

function serializeDonation(donation, pickupCode) {
  const donorName = donation.donor?.organization || donation.donor?.name || 'FoodLoop partner';
  return {
    id: donation.id,
    name: donation.name,
    category: donation.category,
    description: donation.description,
    quantity: donation.quantity,
    servings: donation.servings,
    location: donation.location,
    image: donation.image,
    dietary: donation.dietary,
    expiresIn: formatExpiry(donation.expiresAt),
    expiresAt: donation.expiresAt,
    status: donation.status,
    donor: donorName,
    claimedBy: donation.claimedBy?.name,
    pickupCode,
    posted: donation.createdAt,
    distance: 'Nearby',
  };
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: databaseReady() ? 'connected' : 'disconnected' });
});

app.post('/api/auth/register', requireDatabase, async (request, response, next) => {
  try {
    const name = String(request.body?.name || '').trim();
    const organization = String(request.body?.organization || '').trim();
    const email = normalizeEmail(request.body?.email);
    const password = String(request.body?.password || '');
    const role = normalizeRole(request.body?.role);

    if (!name || !email || !password || password.length < 8) return response.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
    if (name.length > 80 || organization.length > 120 || password.length > 128 || !isRegistrationRole(role)) return response.status(400).json({ message: 'Choose a valid account type and use a valid name and password.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, organization: organization || name, email, passwordHash, role });
    response.status(201).json({ token: makeToken(user), user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'An account with that email already exists.' });
    next(error);
  }
});

app.post('/api/auth/login', requireDatabase, async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '');

  if (!email || !password || password.length > 128) return response.status(400).json({ message: 'Email and password are required.' });

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ message: 'Email or password is incorrect.' });
  response.json({ token: makeToken(user), user: serializeUser(user) });
});

app.post('/api/auth/logout', requireDatabase, authenticate, async (request, response, next) => {
  try {
    await User.updateOne({ _id: request.user.id }, { $inc: { tokenVersion: 1 } });
    response.json({ status: 'ok' });
  } catch (error) { next(error); }
});

app.post('/api/uploads', requireDatabase, authenticate, upload.single('image'), (request, response) => {
  if (!request.file) return response.status(400).json({ message: 'Choose an image to upload.' });
  response.status(201).json({ url: `/uploads/${request.file.filename}` });
});

app.get('/api/donations', async (request, response, next) => {
  if (!databaseReady()) return response.json({ donations: [] });
  try {
    const { category, search, status = 'available' } = request.query;
    const filter = { status, expiresAt: { $gt: new Date() } };
    if (category && category !== 'All food') filter.category = category;
    if (search) filter.$or = ['name', 'location', 'description'].map((key) => ({ [key]: { $regex: String(search), $options: 'i' } }));
    const donations = await Donation.find(filter).populate('donor', 'name organization').sort({ createdAt: -1 }).limit(100);
    response.json({ donations: donations.map((item) => serializeDonation(item)) });
  } catch (error) { next(error); }
});

app.get('/api/donations/mine', requireDatabase, authenticate, allowRoles('donor'), async (request, response, next) => {
  try {
    const donations = await Donation.find({ donor: request.user.id })
      .populate('donor', 'name organization')
      .populate('claimedBy', 'name organization')
      .sort({ createdAt: -1 })
      .limit(100);
    response.json({ donations: donations.map((item) => serializeDonation(item)) });
  } catch (error) { next(error); }
});

app.get('/api/donations/pickups', requireDatabase, authenticate, allowRoles('ngo', 'volunteer'), async (request, response, next) => {
  try {
    const donations = await Donation.find({
      claimedBy: request.user.id,
      status: { $in: ['claimed', 'collected'] },
    })
      .populate('donor', 'name organization')
      .populate('claimedBy', 'name organization')
      .sort({ claimedAt: -1 })
      .limit(100);
    response.json({ donations: donations.map((item) => serializeDonation(item)) });
  } catch (error) { next(error); }
});

app.post('/api/donations', requireDatabase, authenticate, allowRoles('donor', 'admin'), async (request, response, next) => {
  try {
    const { name, category, description, quantity, location, expiresAt, image, dietary } = request.body;
    const expiry = new Date(expiresAt);
    if (!name || !category || !quantity || !location || Number.isNaN(expiry.getTime()) || expiry <= new Date()) return response.status(400).json({ message: 'Provide food details, a pickup location, and a future expiry time.' });
    const donation = await Donation.create({ name, category, description, quantity, servings: Number.parseInt(quantity, 10) || 1, location, expiresAt: expiry, image, dietary, donor: request.user.id });
    await donation.populate('donor', 'name organization');
    response.status(201).json({ donation: serializeDonation(donation) });
  } catch (error) { next(error); }
});

app.patch('/api/donations/:id/claim', requireDatabase, authenticate, allowRoles('ngo', 'volunteer'), async (request, response, next) => {
  try {
    const donation = await Donation.findOneAndUpdate(
      { _id: request.params.id, status: 'available', expiresAt: { $gt: new Date() } },
      { $set: { status: 'claimed', claimedBy: request.user.id, claimedAt: new Date() } },
      { new: true },
    ).populate('donor', 'name organization').populate('claimedBy', 'name');
    if (!donation) return response.status(409).json({ message: 'This listing is no longer available.' });
    response.json({ donation: serializeDonation(donation) });
  } catch (error) { next(error); }
});

app.post('/api/donations/:id/pickup-code', requireDatabase, authenticate, allowRoles('donor'), async (request, response, next) => {
  try {
    const donation = await Donation.findOne({ _id: request.params.id, donor: request.user.id, status: 'claimed' });
    if (!donation) return response.status(404).json({ message: 'No active pickup was found for this listing.' });
    const pickupCode = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(pickupCode, 10);
    await PickupVerification.findOneAndUpdate(
      { donation: donation.id },
      { otpHash, expiresAt: donation.expiresAt, verifiedAt: null },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    response.json({ pickupCode });
  } catch (error) { next(error); }
});

app.patch('/api/donations/:id/verify-pickup', requireDatabase, authenticate, allowRoles('ngo', 'volunteer'), async (request, response, next) => {
  try {
    const donation = await Donation.findOne({ _id: request.params.id, claimedBy: request.user.id, status: 'claimed' });
    if (!donation) return response.status(404).json({ message: 'No active pickup was found for this account.' });
    const verification = await PickupVerification.findOne({ donation: donation.id, expiresAt: { $gt: new Date() }, verifiedAt: null });
    if (!verification || !(await bcrypt.compare(String(request.body.otp || ''), verification.otpHash))) return response.status(400).json({ message: 'The pickup code is invalid or expired.' });
    verification.verifiedAt = new Date();
    await verification.save();
    donation.status = 'collected';
    donation.collectedAt = new Date();
    await donation.save();
    response.json({ donation: { id: donation.id, status: donation.status, collectedAt: donation.collectedAt } });
  } catch (error) { next(error); }
});

app.post('/api/reports', requireDatabase, authenticate, async (request, response, next) => {
  try {
    const { donationId, reason, details } = request.body;
    if (!donationId || !['Unsafe food', 'Incorrect details', 'Suspicious listing', 'Other'].includes(reason)) return response.status(400).json({ message: 'Choose a report reason.' });
    const report = await Report.create({ donation: donationId, reporter: request.user.id, reason, details });
    response.status(201).json({ report: { id: report.id, status: report.status } });
  } catch (error) { next(error); }
});

app.get('/api/community/stats', requireDatabase, async (_request, response, next) => {
  try {
    const [totals, partners] = await Promise.all([
      Donation.aggregate([
        { $match: { status: 'collected' } },
        { $group: { _id: null, mealsRedirected: { $sum: '$servings' }, completedPickups: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: { $in: ['donor', 'ngo', 'volunteer'] } }),
    ]);
    response.json({
      mealsRedirected: totals[0]?.mealsRedirected || 0,
      completedPickups: totals[0]?.completedPickups || 0,
      partners,
    });
  } catch (error) { next(error); }
});

app.get('/api/admin/stats', requireDatabase, authenticate, allowRoles('admin'), async (_request, response) => {
  const [users, donors, ngos, available, claimed, collected, reports] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'donor' }), User.countDocuments({ role: 'ngo' }),
    Donation.countDocuments({ status: 'available' }), Donation.countDocuments({ status: 'claimed' }),
    Donation.countDocuments({ status: 'collected' }), Report.countDocuments({ status: 'open' }),
  ]);
  response.json({ users, donors, ngos, available, claimed, collected, openReports: reports });
});

app.get('/api/admin/users', requireDatabase, authenticate, allowRoles('admin'), async (_request, response) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(200);
  response.json({ users: users.map(serializeUser) });
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) return response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : error.message });
  if (error.message?.startsWith('Upload a ')) return response.status(400).json({ message: error.message });
  console.error(error);
  response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected');
      return;
    } catch (error) {
      if (isProduction) throw new Error('MongoDB connection failed. Check MONGODB_URI and database network access.');
      console.warn(`MongoDB connection failed: ${error.message}. Falling back to in-memory database for local development.`);
    }
  }

  if (isProduction) throw new Error('MONGODB_URI is required in production; refusing to start with temporary storage.');

  mongoMemoryServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoMemoryServer.getUri());
  console.log('MongoDB connected to in-memory database for local development');
}

async function seedDatabase() {
  const donorEmail = 'donor@foodloop.org';
  const volunteerEmail = 'volunteer@foodloop.org';
  const adminEmail = 'admin@foodloop.org';

  const [donor, volunteer, admin] = await Promise.all([
    User.findOne({ email: donorEmail }),
    User.findOne({ email: volunteerEmail }),
    User.findOne({ email: adminEmail }),
  ]);

  if (!donor) {
    await User.create({
      name: 'Asha Patel',
      organization: 'Amma Kitchen',
      email: donorEmail,
      passwordHash: await bcrypt.hash('password123', 12),
      role: 'donor',
    });
  }

  if (!volunteer) {
    await User.create({
      name: 'Leah Kim',
      organization: 'Community Table',
      email: volunteerEmail,
      passwordHash: await bcrypt.hash('password123', 12),
      role: 'volunteer',
    });
  }

  if (!admin) {
    await User.create({
      name: 'FoodLoop Admin',
      organization: 'FoodLoop',
      email: adminEmail,
      passwordHash: await bcrypt.hash('password123', 12),
      role: 'admin',
    });
  }

  const donationCount = await Donation.countDocuments();
  if (donationCount > 0) return;

  const seededDonor = await User.findOne({ email: donorEmail });
  const seededVolunteer = await User.findOne({ email: volunteerEmail });
  const now = new Date();

  await Donation.insertMany([
    {
      name: 'Warm bowls, warm hearts',
      category: 'Prepared meals',
      description: 'Fresh lentil stew, rice, and seasonal vegetables prepared for pickup.',
      quantity: '12 meals',
      servings: 12,
      location: 'The Community Table',
      image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80',
      dietary: 'Vegetarian',
      expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      status: 'claimed',
      donor: seededDonor._id,
      claimedBy: seededVolunteer._id,
      claimedAt: now,
      collectedAt: null,
    },
    {
      name: 'Farm-fresh produce box',
      category: 'Produce',
      description: 'A mix of greens, tomatoes, and citrus from the morning harvest.',
      quantity: '8 boxes',
      servings: 8,
      location: 'Green Loop Market',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=960&q=80',
      dietary: 'Seasonal',
      expiresAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
      status: 'available',
      donor: seededDonor._id,
      claimedBy: null,
      claimedAt: null,
      collectedAt: null,
    },
    {
      name: 'Fresh bakery bundle',
      category: 'Bakery',
      description: 'Freshly baked breads and pastries ready for a community handoff.',
      quantity: '18 items',
      servings: 18,
      location: 'RT Nagar',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=960&q=80',
      dietary: 'Contains gluten',
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      status: 'available',
      donor: seededDonor._id,
      claimedBy: null,
      claimedAt: null,
      collectedAt: null,
    },
  ]);
}

await mkdir(uploadsDirectory, { recursive: true });

try {
  await connectDatabase();
  if (!isProduction) await seedDatabase();
} catch (error) {
  console.error(`Database setup failed: ${error.message}`);
  process.exit(1);
}

app.listen(port, () => console.log(`FoodLoop API listening on http://localhost:${port}`));