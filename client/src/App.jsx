import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Compass,
  HeartHandshake,
  Leaf,
  PackageCheck,
  Search,
  ShieldAlert,
  Sprout,
  Sparkles,
  Utensils,
} from 'lucide-react';

import Admin from './components/Admin.jsx';
import AuthModal from './components/AuthModal.jsx';
import ClaimedModal from './components/ClaimedModal.jsx';
import DetailsModal from './components/DetailsModal.jsx';
import DonationModal from './components/DonationModal.jsx';
import DonorCodeModal from './components/DonorCodeModal.jsx';
import Impact from './components/Impact.jsx';
import InviteModal from './components/InviteModal.jsx';
import Marketplace from './components/Marketplace.jsx';
import MyListings from './components/MyListings.jsx';
import Overview from './components/Overview.jsx';
import Pickups from './components/Pickups.jsx';
import ReportModal from './components/ReportModal.jsx';
import Topbar from './components/Topbar.jsx';
import VerifyModal from './components/VerifyModal.jsx';

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'marketplace', label: 'Find food', icon: Search },
  { id: 'pickups', label: 'My pickups', icon: PackageCheck },
  { id: 'my-listings', label: 'My listings', icon: Utensils },
  { id: 'impact', label: 'Our impact', icon: Sprout },
];

const fallbackFoodImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';

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
  const [myPickups, setMyPickups] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [communityStats, setCommunityStats] = useState({ mealsRedirected: 0, completedPickups: 0, partners: 0 });
  const [listingsRefreshedAt, setListingsRefreshedAt] = useState(null);
  const [activePage, setActivePage] = useState('overview');
  const [category, setCategory] = useState('All food');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('Recommended');
  const [modal, setModal] = useState(() => {
    const token = localStorage.getItem('foodloop-token');
    return token ? null : { type: 'auth' };
  });
  const [pendingClaim, setPendingClaim] = useState(null);
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
  }, []);

  useEffect(() => {
    let active = true;
    axios.get('/api/donations', { timeout: 2500 })
      .then(({ data }) => {
        if (active && Array.isArray(data.donations)) {
          setDonations(data.donations);
          setListingsRefreshedAt(new Date());
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    axios.get('/api/community/stats', { timeout: 4000 })
      .then(({ data }) => { if (active) setCommunityStats(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setTimeout(() => {
        setMyPickups([]);
        setMyListings([]);
      }, 0);
      return () => { active = false; };
    }

    const requests = [];
    if (['ngo', 'volunteer'].includes(user.role)) {
      requests.push(axios.get('/api/donations/pickups', { timeout: 4000 }).then(({ data }) => {
        if (active) setMyPickups(data.donations || []);
      }).catch(() => { if (active) setMyPickups([]); }));
    } else {
      setTimeout(() => setMyPickups([]), 0);
    }
    if (user.role === 'donor') {
      requests.push(axios.get('/api/donations/mine', { timeout: 4000 }).then(({ data }) => {
        if (active) setMyListings(data.donations || []);
      }).catch(() => { if (active) setMyListings([]); }));
    } else {
      setTimeout(() => setMyListings([]), 0);
    }

    return () => {
      active = false;
      void Promise.all(requests);
    };
  }, [user]);

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
      return matchesCategory && matchesSearch;
    }).sort((left, right) => {
      if (sortBy === 'Most servings') return Number(right.servings || 0) - Number(left.servings || 0);
      return 0;
    });
  }, [availableDonations, category, deferredSearch, sortBy]);
  const mealCount = communityStats.mealsRedirected;
  const nextPickup = (user?.role === 'donor' ? myListings : myPickups).find((item) => item.status === 'claimed');
  const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  function navigate(page) {
    setActivePage(page);
    setMobileNavOpen(false);
  }

  function announce(message) {
    setToast(message);
  }

  async function logout() {
    const token = localStorage.getItem('foodloop-token');
    if (token) {
      try {
        await axios.post('/api/auth/logout', {}, { timeout: 2500 });
      } catch {
        // Ignore logout errors and fall back to local sign-out state.
      }
    }

    localStorage.removeItem('foodloop-token');
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    setMyPickups([]);
    setMyListings([]);
    setModal({ type: 'auth' });
    setActivePage('overview');
    announce('Signed out.');
  }

  async function claimDonation(donation) {
    try {
      const { data } = await axios.patch(`/api/donations/${donation.id}/claim`, {}, { timeout: 2500 });
      const claimedDonation = { ...donation, ...data.donation };
      setDonations((current) => current.map((item) => item.id === donation.id ? claimedDonation : item));
      setMyPickups((current) => [claimedDonation, ...current.filter((item) => item.id !== donation.id)]);
      setModal({ type: 'claimed', donation: claimedDonation });
      announce('Pickup claimed successfully.');
    } catch (error) {
      if (error.response?.status === 401) {
        setPendingClaim(donation);
        setModal({ type: 'auth' });
        announce('Sign in to claim this listing.');
        return;
      }
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
    setMyPickups((current) => current.map((item) => item.id === donation.id ? { ...item, status: 'collected' } : item));
    setModal(null);
    announce('Pickup confirmed. Thank you for showing up.');
    return true;
  }

  async function addDonation(formData) {
    const { photo, ...listingValues } = formData;
    try {
      let image = listingValues.image || fallbackFoodImage;
      if (photo) {
        const uploadData = new FormData();
        uploadData.append('image', photo);
        const uploadResponse = await axios.post('/api/uploads', uploadData, { timeout: 8000 });
        image = uploadResponse.data.url;
      }
      const { data } = await axios.post('/api/donations', { ...listingValues, expiresAt: new Date(listingValues.expiresIn).toISOString(), image }, { timeout: 4000 });
      setDonations((current) => [data.donation, ...current]);
      setMyListings((current) => [data.donation, ...current]);
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
      if (pendingClaim) {
        const donation = pendingClaim;
        setPendingClaim(null);
        setModal(null);
        await claimDonation(donation);
      } else if (formData.mode === 'register' && data.user.role === 'donor') {
        setModal({ type: 'donation' });
      } else {
        setModal(null);
      }
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
          {navItems.map(({ id, label, icon: Icon, count }) => {
            const badge = id === 'marketplace' ? availableDonations.length : count;
            return (
              <button key={id} className={`nav-link ${activePage === id ? 'nav-active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {badge && <span className="nav-count">{badge}</span>}
              </button>
            );
          })}
          {currentUser.role === 'admin' && <button className={`nav-link ${activePage === 'admin' ? 'nav-active' : ''}`} onClick={() => navigate('admin')}><ShieldAlert size={18} /><span>Admin</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="impact-note">
            <div className="impact-note-icon"><Sparkles size={16} /></div>
            <p><strong>Good things add up.</strong><br />Your community has shared <b>{mealCount.toLocaleString()} meals</b> in confirmed pickups.</p>
            <button onClick={() => navigate('impact')}>See your impact <ArrowRight size={14} /></button>
          </div>
          <button className="profile-row" onClick={() => setModal({ type: 'auth' })}>
            <span className="profile-avatar">{currentUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <span className="profile-copy"><strong>{currentUser.name}</strong><small>Manage profile</small></span>
            <ChevronDown size={15} className="muted-icon" />
          </button>
          <button className="text-action" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <Topbar mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} activePage={activePage} navItems={navItems} announce={announce} user={currentUser} navigate={navigate} />

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> COMMUNITY BOARD <span className="eyebrow-divider">/</span> {todayLabel}</div>
              <h1>{pageTitle}</h1>
              <p className="welcome-subtitle">{activePage === 'marketplace' ? 'Rescue something delicious from a neighbor today.' : `${greeting}, ${currentUser.name.split(' ')[0] || 'neighbor'}. Here’s what’s happening around you.`}</p>
            </div>
          </section>

          {activePage === 'overview' && <Overview
            availableDonations={availableDonations}
            filteredDonations={filteredDonations}
            mealCount={mealCount}
            partnerCount={communityStats.partners}
            user={currentUser}
            nextPickup={nextPickup}
            navigate={navigate}
            setModal={setModal}
            claimDonation={claimDonation}
            setCategory={setCategory}
            category={category}
            fallbackFoodImage={fallbackFoodImage}
          />}
          {activePage === 'marketplace' && <Marketplace
            donations={filteredDonations}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            claimDonation={claimDonation}
            setModal={setModal}
            listingsRefreshedAt={listingsRefreshedAt}
          />}
          {activePage === 'pickups' && <Pickups donations={myPickups} navigate={navigate} verifyPickup={(donation) => setModal({ type: 'verify', donation })} fallbackFoodImage={fallbackFoodImage} />}
          {activePage === 'my-listings' && <MyListings donations={myListings} user={currentUser} setModal={setModal} />}
          {activePage === 'impact' && <Impact mealCount={mealCount} completedPickups={communityStats.completedPickups} partnerCount={communityStats.partners} />}
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

export default App;
