import { Check, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from './Modal.jsx';

function DonorCodeModal({ donation, onClose }) {
  const [pickupCode, setPickupCode] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    axios.post(`/api/donations/${donation.id}/pickup-code`, {}, { timeout: 3000 })
      .then(({ data }) => { if (active) setPickupCode(data.pickupCode); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load a pickup code.'); });
    return () => { active = false; };
  }, [donation]);
  return (
    <Modal title="Pickup handoff code" subtitle={`${donation.name} · claimed by ${donation.claimedBy || 'your community partner'}`} onClose={onClose}>
      <div className="verify-form">
        <div className="otp-illustration"><ShieldAlert size={25} /></div>
        <p>Share this code with the collector at the food handoff. It confirms the pickup is complete.</p>
        {error ? <p className="error-message">{error}</p> : <div className="donor-pickup-code">{pickupCode || '------'}</div>}
        <button className="offer-button verify-submit" disabled={!pickupCode} onClick={() => { navigator.clipboard?.writeText(pickupCode); onClose(); }}>Copy code <Check size={16} /></button>
      </div>
    </Modal>
  );
}

export default DonorCodeModal;
