import { ArrowRight, Clock3, HeartHandshake, MapPin, PackageCheck, Utensils, UsersRound } from 'lucide-react';
import FoodCard from './FoodCard.jsx';
import EmptyState from './EmptyState.jsx';

function Overview({
  availableDonations,
  filteredDonations,
  mealCount,
  partnerCount,
  nextPickup,
  user,
  navigate,
  setModal,
  claimDonation,
  setCategory,
  category,
  fallbackFoodImage,
}) {
  const categories = ['All food', 'Prepared meals', 'Produce', 'Bakery'];
  return (
    <>
      <section className="metrics-grid">
        <article className="metric-card metric-primary">
          <div className="metric-top">
            <span>MEALS REDIRECTED</span>
            <span className="metric-icon"><Utensils size={16} /></span>
          </div>
          <div className="metric-value">{mealCount.toLocaleString()}<span className="metric-unit"> meals</span></div>
          <div className="metric-foot">
            <span className="metric-caption">Confirmed food handoffs</span>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>AVAILABLE LISTINGS</span>
            <span className="metric-icon metric-icon-orange"><PackageCheck size={16} /></span>
          </div>
          <div className="metric-value">{availableDonations.length}<span className="metric-unit"> listings</span></div>
          <div className="metric-foot">
            <span className="metric-caption">
              <span className="tiny-dot" /> Currently open
              <button className="text-action" onClick={() => navigate('marketplace')}>Browse <ArrowRight size={14} /></button>
            </span>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>COMMUNITY PARTNERS</span>
            <span className="metric-icon metric-icon-blue"><UsersRound size={16} /></span>
          </div>
          <div className="metric-value">{partnerCount}<span className="metric-unit"> registered</span></div>
          <div className="metric-foot">
            <span className="metric-caption">donors and community partners</span>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="listings-panel">
          <div className="section-heading">
            <div>
              <div className="section-kicker">FRESH FROM YOUR NEIGHBORHOOD</div>
              <h2>Food worth finding</h2>
            </div>
            <button className="text-action" onClick={() => navigate('marketplace')}>See all <ArrowRight size={15} /></button>
          </div>
          <div className="category-row compact-categories">
            {categories.map((item) => (
              <button key={item} className={`category-chip ${category === item ? 'chip-active' : ''}`} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="food-grid overview-food-grid">
            {filteredDonations.slice(0, 3).map((donation) => (
              <FoodCard key={donation.id} donation={donation} onClaim={claimDonation} onDetails={() => setModal({ type: 'details', donation })} />
            ))}
          </div>
          {filteredDonations.length === 0 && <EmptyState title="Nothing on the table yet" text="Try another category or check back soon." />}
        </div>
        <aside className="right-rail">
          <div className="pickup-panel">
            <div className="rail-heading">
              <div>
                <div className="section-kicker">YOUR NEXT GOOD DEED</div>
                <h3>{nextPickup ? 'Coming up' : 'No pickup yet'}</h3>
              </div>
              <button className="more-button" aria-label="See pickups" onClick={() => navigate('pickups')}>
                <ArrowRight size={17} />
              </button>
            </div>
            {nextPickup ? (
              <>
                <div className="pickup-feature-image">
                  <img src={nextPickup.image || fallbackFoodImage} alt={nextPickup.name} />
                  <span className="pickup-image-badge"><Clock3 size={12} /> BY {nextPickup.expiresIn?.toUpperCase() || 'TODAY'}</span>
                </div>
                <div className="pickup-feature-body">
                  <div className="pickup-feature-title">
                    <h4>{nextPickup.name}</h4>
                    <span className="status-badge status-claimed">Claimed</span>
                  </div>
                  <p><MapPin size={14} /> {nextPickup.location}</p>
                  <div className="pickup-divider" />
                  <div className="pickup-meta">
                    <span><Utensils size={14} /> {nextPickup.quantity}</span>
                    <span>{nextPickup.donor}</span>
                  </div>
                  <button className="outline-action" onClick={() => navigate(user?.role === 'donor' ? 'my-listings' : 'pickups')}>
                    View pickup details <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="pickup-feature-body">
                <p>No active pickup is linked to this account.</p>
                <button className="outline-action" onClick={() => navigate(user?.role === 'donor' ? 'my-listings' : 'marketplace')}>
                  {user?.role === 'donor' ? 'Manage listings' : 'Browse available food'} <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="community-banner">
            <div className="community-icon"><HeartHandshake size={19} /></div>
            <div>
              <strong>Pass it around</strong>
              <p>Invite a local kitchen to join your neighborhood loop.</p>
              <button onClick={() => setModal({ type: 'invite' })}>Invite a partner <ArrowRight size={14} /></button>
            </div>
            <span className="banner-sparkle">✳</span>
          </div>
        </aside>
      </section>
    </>
  );
}

export default Overview;
