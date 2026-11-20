import { ArrowRight, Check, CalendarDays, MapPin } from 'lucide-react';
import Modal from './Modal.jsx';

const fallbackFoodImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';

function ClaimedModal({ donation, onClose }) {
  return (
    <Modal title="You’ve got it." subtitle="One less meal wasted, one more person nourished." onClose={onClose}>
      <div className="claim-confirmation">
        <span className="success-check"><Check size={25} /></span>
        <div className="claimed-summary">
          <img src={donation.image || fallbackFoodImage} alt="" />
          <div>
            <strong>{donation.name}</strong>
            <span>{donation.quantity} · {donation.donor}</span>
          </div>
        </div>
        <div className="pickup-instructions">
          <span><MapPin size={16} /> PICKUP AT</span>
          <strong>{donation.location}</strong>
          <span><CalendarDays size={16} /> BEFORE {donation.expiresIn?.toUpperCase()}</span>
        </div>
        {donation.pickupCode && <div className="demo-code-note"><span>PICKUP CODE</span><strong>{donation.pickupCode}</strong></div>}
        <button className="offer-button full-button" onClick={onClose}>View pickup details <ArrowRight size={16} /></button>
      </div>
    </Modal>
  );
}

export default ClaimedModal;
