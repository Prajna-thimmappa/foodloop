import axios from 'axios';
import { useEffect, useState } from 'react';
import EmptyState from './EmptyState.jsx';

function Admin({ donations, users }) {
  const [stats, setStats] = useState({ users: 0, donors: 0, ngos: 0, available: 0, claimed: 0, collected: 0, openReports: 0 });

  useEffect(() => {
    if (users.role !== 'admin') return;
    axios.get('/api/admin/stats', { timeout: 2500 })
      .then(({ data }) => setStats(data))
      .catch(() => setStats({ users: 0, donors: 0, ngos: 0, available: 0, claimed: 0, collected: 0, openReports: 0 }));
  }, [users.role]);

  if (users.role !== 'admin') return <EmptyState title="Admin access required" text="Switch to an administrator account to view platform reports." />;
  const claimed = donations.filter((item) => item.status === 'claimed').length;
  return (
    <section className="simple-page">
      <div className="section-heading">
        <div>
          <div className="section-kicker">PLATFORM HEALTH</div>
          <h2>Keeping the loop healthy</h2>
        </div>
      </div>
      <div className="admin-stats">
        <article>
          <span>Total members</span>
          <strong>{stats.users || 0}</strong>
          <small>{stats.donors || 0} donors · {stats.ngos || 0} NGOs</small>
        </article>
        <article>
          <span>Active listings</span>
          <strong>{stats.available || donations.filter((item) => item.status === 'available').length}</strong>
          <small>Live food posted today</small>
        </article>
        <article>
          <span>Awaiting pickup</span>
          <strong>{stats.claimed || claimed}</strong>
          <small>Keep an eye on these</small>
        </article>
        <article>
          <span>Meals redirected</span>
          <strong>{stats.collected || donations.filter((item) => item.status === 'collected').reduce((total, item) => total + Number(item.servings || 0), 0)}</strong>
          <small>From confirmed pickups</small>
        </article>
      </div>
      <div className="admin-table-wrap">
        <div className="table-heading">
          <h3>Recent listings</h3>
          <span>Live moderation queue</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>LISTING</th>
              <th>DONOR</th>
              <th>STATUS</th>
              <th>QUANTITY</th>
            </tr>
          </thead>
          <tbody>
            {donations.slice(0, 5).map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.donor}</td>
                <td><span className={`status-badge ${item.status === 'available' ? 'status-available' : 'status-claimed'}`}>{item.status}</span></td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Admin;
