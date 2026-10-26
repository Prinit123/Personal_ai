import React from 'react';
import { cafeConfig } from '../config/cafeConfig';
import { ArrowRight } from 'lucide-react';

export const HeroSection = ({ onOrderNow }) => {
  return (
    <section style={{ background: 'linear-gradient(135deg, #fdfbf7 0%, #f4ebe1 100%)', padding: '80px 0' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'var(--accent-gold)', fontWeight: '600', letterSpacing: '1px' }}>WELCOME TO</span>
          <h1 style={{ fontSize: '48px', color: 'var(--primary-brown)', margin: '10px 0 20px 0' }}>
            {cafeConfig.name} ☕
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '30px', lineHeight: '1.6' }}>
            "{cafeConfig.tagline}"
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <a href="#menu" className="btn-primary">Explore Menu <ArrowRight size={18} /></a>
            <button onClick={onOrderNow} className="btn-secondary">Order Now</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          <img src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=400" alt="Tea" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px' }} />
          <img src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400" alt="Coffee" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px' }} />
          <img src="https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&q=80&w=400" alt="Maggi" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', gridColumn: 'span 2' }} />
        </div>
      </div>
    </section>
  );
};
