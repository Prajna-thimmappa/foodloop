import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Bell,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Filter,
  HeartHandshake,
  Leaf,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Sprout,
  Utensils,
  UsersRound,
  X,
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'marketplace', label: 'Find food', icon: Search },
  { id: 'pickups', label: 'My pickups', icon: PackageCheck },
  { id: 'my-listings', label: 'My listings', icon: Utensils },
  { id: 'impact', label: 'Our impact', icon: Sprout },
];

const categories = ['All food', 'Prepared meals', 'Produce', 'Bakery'];

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [donations, setDonations] = useState([]);
  const [activePage, setActivePage] = useState('overview');
  const [category, setCategory] = useState('All food');
  const [search, setSearch] = useState('');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [sortBy, setSortBy] = useState('Recommended');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState(() => readStorage('foodloop-user', null));
  const currentUser = user ?? { name: 'Guest', role: 'ngo', organization: 'Community partner' };
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (user) localStorage.setItem('foodloop-user', JSON.stringify(user));
    else localStorage.removeItem('foodloop-user');
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('foodloop-token');
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else setModal({ type: 'auth' });
  }, []);

  useEffect(() => {
    let active = true;
    axios.get('/api/donations', { timeout: 2500 })
      .then(({ data }) => {
        if (active && Array.isArray(data.donations) && data.donations.length) setDonations(data.donations);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const availableDonations = useMemo(() => donations.filter((item) => item.status === 'available'), [donations]);
  const filteredDonations = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return availableDonations.filter((item) => {
      const matchesCategory = category === 'All food' || item.category === category;
      const matchesSearch = !query || [item.name, item.donor, item.location, item.category].some((value) => value?.toLowerCase().includes(query));
      const matchesDistance = !nearbyOnly || Number.parseFloat(item.distance) <= 3;
      return matchesCategory && matchesSearch && matchesDistance;
    }).sort((left, right) => {
      if (sortBy === 'Nearest first') return Number.parseFloat(left.distance || '99') - Number.parseFloat(right.distance || '99');
      if (sortBy === 'Most servings') return Number(right.servings || 0) - Number(left.servings || 0);
      return 0;
    });
  }, [availableDonations, category, deferredSearch, nearbyOnly, sortBy]);
  const myPickups = user ? donations.filter((item) => item.claimedBy === user.name && ['claimed', 'collected'].includes(item.status)) : [];
  const myListings = user ? donations.filter((item) => item.donor === user.organization) : [];
  const mealCount = donations.filter((item) => item.status === 'collected').reduce((total, item) => total + Number(item.servings || 0), 0);

  function navigate(page) {
    setActivePage(page);
    setMobileNavOpen(false);
  }

  function announce(message) {
    setToast(message);
  }

  async function claimDonation(donation) {
    try {
      const { data } = await axios.patch(`/api/donations/${donation.id}/claim`, {}, { timeout: 2500 });
      const claimedDonation = { ...donation, ...data.donation };
      setDonations((current) => current.map((item) => item.id === donation.id ? claimedDonation : item));
      setModal({ type: 'claimed', donation: claimedDonation });
      announce('Pickup claimed successfully.');
    } catch (error) {
      announce(error.response?.data?.message || 'This listing could not be claimed right now.');
    }
  }

  async function verifyPickup(donation, code) {
    if (donation.pickupCode && code !== donation.pickupCode) {
      announce('That code does not match. Check with the donor and try again.');
      return false;
    }
    try {
      await axios.patch(`/api/donations/${donation.id}/verify-pickup`, { otp: code }, { timeout: 2500 });
    } catch (error) {
      announce(error.response?.data?.message || 'Pickup verification failed.');
      return false;
    }
    setDonations((current) => current.map((item) => item.id === donation.id ? { ...item, status: 'collected' } : item));
    setModal(null);
    announce('Pickup confirmed. Thank you for showing up.');
    return true;
  }

  async function addDonation(formData) {
    const { photo, ...listingValues } = formData;
    try {
      let image = listingValues.image || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';
      if (photo) {
        const uploadData = new FormData();
        uploadData.append('image', photo);
        const uploadResponse = await axios.post('/api/uploads', uploadData, { timeout: 8000 });
        image = uploadResponse.data.url;
      }
      const { data } = await axios.post('/api/donations', { ...listingValues, expiresAt: new Date(listingValues.expiresIn).toISOString(), image }, { timeout: 4000 });
      setDonations((current) => [data.donation, ...current]);
      setModal(null);
      navigate('marketplace');
      announce('Your food listing is now live.');
    } catch (error) {
      announce(error.response?.data?.message || 'Please sign in as a donor to publish this listing.');
    }
  }

  async function authenticate(formData) {
    try {
      const endpoint = formData.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const { data } = await axios.post(endpoint, formData, { timeout: 2500 });
      if (data.token) {
        localStorage.setItem('foodloop-token', data.token);
        axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      }
      setUser({ name: data.user.name, role: data.user.role, organization: data.user.organization || data.user.name });
      setModal(null);
    } catch (error) {
      announce(error.response?.data?.message || 'Sign in failed.');
    }
  }

  async function submitReport(reportData) {
    try {
      await axios.post('/api/reports', reportData, { timeout: 2500 });
      announce('Thanks for helping keep FoodLoop safe.');
    } catch (error) {
      announce(error.response?.data?.message || 'The report could not be sent.');
    }
    setModal(null);
  }

  const pageTitle = {
    overview: 'A little good goes a long way.',
    marketplace: 'Good food, close by.',
    pickups: 'Your pickups',
    impact: 'Small actions. Lasting impact.',
    admin: 'Platform overview',
  }[activePage] || 'Good food, close by.';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="FoodLoop home">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.5} /></span>
          <span>foodloop<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="org-switcher">
          <span className="org-avatar"><HeartHandshake size={17} /></span>
          <span className="org-copy"><strong>{currentUser.organization}</strong><small>{currentUser.role === 'donor' ? 'Food donor' : currentUser.role === 'volunteer' ? 'Volunteer' : currentUser.role === 'admin' ? 'Administrator' : 'Community partner'}</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-label">MENU</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button key={id} className={`nav-link ${activePage === id ? 'nav-active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {count && <span className="nav-count">{count}</span>}
            </button>
          ))}
          {currentUser.role === 'admin' && <button className={`nav-link ${activePage === 'admin' ? 'nav-active' : ''}`} onClick={() => navigate('admin')}><ShieldAlert size={18} /><span>Admin</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="impact-note">
            <div className="impact-note-icon"><Sparkles size={16} /></div>
            <p><strong>Good things add up.</strong><br />Your community has shared <b>{mealCount.toLocaleString()} meals</b> this month.</p>
            <button onClick={() => navigate('impact')}>See your impact <ArrowRight size={14} /></button>
          </div>
          <button className="profile-row" onClick={() => setModal({ type: 'auth' })}>
            <span className="profile-avatar">{currentUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <span className="profile-copy"><strong>{currentUser.name}</strong><small>Manage profile</small></span>
            <ChevronDown size={15} className="muted-icon" />
          </button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>FoodLoop</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === activePage)?.label || (activePage === 'admin' ? 'Admin' : 'Overview')}</strong></div>
          <div className="topbar-actions">
            <div className="location-pill"><MapPin size={15} /><span>Bengaluru</span><ChevronDown size={13} /></div>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => announce('You’re all caught up.') }><Bell size={18} /><i /></button>
            <button className="offer-button" aria-label="Offer food" onClick={() => setModal({ type: 'donation' })}><Plus size={17} /><span>Offer food</span></button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> COMMUNITY BOARD <span className="eyebrow-divider">/</span> THURSDAY, MAY 22</div>
              <h1>{pageTitle}</h1>
              <p className="welcome-subtitle">{activePage === 'marketplace' ? 'Rescue something delicious from a neighbor today.' : `Good afternoon, ${currentUser.name.split(' ')[0] || 'neighbor'}. Here’s what’s happening around you.`}</p>
            </div>
            <div className="streak-pill"><span className="streak-icon">✳</span><span><strong>4 day streak</strong><small>Kindness looks good on you</small></span></div>
          </section>

          {activePage === 'overview' && <Overview
            availableDonations={availableDonations}
            filteredDonations={filteredDonations}
            mealCount={mealCount}
            navigate={navigate}
            setModal={setModal}
            claimDonation={claimDonation}
            setCategory={setCategory}
            category={category}
          />}
          {activePage === 'marketplace' && <Marketplace
            donations={filteredDonations}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            nearbyOnly={nearbyOnly}
            setNearbyOnly={setNearbyOnly}
            sortBy={sortBy}
            setSortBy={setSortBy}
            claimDonation={claimDonation}
            setModal={setModal}
          />}
          {activePage === 'pickups' && <Pickups donations={myPickups} navigate={navigate} verifyPickup={(donation) => setModal({ type: 'verify', donation })} />}
          {activePage === 'my-listings' && <MyListings donations={myListings} user={currentUser} setModal={setModal} />}
          {activePage === 'impact' && <Impact mealCount={mealCount} donations={donations} />}
          {activePage === 'admin' && <Admin donations={donations} users={currentUser} />}
        </div>
      </main>

      {modal?.type === 'donation' && <DonationModal onClose={() => setModal(null)} onSubmit={addDonation} />}
      {modal?.type === 'verify' && <VerifyModal donation={modal.donation} onClose={() => setModal(null)} onSubmit={verifyPickup} />}
      {modal?.type === 'claimed' && <ClaimedModal donation={modal.donation} onClose={() => { setModal(null); navigate('pickups'); }} />}
      {modal?.type === 'auth' && <AuthModal user={user || { role: 'ngo' }} onClose={() => setModal(null)} onSubmit={authenticate} />}
      {modal?.type === 'details' && <DetailsModal donation={modal.donation} onClose={() => setModal(null)} onClaim={() => claimDonation(modal.donation)} onReport={() => setModal({ type: 'report', donation: modal.donation })} />}
      {modal?.type === 'report' && <ReportModal donation={modal.donation} onClose={() => setModal(null)} onSubmit={submitReport} />}
      {modal?.type === 'invite' && <InviteModal onClose={() => setModal(null)} onSubmit={() => { setModal(null); announce('Invitation link copied. Share it with a neighborhood partner.'); }} />}
      {modal?.type === 'donor-code' && <DonorCodeModal donation={modal.donation} onClose={() => setModal(null)} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function Overview({ availableDonations, filteredDonations, mealCount, navigate, setModal, claimDonation, setCategory, category }) {
  return (
    <>
      <section className="metrics-grid">
        <article className="metric-card metric-primary"><div className="metric-top"><span>MEALS REDIRECTED</span><span className="metric-icon"><Utensils size={16} /></span></div><div className="metric-value">{mealCount.toLocaleString()}<span className="metric-unit"> meals</span></div><div className="metric-foot"><span className="trend-up"><ArrowDownRight size={14} /> 12.8%</span><span>vs. last month</span><div className="sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div></article>
        <article className="metric-card"><div className="metric-top"><span>AVAILABLE NEAR YOU</span><span className="metric-icon metric-icon-orange"><PackageCheck size={16} /></span></div><div className="metric-value">{availableDonations.length}<span className="metric-unit"> listings</span></div><div className="metric-foot"><span className="metric-caption"><span className="tiny-dot" /> Updated just now</span><button className="text-action" onClick={() => navigate('marketplace')}>Browse <ArrowRight size={14} /></button></div></article>
        <article className="metric-card"><div className="metric-top"><span>COMMUNITY PARTNERS</span><span className="metric-icon metric-icon-blue"><UsersRound size={16} /></span></div><div className="metric-value">36<span className="metric-unit"> active</span></div><div className="metric-foot"><span className="partner-stack"><i>J</i><i>G</i><i>N</i><b>+33</b></span><span className="metric-caption">making it happen</span></div></article>
      </section>

      <section className="content-grid">
        <div className="listings-panel">
          <div className="section-heading"><div><div className="section-kicker">FRESH FROM YOUR NEIGHBORHOOD</div><h2>Food worth finding</h2></div><button className="text-action" onClick={() => navigate('marketplace')}>See all <ArrowRight size={15} /></button></div>
          <div className="category-row compact-categories">{categories.map((item) => <button key={item} className={`category-chip ${category === item ? 'chip-active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="food-grid overview-food-grid">{filteredDonations.slice(0, 3).map((donation) => <FoodCard key={donation.id} donation={donation} onClaim={claimDonation} onDetails={() => setModal({ type: 'details', donation })} />)}</div>
          {filteredDonations.length === 0 && <EmptyState title="Nothing on the table yet" text="Try another category or check back soon." />}
        </div>
        <aside className="right-rail">
          <div className="pickup-panel"><div className="rail-heading"><div><div className="section-kicker">YOUR NEXT GOOD DEED</div><h3>Coming up</h3></div><button className="more-button" aria-label="See pickups" onClick={() => navigate('pickups')}><ArrowRight size={17} /></button></div><div className="pickup-feature-image"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80" alt="Fresh lentil stew prepared for pickup" /><span className="pickup-image-badge"><Clock3 size={12} /> TODAY · 6:30 PM</span></div><div className="pickup-feature-body"><div className="pickup-feature-title"><h4>Warm bowls, warm hearts</h4><span className="status-badge status-claimed">Confirmed</span></div><p><MapPin size={14} /> The Community Table · 2.1 km</p><div className="pickup-divider" /><div className="pickup-meta"><span><Utensils size={14} /> 12 meal boxes</span><span><Bike size={14} /> Walk · 18 min</span></div><button className="outline-action" onClick={() => navigate('pickups')}>View pickup details <ArrowRight size={15} /></button></div></div>
          <div className="community-banner"><div className="community-icon"><HeartHandshake size={19} /></div><div><strong>Pass it around</strong><p>Invite a local kitchen to join your neighborhood loop.</p><button onClick={() => setModal({ type: 'invite' })}>Invite a partner <ArrowRight size={14} /></button></div><span className="banner-sparkle">✳</span></div>
        </aside>
      </section>
    </>
  );
}

function Marketplace({ donations, category, setCategory, search, setSearch, nearbyOnly, setNearbyOnly, sortBy, setSortBy, claimDonation, setModal }) {
  return (
    <section className="marketplace-page">
      <div className="marketplace-controls"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food, kitchens, or area" /><kbd>⌘ K</kbd></label><button className={`filter-button ${nearbyOnly ? 'filter-on' : ''}`} onClick={() => setNearbyOnly(!nearbyOnly)}><Filter size={16} /> Within 3 km <span className="filter-toggle"><i /></span></button><label className="sort-button">Sort:<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings"><option>Recommended</option><option>Nearest first</option><option>Most servings</option></select><ChevronDown size={15} /></label></div>
      <div className="marketplace-subrow"><div className="category-row">{categories.map((item) => <button key={item} className={`category-chip ${category === item ? 'chip-active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div><span className="result-count">{donations.length} good things nearby</span></div>
      <div className="food-grid marketplace-food-grid">{donations.map((donation) => <FoodCard key={donation.id} donation={donation} onClaim={claimDonation} onDetails={() => setModal({ type: 'details', donation })} />)}</div>
      {donations.length === 0 && <EmptyState title="No matches just yet" text="Try widening your search or clearing the nearby filter." />}
    </section>
  );
}

function FoodCard({ donation, onClaim, onDetails }) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="food-card">
      <div className="food-image-button" role="button" tabIndex={0} onClick={onDetails} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDetails(); }} aria-label={`View ${donation.name}`}><img className="food-image" src={donation.image || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80'} alt={donation.name} /><span className="image-category">{donation.category}</span><button className={`save-button ${saved ? 'saved' : ''}`} onClick={(event) => { event.stopPropagation(); setSaved(!saved); }} aria-label={saved ? 'Remove saved food' : 'Save food'}>{saved ? <Check size={16} /> : <HeartHandshake size={16} />}</button></div>
      <div className="food-card-content"><div className="food-donor"><span className="donor-monogram">{donation.donor?.[0] || 'F'}</span><span>{donation.donor || 'FoodLoop partner'}</span><BadgeCheck size={14} className="verified-icon" /></div><button className="food-title-button" onClick={onDetails}><h3>{donation.name}</h3></button><div className="food-card-info"><span><Utensils size={14} />{donation.quantity}</span><span><MapPin size={14} />{donation.distance || 'Nearby'}</span></div><div className="food-card-bottom"><span className="expiry-label"><Clock3 size={13} /> Pickup by {donation.expiresIn || 'Today'}</span><button className="claim-button" onClick={() => onClaim(donation)}>Claim <ArrowRight size={14} /></button></div></div>
    </article>
  );
}

function Pickups({ donations, navigate, verifyPickup }) {
  return <section className="simple-page"><div className="section-heading"><div><div className="section-kicker">THE LAST MILE MATTERS</div><h2>Pickups in your care</h2></div><span className="result-count">{donations.length} total</span></div>{donations.length ? <div className="pickup-list">{donations.map((item) => <article className="pickup-row" key={item.id}><img src={item.image} alt="" /><div className="pickup-row-main"><span className={`status-badge ${item.status === 'collected' ? 'status-collected' : 'status-claimed'}`}>{item.status === 'collected' ? 'Collected' : 'Ready for pickup'}</span><h3>{item.name}</h3><p>{item.donor} <span>·</span> {item.quantity}</p><small><MapPin size={13} /> {item.location}</small></div><div className="pickup-row-side"><span><Clock3 size={14} /> {item.expiresIn}</span>{item.status !== 'collected' && <button className="claim-button" onClick={() => verifyPickup(item)}>Verify pickup <ArrowRight size={14} /></button>}</div></article>)}</div> : <EmptyState title="Your next pickup starts here" text="Find a nearby listing and claim food for your community." action="Browse available food" onAction={() => navigate('marketplace')} />}</section>;
}

function MyListings({ donations, user, setModal }) {
  if (user.role !== 'donor') return <EmptyState title="Donor workspace" text="Register as a food donor to manage your kitchen’s listings and pickup handoffs." />;
  return <section className="simple-page"><div className="section-heading"><div><div className="section-kicker">YOUR KITCHEN’S CONTRIBUTION</div><h2>My food listings</h2></div><span className="result-count">{donations.length} total</span></div>{donations.length ? <div className="pickup-list">{donations.map((item) => <article className="pickup-row" key={item.id}><img src={item.image} alt="" /><div className="pickup-row-main"><span className={`status-badge ${item.status === 'available' ? 'status-available' : item.status === 'collected' ? 'status-collected' : 'status-claimed'}`}>{item.status}</span><h3>{item.name}</h3><p>{item.quantity} <span>·</span> Pickup by {item.expiresIn}</p>{item.claimedBy && <small><HeartHandshake size={13} /> Claimed by {item.claimedBy}</small>}</div><div className="pickup-row-side">{item.status === 'claimed' && <button className="claim-button" onClick={() => setModal({ type: 'donor-code', donation: item })}>Share pickup code <ArrowRight size={14} /></button>}</div></article>)}</div> : <EmptyState title="Your first listing starts here" text="Post surplus food and connect with nearby community partners." />}</section>;
}

function Impact({ mealCount, donations }) {
  const collected = donations.filter((item) => item.status === 'collected').length;
  return <section className="impact-page"><div className="impact-hero"><div className="impact-hero-copy"><span className="impact-hero-mark"><Sprout size={19} /> YOUR NEIGHBORHOOD IN MOTION</span><h2>Good food is too good to waste.</h2><p>Every pickup keeps nourishing food in the community and out of the bin. Here’s the good your local loop is doing.</p></div><div className="impact-hero-number"><strong>{mealCount.toLocaleString()}</strong><span>meals redirected<br />and counting</span></div></div><div className="impact-stat-grid"><article><span className="impact-stat-icon green"><Utensils size={18} /></span><strong>{mealCount.toLocaleString()}</strong><span>meals shared</span><small>That’s a lot of full plates.</small></article><article><span className="impact-stat-icon orange"><PackageCheck size={18} /></span><strong>{collected}</strong><span>successful pickups</span><small>Neighbors showing up.</small></article><article><span className="impact-stat-icon blue"><UsersRound size={18} /></span><strong>{Math.max(1, donations.length)}</strong><span>active listings</span><small>Good things take a team.</small></article></div><div className="impact-footnote"><Leaf size={17} /><p>FoodLoop estimates that each meal redirected avoids approximately <strong>0.5 kg of food waste</strong>. Your community’s impact is real, one pickup at a time.</p></div></section>;
}

function Admin({ donations, users }) {
  const [stats, setStats] = useState({ users: 0, donors: 0, ngos: 0, available: 0, claimed: 0, collected: 0, openReports: 0 });

  useEffect(() => {
    if (users.role !== 'admin') return;
    axios.get('/api/admin/stats', { timeout: 2500 })
      .then(({ data }) => setStats(data))
      .catch(() => setStats({ users: 0, donors: 0, ngos: 0, available: 0, claimed: 0, collected: 0, openReports: 0 }));
  }, [users.role]);

  if (users.role !== 'admin') return <EmptyState title="Admin access required" text="Switch to an administrator account to view platform reports." />;
  const claimed = donations.filter((item) => item.status === 'claimed').length;
  return <section className="simple-page"><div className="section-heading"><div><div className="section-kicker">PLATFORM HEALTH</div><h2>Keeping the loop healthy</h2></div></div><div className="admin-stats"><article><span>Total members</span><strong>{stats.users || 0}</strong><small>{stats.donors || 0} donors · {stats.ngos || 0} NGOs</small></article><article><span>Active listings</span><strong>{stats.available || donations.filter((item) => item.status === 'available').length}</strong><small>Live food posted today</small></article><article><span>Awaiting pickup</span><strong>{stats.claimed || claimed}</strong><small>Keep an eye on these</small></article><article><span>Meals redirected</span><strong>{stats.collected || donations.filter((item) => item.status === 'collected').reduce((total, item) => total + Number(item.servings || 0), 0)}</strong><small>From confirmed pickups</small></article></div><div className="admin-table-wrap"><div className="table-heading"><h3>Recent listings</h3><span>Live moderation queue</span></div><table><thead><tr><th>LISTING</th><th>DONOR</th><th>STATUS</th><th>QUANTITY</th></tr></thead><tbody>{donations.slice(0, 5).map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.donor}</td><td><span className={`status-badge ${item.status === 'available' ? 'status-available' : 'status-claimed'}`}>{item.status}</span></td><td>{item.quantity}</td></tr>)}</tbody></table></div></section>;
}

function EmptyState({ title, text, action, onAction }) {
  return <div className="empty-state"><span><Sprout size={21} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="text-action" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>;
}

function DonationModal({ onClose, onSubmit }) {
  const [preview, setPreview] = useState('');
  const [values, setValues] = useState({ name: '', quantity: '', category: 'Prepared meals', location: '', expiresIn: '', description: '', dietary: 'No preference' });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }
  function submit(event) {
    event.preventDefault();
    onSubmit({ ...values, photo: event.currentTarget.elements.photo.files[0] || null, image: preview || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80' });
  }
  return <Modal title="Give good food another home" subtitle="A few details help the right neighbor find your donation." onClose={onClose}><form className="modal-form" onSubmit={submit}><label className={`upload-field ${preview ? 'has-preview' : ''}`}>{preview ? <img src={preview} alt="Donation preview" /> : <span className="upload-placeholder"><Plus size={20} /><strong>Add a food photo</strong><small>A clear photo helps partners decide</small></span>}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /></label><div className="form-grid"><label>Food name<input name="name" value={values.name} onChange={update} placeholder="e.g. Vegetable rice bowls" required /></label><label>Quantity<input name="quantity" value={values.quantity} onChange={update} placeholder="e.g. 12 meals" required /></label><label>Category<select name="category" value={values.category} onChange={update}><option>Prepared meals</option><option>Produce</option><option>Bakery</option><option>Dairy</option></select></label><label>Pickup location<input name="location" value={values.location} onChange={update} placeholder="Area or street address" required /></label><label>Pickup by<input type="datetime-local" name="expiresIn" value={values.expiresIn} onChange={update} required /></label><label>Dietary info<select name="dietary" value={values.dietary} onChange={update}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Contains gluten</option><option>Contains dairy</option></select></label></div><label>Description<textarea name="description" value={values.description} onChange={update} placeholder="What should a community partner know?" rows="3" /></label><div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="offer-button"><Plus size={16} /> Publish listing</button></div></form></Modal>;
}

function VerifyModal({ donation, onClose, onSubmit }) {
  const [code, setCode] = useState('');
  return <Modal title="Confirm this pickup" subtitle={`${donation.name} · ${donation.donor}`} onClose={onClose}><form className="verify-form" onSubmit={(event) => { event.preventDefault(); onSubmit(donation, code); }}><div className="otp-illustration"><PackageCheck size={27} /></div><p>Ask the donor for their 6-digit handoff code to confirm the food has been collected.</p>{donation.pickupCode && <div className="demo-code-note"><span>PICKUP CODE</span><strong>{donation.pickupCode}</strong></div>}<input className="otp-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="······" aria-label="6 digit pickup code" required minLength="6" maxLength="6" /><button className="offer-button verify-submit" disabled={code.length !== 6}><CheckCircle2 size={17} /> Confirm collection</button></form></Modal>;
}

function ClaimedModal({ donation, onClose }) {
  return <Modal title="You’ve got it." subtitle="One less meal wasted, one more person nourished." onClose={onClose}><div className="claim-confirmation"><span className="success-check"><Check size={25} /></span><div className="claimed-summary"><img src={donation.image} alt="" /><div><strong>{donation.name}</strong><span>{donation.quantity} · {donation.donor}</span></div></div><div className="pickup-instructions"><span><MapPin size={16} /> PICKUP AT</span><strong>{donation.location}</strong><span><CalendarDays size={16} /> BEFORE {donation.expiresIn?.toUpperCase()}</span></div>{donation.pickupCode && <div className="demo-code-note"><span>PICKUP CODE</span><strong>{donation.pickupCode}</strong></div>}<button className="offer-button full-button" onClick={onClose}>View pickup details <ArrowRight size={16} /></button></div></Modal>;
}

function DonorCodeModal({ donation, onClose }) {
  const [pickupCode, setPickupCode] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    axios.post(`/api/donations/${donation.id}/pickup-code`, {}, { timeout: 3000 })
      .then(({ data }) => { if (active) setPickupCode(data.pickupCode); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load a pickup code.'); });
    return () => { active = false; };
  }, [donation]);
  return <Modal title="Pickup handoff code" subtitle={`${donation.name} · claimed by ${donation.claimedBy || 'your community partner'}`} onClose={onClose}><div className="verify-form"><div className="otp-illustration"><ShieldAlert size={25} /></div><p>Share this code with the collector at the food handoff. It confirms the pickup is complete.</p>{error ? <p className="error-message">{error}</p> : <div className="donor-pickup-code">{pickupCode || '------'}</div>}<button className="offer-button verify-submit" disabled={!pickupCode} onClick={() => { navigator.clipboard?.writeText(pickupCode); onClose(); }}>Copy code <Check size={16} /></button></div></Modal>;
}

function AuthModal({ user, onClose, onSubmit }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState(user?.role || 'ngo');
  function submit(event) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    formData.mode = mode;
    formData.role = role;
    onSubmit(formData);
  }
  return <Modal title={mode === 'login' ? 'Welcome back' : 'Join the neighborhood'} subtitle="Be part of a kinder, less wasteful food system." onClose={onClose}><form className="modal-form auth-form" onSubmit={submit}>{mode === 'register' && <><label>Your name<input name="name" placeholder="Name" required /></label><label>Organization<input name="organization" placeholder="Kitchen, NGO, or community group" /></label><div className="role-picker"><span>I’m here as a</span>{[['ngo', 'NGO'], ['volunteer', 'Volunteer'], ['donor', 'Food donor']].map(([value, label]) => <button type="button" key={value} className={role === value ? 'role-selected' : ''} onClick={() => setRole(value)}>{label}</button>)}</div></>}<label>Email address<input name="email" type="email" placeholder="you@example.org" required /></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength="8" required /></label><button type="submit" className="offer-button full-button">{mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={16} /></button><p className="auth-switch">{mode === 'login' ? 'New to FoodLoop?' : 'Already part of the loop?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Log in'}</button></p></form></Modal>;
}

function DetailsModal({ donation, onClose, onClaim, onReport }) {
  return <Modal title={donation.name} subtitle={`${donation.donor} · ${donation.category}`} onClose={onClose}><div className="details-modal"><img src={donation.image} alt={donation.name} /><div className="details-meta"><span><Utensils size={15} /> {donation.quantity}</span><span><MapPin size={15} /> {donation.location} · {donation.distance}</span><span><Clock3 size={15} /> Pickup by {donation.expiresIn}</span><span><Leaf size={15} /> {donation.dietary || 'Ask donor about dietary details'}</span></div><p>{donation.description || 'Freshly prepared and ready for a new home. Coordinate pickup directly with the donor after claiming.'}</p><div className="details-actions"><button className="cancel-button report-button" onClick={onReport}><ShieldAlert size={14} /> Report listing</button><button className="offer-button" onClick={onClaim}>Claim this food <ArrowRight size={15} /></button></div></div></Modal>;
}

function ReportModal({ donation, onClose, onSubmit }) {
  const [reason, setReason] = useState('Unsafe food');
  const [details, setDetails] = useState('');
  return <Modal title="Report this listing" subtitle={`Help us review “${donation.name}”.`} onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ donationId: donation.id, reason, details }); }}><label>What should we review?<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Unsafe food</option><option>Incorrect details</option><option>Suspicious listing</option><option>Other</option></select></label><label>Additional details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share what you noticed" rows="4" /></label><div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="offer-button" type="submit"><ShieldAlert size={15} /> Send report</button></div></form></Modal>;
}

function InviteModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  return <Modal title="Bring a partner into the loop" subtitle="A good neighbor can make a big difference." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(email); }}><label>Partner email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="hello@local-kitchen.org" required /></label><div className="invite-note"><HeartHandshake size={17} /><span>We’ll prepare a FoodLoop invitation they can use to join your neighborhood.</span></div><div className="modal-actions"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="offer-button" type="submit">Prepare invitation <ArrowRight size={15} /></button></div></form></Modal>;
}

function Modal({ title, subtitle, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><div className="section-kicker">FOODLOOP COMMUNITY</div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>{children}</section></div>;
}

export default App;