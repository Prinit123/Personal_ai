import React from 'react';
import { MenuCard } from './MenuCard';

export const MenuSection = ({ items }) => {
  return (
    <section id="menu" style={{ padding: '80px 0' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '36px', color: 'var(--primary-brown)' }}>Our Fresh Menu</h2>
          <p style={{ color: 'var(--text-muted)' }}>Handcrafted with high-quality ingredients</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
          {items.map((item) => (
            <MenuCard key={item._id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};
