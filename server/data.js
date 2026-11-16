export const user = {
  id: 'guest-user',
  name: 'Guest',
  role: 'ngo',
  organization: 'Community partner',
  email: 'guest@foodloop.org',
  city: 'Bengaluru',
  streak: 4,
  mealsShared: 128,
  impactThisMonth: 0,
  notifications: 3,
};

export const donations = [
  {
    id: 'don-1',
    name: 'Warm bowls, warm hearts',
    donor: 'Amma Kitchen',
    quantity: '12 meals',
    servings: 12,
    category: 'Prepared meals',
    location: 'The Community Table',
    expiresIn: 'Today · 6:30 PM',
    distance: '2.1 km',
    status: 'claimed',
    claimedBy: 'Guest',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80',
    description: 'Fresh lentil stew, rice, and seasonal vegetables prepared for pickup.',
    pickupCode: '728154',
  },
  {
    id: 'don-2',
    name: 'Farm-fresh produce box',
    donor: 'Banjara Collective',
    quantity: '8 boxes',
    servings: 8,
    category: 'Produce',
    location: 'Green Loop Market',
    expiresIn: 'Tomorrow · 9:00 AM',
    distance: '1.4 km',
    status: 'available',
    claimedBy: null,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=960&q=80',
    description: 'A mix of greens, tomatoes, and citrus from the morning harvest.',
  },
  {
    id: 'don-3',
    name: 'Fresh bakery bundle',
    donor: 'Sunrise Bakery',
    quantity: '18 items',
    servings: 18,
    category: 'Bakery',
    location: 'RT Nagar',
    expiresIn: 'Today · 5:00 PM',
    distance: '3.2 km',
    status: 'available',
    claimedBy: null,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=960&q=80',
    description: 'Freshly baked breads and pastries ready for a community handoff.',
  },
];

export const reports = [
  { id: 'report-1', donationId: 'don-1', reason: 'Late pickup', status: 'open' },
];

export const impactSummary = {
  redirectedMeals: 0,
  availableListings: donations.filter((item) => item.status === 'available').length,
  activePartners: 36,
  monthlyGoal: 120,
  monthlyProgress: 12.8,
};

export default { user, donations, reports, impactSummary };
