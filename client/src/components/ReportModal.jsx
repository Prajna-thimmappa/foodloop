import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal.jsx';

function ReportModal({ donation, onClose, onSubmit }) {
  const [reason, setReason] = useState('Unsafe food');
  const [details, setDetails] = useState('');
  return (
    <Modal title="Report this listing" subtitle={`Help us review “${donation.name}”.`} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ donationId: donation.id, reason, details }); }}>
        <label>What should we review?<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Unsafe food</option><option>Incorrect details</option><option>Suspicious listing</option><option>Other</option></select></label>
        <label>Additional details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share what you noticed" rows="4" /></label>
        <div className="modal-actions">
          <button className="cancel-button" type="button" onClick={onClose}>Cancel</button>
          <button className="offer-button" type="submit"><ShieldAlert size={15} /> Send report</button>
        </div>
      </form>
    </Modal>
  );
}

export default ReportModal;
