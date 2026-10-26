const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');

// Admin Auth Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'PrinitCafe@2025';

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ message: 'Invalid admin credentials' });
});

// Middleware for Admin Auth
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ message: 'Unauthorized access' });
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// GET all orders
router.get('/orders', verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// PUT update order status
router.put('/orders/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Error updating order status' });
  }
});

module.exports = router;
