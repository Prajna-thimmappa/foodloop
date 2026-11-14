import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Donation, PickupVerification, Report, User } from './models.js';
import { VALID_ROLES, isValidRole } from './roles.js';

const app = express();
const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-me';
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(currentDirectory, '../uploads');

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDirectory));

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
    if (!request.user) return response.status(401).json({ message: 'Your account could not be found.' });
    next();
  } catch {
    response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

function allowRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) return response.status(403).json({ message: 'You do not have permission to do that.' });
    next();
  };
}

function makeToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
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
    const { name, organization, email, password, role } = request.body;
    if (!name || !email || !password || password.length < 8) return response.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
    if (!isValidRole(role)) return response.status(400).json({ message: 'Choose a valid account type.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, organization, email, passwordHash, role });
    response.status(201).json({ token: makeToken(user), user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'An account with that email already exists.' });
    next(error);
  }
});

app.post('/api/auth/login', requireDatabase, async (request, response) => {
  const { email, password } = request.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return response.status(401).json({ message: 'Email or password is incorrect.' });
  response.json({ token: makeToken(user), user: serializeUser(user) });
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
    const pickupCode = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(pickupCode, 10);
    await PickupVerification.findOneAndUpdate(
      { donation: donation.id },
      { otpHash, expiresAt: donation.expiresAt, verifiedAt: null },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    response.json({ donation: serializeDonation(donation, pickupCode) });
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

await mkdir(uploadsDirectory, { recursive: true });

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error(`MongoDB connection failed: ${error.message}`));
}

app.listen(port, () => console.log(`FoodLoop API listening on http://localhost:${port}`));