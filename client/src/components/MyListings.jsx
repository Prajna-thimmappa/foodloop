import { ArrowRight, HeartHandshake } from 'lucide-react';
import EmptyState from './EmptyState.jsx';

function MyListings({ donations, user, setModal }) {
  if (user.role !== 'donor') return <EmptyState title="Donor workspace" text="Register as a food donor to manage your kitchen’s listings and pickup handoffs." />;
  return (
    <section className="simple-page">
      <div className="section-heading">
        <div>
          <div className="section-kicker">YOUR KITCHEN’S CONTRIBUTION</div>
          <h2>My food listings</h2>
        </div>
        <span className="result-count">{donations.length} total</span>
      </div>
      {donations.length ? (
        <div className="pickup-list">
          {donations.map((item) => (
            <article className="pickup-row" key={item.id}>
              <img src={item.image || ''} alt="" />
              <div className="pickup-row-main">
                <span className={`status-badge ${item.status === 'available' ? 'status-available' : item.status === 'collected' ? 'status-collected' : 'status-claimed'}`}>{item.status}</span>
                <h3>{item.name}</h3>
                <p>{item.quantity} <span>·</span> Pickup by {item.expiresIn}</p>
                {item.claimedBy && <small><HeartHandshake size={13} /> Claimed by {item.claimedBy}</small>}
              </div>
              <div className="pickup-row-side">
                {item.status === 'claimed' && <button className="claim-button" onClick={() => setModal({ type: 'donor-code', donation: item })}>Share pickup code <ArrowRight size={14} /></button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Your first listing starts here" text="Post surplus food and connect with nearby community partners." />
      )}
    </section>
  );
}

export default MyListings;
