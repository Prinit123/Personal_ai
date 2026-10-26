const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 }
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerName: { type: String, required: true, trim: true },
  mobileNumber: { type: String, required: true, trim: true },
  orderType: { type: String, enum: ['Pickup', 'Delivery'], required: true },
  deliveryAddress: { type: String, required: function() { return this.orderType === 'Delivery'; } },
  specialInstructions: { type: String, default: '' },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
    default: 'Pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
