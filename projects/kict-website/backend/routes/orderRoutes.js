const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');

// POST place order (Calculated & Validated Server-Side)
router.post('/', async (req, res) => {
  try {
    const { customerName, mobileNumber, orderType, deliveryAddress, specialInstructions, items } = req.body;

    if (!customerName || !mobileNumber || !orderType || !items || items.length === 0) {
      return res.status(400).json({ message: 'Please provide all required order details.' });
    }

    if (orderType === 'Delivery' && (!deliveryAddress || deliveryAddress.trim() === '')) {
      return res.status(400).json({ message: 'Delivery address is required for Delivery orders.' });
    }

    // Verify prices server-side to prevent tampering
    let totalAmount = 0;
    const verifiedItems = [];

    for (let item of items) {
      const dbItem = await MenuItem.findById(item._id || item.menuItemId);
      if (!dbItem) {
        return res.status(400).json({ message: `Item standard missing: ${item.name}` });
      }
      const itemTotal = dbItem.price * item.quantity;
      totalAmount += itemTotal;
      verifiedItems.push({
        menuItemId: dbItem._id,
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity
      });
    }

    const orderNumber = 'PRN-' + Math.floor(100000 + Math.random() * 900000);

    const newOrder = new Order({
      orderNumber,
      customerName,
      mobileNumber,
      orderType,
      deliveryAddress: orderType === 'Delivery' ? deliveryAddress : '',
      specialInstructions: specialInstructions || '',
      items: verifiedItems,
      totalAmount,
      status: 'Pending'
    });

    await newOrder.save();
    res.status(201).json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ message: 'Failed to record order', error: err.message });
  }
});

module.exports = router;
