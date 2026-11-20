import { Sprout, Utensils, PackageCheck, UsersRound, Leaf } from 'lucide-react';

function Impact({ mealCount, completedPickups, partnerCount }) {
  return (
    <section className="impact-page">
      <div className="impact-hero">
        <div className="impact-hero-copy">
          <span className="impact-hero-mark"><Sprout size={19} /> YOUR NEIGHBORHOOD IN MOTION</span>
          <h2>Good food is too good to waste.</h2>
          <p>Every pickup keeps nourishing food in the community and out of the bin. Here’s the good your local loop is doing.</p>
        </div>
        <div className="impact-hero-number">
          <strong>{mealCount.toLocaleString()}</strong>
          <span>meals redirected<br />and counting</span>
        </div>
      </div>
      <div className="impact-stat-grid">
        <article>
          <span className="impact-stat-icon green"><Utensils size={18} /></span>
          <strong>{mealCount.toLocaleString()}</strong>
          <span>meals shared</span>
          <small>From confirmed pickups</small>
        </article>
        <article>
          <span className="impact-stat-icon orange"><PackageCheck size={18} /></span>
          <strong>{completedPickups}</strong>
          <span>successful pickups</span>
          <small>Confirmed handoffs</small>
        </article>
        <article>
          <span className="impact-stat-icon blue"><UsersRound size={18} /></span>
          <strong>{partnerCount}</strong>
          <span>community partners</span>
          <small>Registered donors and partners</small>
        </article>
      </div>
      <div className="impact-footnote">
        <Leaf size={17} />
        <p>Meal counts include only listings confirmed as collected. FoodLoop avoids estimating waste impact until portion weights are available.</p>
      </div>
    </section>
  );
}

export default Impact;
