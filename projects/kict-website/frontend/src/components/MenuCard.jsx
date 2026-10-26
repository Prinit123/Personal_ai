import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';

export const MenuCard = ({ item }) => {
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addToCart(item, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ background: 'var(--white)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
      <img src={item.image} alt={item.name} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
      <div style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ color: 'var(--primary-brown)', fontSize: '20px' }}>{item.name}</h3>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary-brown)' }}>₹{item.price}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '15px' }}>{item.description}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '20px' }}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ padding: '4px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>-</button>
            <span style={{ padding: '0 8px', fontWeight: '600' }}>{qty}</span>
            <button onClick={() => setQty(qty + 1)} style={{ padding: '4px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>+</button>
          </div>
          <button onClick={handleAdd} className="btn-primary" style={{ flexGrow: 1, padding: '8px 12px', justifyContent: 'center' }}>
            {added ? <Check size={16} /> : <Plus size={16} />}
            {added ? 'Added' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};
