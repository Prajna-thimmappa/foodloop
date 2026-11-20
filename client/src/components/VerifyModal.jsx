import { CheckCircle2, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal.jsx';

function VerifyModal({ donation, onClose, onSubmit }) {
  const [code, setCode] = useState('');
  return (
    <Modal title="Confirm this pickup" subtitle={`${donation.name} · ${donation.donor}`} onClose={onClose}>
      <form className="verify-form" onSubmit={(event) => { event.preventDefault(); onSubmit(donation, code); }}>
        <div className="otp-illustration"><PackageCheck size={27} /></div>
        <p>Ask the donor for their 6-digit handoff code to confirm the food has been collected.</p>
        {donation.pickupCode && <div className="demo-code-note"><span>PICKUP CODE</span><strong>{donation.pickupCode}</strong></div>}
        <input className="otp-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="······" aria-label="6 digit pickup code" required minLength="6" maxLength="6" />
        <button className="offer-button verify-submit" disabled={code.length !== 6}><CheckCircle2 size={17} /> Confirm collection</button>
      </form>
    </Modal>
  );
}

export default VerifyModal;
