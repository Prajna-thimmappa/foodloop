import { Plus } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal.jsx';

const fallbackFoodImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=80';

function DonationModal({ onClose, onSubmit }) {
  const [preview, setPreview] = useState('');
  const [values, setValues] = useState({ name: '', quantity: '', category: 'Prepared meals', location: '', expiresIn: '', description: '', dietary: 'No preference' });
  function update(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }
  function submit(event) {
    event.preventDefault();
    onSubmit({ ...values, photo: event.currentTarget.elements.photo.files[0] || null, image: preview || fallbackFoodImage });
  }
  return (
    <Modal title="Give good food another home" subtitle="A few details help the right neighbor find your donation." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className={`upload-field ${preview ? 'has-preview' : ''}`}>
          {preview ? <img src={preview} alt="Donation preview" /> : <span className="upload-placeholder"><Plus size={20} /><strong>Add a food photo</strong><small>A clear photo helps partners decide</small></span>}
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
        </label>
        <div className="form-grid">
          <label>Food name<input name="name" value={values.name} onChange={update} placeholder="e.g. Vegetable rice bowls" required /></label>
          <label>Quantity<input name="quantity" value={values.quantity} onChange={update} placeholder="e.g. 12 meals" required /></label>
          <label>Category<select name="category" value={values.category} onChange={update}><option>Prepared meals</option><option>Produce</option><option>Bakery</option><option>Dairy</option></select></label>
          <label>Pickup location<input name="location" value={values.location} onChange={update} placeholder="Area or street address" required /></label>
          <label>Pickup by<input type="datetime-local" name="expiresIn" value={values.expiresIn} onChange={update} required /></label>
          <label>Dietary info<select name="dietary" value={values.dietary} onChange={update}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Contains gluten</option><option>Contains dairy</option></select></label>
        </div>
        <label>Description<textarea name="description" value={values.description} onChange={update} placeholder="What should a community partner know?" rows="3" /></label>
        <div className="modal-actions">
          <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="offer-button"><Plus size={16} /> Publish listing</button>
        </div>
      </form>
    </Modal>
  );
}

export default DonationModal;
