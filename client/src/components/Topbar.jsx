import { Bell, ChevronDown, ChevronRight, MapPin, Menu, Plus, UserRound } from 'lucide-react';

function Topbar({ setMobileNavOpen, activePage, navItems, announce, user, navigate }) {
  const pageLabel = navItems.find((item) => item.id === activePage)?.label || (activePage === 'admin' ? 'Admin' : 'Overview');
  const initials = user?.name ? user.name.split(' ').map((part) => part[0]).slice(0, 2).join('') : 'FL';
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="breadcrumb">
        <span>FoodLoop</span>
        <ChevronRight size={14} />
        <strong>{pageLabel}</strong>
      </div>
      <div className="topbar-actions">
        <div className="location-pill">
          <MapPin size={15} />
          <span>Bengaluru</span>
          <ChevronDown size={13} />
        </div>
        <button className="icon-button notification-button" aria-label="Notifications" onClick={() => announce('You’re all caught up.')}>
          <Bell size={18} />
          <i />
        </button>
        <div className="profile-trigger" onClick={() => setModal({ type: 'auth' })}>
          <div className="profile-avatar-small">{initials}</div>
          <span className="profile-name-small">{user?.name || 'Guest'}</span>
          <ChevronDown size={12} className="muted-icon" />
        </div>
        <button className="offer-button" aria-label="Offer food" onClick={() => navigate('marketplace')}>
          <Plus size={17} />
          <span>Offer food</span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;
