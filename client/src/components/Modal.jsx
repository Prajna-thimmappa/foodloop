import { X } from 'lucide-react';

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <div>
            <div className="section-kicker">FOODLOOP COMMUNITY</div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default Modal;
