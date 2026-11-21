import { ArrowRight, Leaf, Sprout } from 'lucide-react';

function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="empty-state empty-state-enhanced">
      <div className="empty-state-icon"><Leaf size={26} strokeWidth={2} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="text-action" onClick={onAction}>{action} <ArrowRight size={14} /></button>}
    </div>
  );
}

export default EmptyState;
