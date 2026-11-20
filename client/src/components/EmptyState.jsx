import { ArrowRight, Sprout } from 'lucide-react';

function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <span><Sprout size={21} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="text-action" onClick={onAction}>{action} <ArrowRight size={14} /></button>}
    </div>
  );
}

export default EmptyState;
