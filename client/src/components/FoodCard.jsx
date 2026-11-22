import { ArrowRight, Check, Clock3, HeartHandshake, MapPin, Sparkles, Utensils } from 'lucide-react';
import { useState } from 'react';

function isFresh(posted) {
  if (!posted) return false;
  const postedTime = new Date(posted).getTime();
  return Number.isFinite(postedTime) && Date.now() - postedTime < 24 * 60 * 60 * 1000;
}

function FoodCard({ donation, onClaim, onDetails, fallbackFoodImage }) {
  const [saved, setSaved] = useState(false);
  const fresh = isFresh(donation.posted);
  return (
    <article className={`food-card ${fresh ? 'food-card-fresh' : ''}`}>
      <div className="food-image-button" role="button" tabIndex={0} onClick={onDetails} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDetails(); }} aria-label={`View ${donation.name}`}>
        <img className="food-image" src={donation.image || fallbackFoodImage} alt={donation.name} />
        <span className="image-category">{donation.category}</span>
        {fresh && <span className="fresh-badge"><Sparkles size={11} /> Fresh</span>}
        <button className={`save-button ${saved ? 'saved' : ''}`} onClick={(event) => { event.stopPropagation(); setSaved(!saved); }} aria-label={saved ? 'Remove saved food' : 'Save food'}>
          {saved ? <Check size={16} /> : <HeartHandshake size={16} />}
        </button>
      </div>
      <div className="food-card-content">
        <div className="food-donor">
          <span className="donor-monogram">{donation.donor?.[0] || 'F'}</span>
          <span>{donation.donor || 'FoodLoop partner'}</span>
        </div>
        <button className="food-title-button" onClick={onDetails}>
          <h3>{donation.name}</h3>
        </button>
        <div className="food-card-info">
          <span><Utensils size={14} />{donation.quantity}</span>
          <span><MapPin size={14} />{donation.location || 'Pickup location provided'}</span>
        </div>
        <div className="servings-dots">{Array.from({ length: Math.max(1, Math.min(5, Number(donation.servings || 1))) }, (_, i) => <span key={i} className="serving-dot" />)}</div>
        <div className="food-card-bottom">
          <span className="expiry-label"><Clock3 size={13} /> Pickup by {donation.expiresIn || 'Today'}</span>
          <button className="claim-button" onClick={() => onClaim(donation)}>Claim <ArrowRight size={14} /></button>
        </div>
      </div>
    </article>
  );
}

export default FoodCard;
