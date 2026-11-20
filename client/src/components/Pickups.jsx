import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import EmptyState from './EmptyState.jsx';

function Pickups({ donations, navigate, verifyPickup, fallbackFoodImage }) {
  return (
    <section className="simple-page">
      <div className="section-heading">
        <div>
          <div className="section-kicker">THE LAST MILE MATTERS</div>
          <h2>Pickups in your care</h2>
        </div>
        <span className="result-count">{donations.length} total</span>
      </div>
      {donations.length ? (
        <div className="pickup-list">
          {donations.map((item) => (
            <article className="pickup-row" key={item.id}>
              <img src={item.image || fallbackFoodImage} alt="" />
              <div className="pickup-row-main">
                <span className={`status-badge ${item.status === 'collected' ? 'status-collected' : 'status-claimed'}`}>{item.status === 'collected' ? 'Collected' : 'Ready for pickup'}</span>
                <h3>{item.name}</h3>
                <p>{item.donor} <span>·</span> {item.quantity}</p>
                <small><MapPin size={13} /> {item.location}</small>
              </div>
              <div className="pickup-row-side">
                <span><Clock3 size={14} /> {item.expiresIn}</span>
                {item.status !== 'collected' && <button className="claim-button" onClick={() => verifyPickup(item)}>Verify pickup <ArrowRight size={14} /></button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Your next pickup starts here" text="Find a listing and claim food for your community." action="Browse available food" onAction={() => navigate('marketplace')} />
      )}
    </section>
  );
}

export default Pickups;
