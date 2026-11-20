import { Search, ChevronDown } from 'lucide-react';
import FoodCard from './FoodCard.jsx';
import EmptyState from './EmptyState.jsx';

function Marketplace({ donations, category, setCategory, search, setSearch, sortBy, setSortBy, claimDonation, setModal, listingsRefreshedAt }) {
  const categories = ['All food', 'Prepared meals', 'Produce', 'Bakery'];
  const refreshedText = listingsRefreshedAt ? `Listings refreshed ${new Date(listingsRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null;
  return (
    <section className="marketplace-page">
      <div className="marketplace-controls">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food, kitchens, or area" />
          <kbd>⌘ K</kbd>
        </label>
        <label className="sort-button">
          Sort:<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings">
            <option>Recommended</option>
            <option>Most servings</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="marketplace-subrow">
        <div className="category-row">
          {categories.map((item) => (
            <button key={item} className={`category-chip ${category === item ? 'chip-active' : ''}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <span className="result-count">{donations.length} available listings</span>
        {refreshedText && <span className="result-count">{refreshedText}</span>}
      </div>
      <div className="food-grid marketplace-food-grid">
        {donations.map((donation) => (
          <FoodCard key={donation.id} donation={donation} onClaim={claimDonation} onDetails={() => setModal({ type: 'details', donation })} />
        ))}
      </div>
      {donations.length === 0 && <EmptyState title="No matches just yet" text="Try a different search or category." />}
    </section>
  );
}

export default Marketplace;
