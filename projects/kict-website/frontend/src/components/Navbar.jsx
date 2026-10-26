import React from 'react';
import { ShoppingBag, Coffee } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { cafeConfig } from '../config/cafeConfig';

export const Navbar = ({ onOpenCart, onOpenAdmin }) => {
  const { cart } = useCart();
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav style={{ background: 'var(--white)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => window.scrollTo(0, 0)}>
          <Coffee color="var(--primary-brown)" size={28} />
          <span className="serif-font" style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-brown)' }}>
            {cafeConfig.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="#menu" style={{ textDecoration: 'none', color: 'var(--text-dark)', fontWeight: '500' }}>Menu</a>
          <a href="#why-us" style={{ textDecoration: 'none', color: 'var(--text-dark)', fontWeight: '500' }}>Why Us</a>
          <a href="#contact" style={{ textDecoration: 'none', color: 'var(--text-dark)', fontWeight: '500' }}>Contact</a>
          <button onClick={onOpenAdmin} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>
            Admin
          </button>
          <button onClick={onOpenCart} className="btn-primary" style={{ padding: '8px 18px' }}>
            <ShoppingBag size={18} />
            <span>Cart ({totalCount})</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
