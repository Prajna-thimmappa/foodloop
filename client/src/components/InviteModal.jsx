import { ArrowRight, HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal.jsx';

function InviteModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  return (
    <Modal title="Bring a partner into the loop" subtitle="A good neighbor can make a big difference." onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(email); }}>
        <label>Partner email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="hello@local-kitchen.org" required /></label>
        <div className="invite-note"><HeartHandshake size={17} /><span>We’ll prepare a FoodLoop invitation they can use to join your neighborhood.</span></div>
        <div className="modal-actions">
          <button className="cancel-button" type="button" onClick={onClose}>Cancel</button>
          <button className="offer-button" type="submit">Prepare invitation <ArrowRight size={15} /></button>
        </div>
      </form>
    </Modal>
  );
}

export default InviteModal;
