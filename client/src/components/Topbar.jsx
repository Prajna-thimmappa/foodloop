import { Bell, ChevronDown, ChevronRight, MapPin, Menu, Plus } from 'lucide-react';

function Topbar({ setMobileNavOpen, activePage, navItems, announce, navigate }) {
  const pageLabel = navItems.find((item) => item.id === activePage)?.label || (activePage === 'admin' ? 'Admin' : 'Overview');
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
        <button className="offer-button" aria-label="Offer food" onClick={() => navigate('marketplace')}>
          <Plus size={17} />
          <span>Offer food</span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;
