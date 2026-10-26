import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('prinit_cafe_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('prinit_cafe_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item, quantity = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i._id === item._id);
      if (existing) {
        return prevCart.map((i) =>
          i._id === item._id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prevCart, { ...item, quantity }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((i) => (i._id === id ? { ...i, quantity: newQty } : i))
    );
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter((i) => i._id !== id));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
