import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal.jsx';

function AuthModal({ user, onClose, onSubmit }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState(user?.role && user.role !== 'admin' ? user.role : 'ngo');
  function submit(event) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    formData.mode = mode;
    formData.role = role;
    onSubmit(formData);
  }
  return (
    <Modal title={mode === 'login' ? 'Welcome back' : 'Join the neighborhood'} subtitle="Be part of a kinder, less wasteful food system." onClose={onClose}>
      <form className="modal-form auth-form" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <label>Your name<input name="name" placeholder="Name" required /></label>
            <label>Organization<input name="organization" placeholder="Kitchen, NGO, or community group" /></label>
            <div className="role-picker">
              <span>I’m here as a</span>
              {[['ngo', 'NGO'], ['volunteer', 'Volunteer'], ['donor', 'Food donor']].map(([value, label]) => (
                <button type="button" key={value} className={role === value ? 'role-selected' : ''} onClick={() => setRole(value)}>{label}</button>
              ))}
            </div>
          </>
        )}
        <label>Email address<input name="email" type="email" placeholder="you@example.org" required /></label>
        <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength="8" required /></label>
        <button type="submit" className="offer-button full-button">{mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={16} /></button>
        <p className="auth-switch">{mode === 'login' ? 'New to FoodLoop?' : 'Already part of the loop?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Log in'}</button></p>
      </form>
    </Modal>
  );
}

export default AuthModal;
