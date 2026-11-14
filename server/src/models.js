import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  organization: { type: String, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['donor', 'ngo', 'volunteer', 'admin'], default: 'ngo' },
}, { timestamps: true });

const donationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, enum: ['Prepared meals', 'Produce', 'Bakery', 'Dairy', 'Other'] },
  description: { type: String, trim: true, maxlength: 1000 },
  quantity: { type: String, required: true, trim: true, maxlength: 60 },
  servings: { type: Number, min: 1, default: 1 },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  image: { type: String, default: '' },
  dietary: { type: String, trim: true, maxlength: 80 },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['available', 'claimed', 'collected', 'expired'], default: 'available', index: true },
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },
  collectedAt: { type: Date, default: null },
}, { timestamps: true });

const pickupVerificationSchema = new mongoose.Schema({
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, unique: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, enum: ['Unsafe food', 'Incorrect details', 'Suspicious listing', 'Other'] },
  details: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open' },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Donation = mongoose.model('Donation', donationSchema);
export const PickupVerification = mongoose.model('PickupVerification', pickupVerificationSchema);
export const Report = mongoose.model('Report', reportSchema);