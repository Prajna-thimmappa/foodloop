import { ArrowRight, Clock3, Leaf, MapPin, ShieldAlert, Utensils } from 'lucide-react';
import Modal from './Modal.jsx';

const fallbackFoodImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';

function DetailsModal({ donation, onClose, onClaim, onReport }) {
  return (
    <Modal title={donation.name} subtitle={`${donation.donor} · ${donation.category}`} onClose={onClose}>
      <div className="details-modal">
        <img src={donation.image || fallbackFoodImage} alt={donation.name} />
        <div className="details-meta">
          <span><Utensils size={15} /> {donation.quantity}</span>
          <span><MapPin size={15} /> {donation.location}</span>
          <span><Clock3 size={15} /> Pickup by {donation.expiresIn}</span>
          <span><Leaf size={15} /> {donation.dietary || 'Ask donor about dietary details'}</span>
        </div>
        <p>{donation.description || 'Freshly prepared and ready for a new home. Coordinate pickup directly with the donor after claiming.'}</p>
        <div className="details-actions">
          <button className="cancel-button report-button" onClick={onReport}><ShieldAlert size={14} /> Report listing</button>
          <button className="offer-button" onClick={onClaim}>Claim this food <ArrowRight size={15} /></button>
        </div>
      </div>
    </Modal>
  );
}

export default DetailsModal;
