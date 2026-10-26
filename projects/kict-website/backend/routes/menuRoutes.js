const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');

// GET all menu items
router.get('/', async (req, res) => {
  try {
    const items = await MenuItem.find();
    // Default seed items if database is empty
    if (items.length === 0) {
      const defaultItems = [
        {
          name: 'Tea',
          description: 'Freshly prepared, aromatic refreshing hot tea brewed with Indian spices.',
          price: 20,
          category: 'Beverages',
          image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=600'
        },
        {
          name: 'Coffee',
          description: 'Delicious hot coffee topped with rich creamy froth.',
          price: 90,
          category: 'Beverages',
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600'
        },
        {
          name: 'Maggi',
          description: 'Hot and tasty classic butter veg Maggi noodles.',
          price: 110,
          category: 'Snacks',
          image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&q=80&w=600'
        }
      ];
      const seeded = await MenuItem.insertMany(defaultItems);
      return res.json(seeded);
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching menu items', error: err.message });
  }
});

// POST add new menu item (Admin)
router.post('/', async (req, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    if (!name || !description || price === undefined || !image) {
      return res.status(400).json({ message: 'All required fields must be supplied' });
    }
    const newItem = new MenuItem({ name, description, price: Number(price), category, image });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: 'Error saving menu item', error: err.message });
  }
});

// PUT update menu item
router.put('/:id', async (req, res) => {
  try {
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating item', error: err.message });
  }
});

// DELETE menu item
router.delete('/:id', async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting item', error: err.message });
  }
});

module.exports = router;
