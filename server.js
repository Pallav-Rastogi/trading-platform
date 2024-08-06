// server.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://localhost/trading_platform', { useNewUrlParser: true, useUnifiedTopology: true });

// Define MongoDB schemas
const orderSchema = new mongoose.Schema({
  type: String,
  quantity: Number,
  price: Number,
  status: String,
  userId: mongoose.Schema.Types.ObjectId
});

const userSchema = new mongoose.Schema({
  username: String,
  position: Number,
  pnl: Number
});

const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);

// API routes
app.get('/api/orderbook', async (req, res) => {
  const bids = await Order.find({ type: 'buy', status: 'open' }).sort({ price: -1 });
  const asks = await Order.find({ type: 'sell', status: 'open' }).sort({ price: 1 });
  res.json({ bids, asks });
});

app.get('/api/position', async (req, res) => {
  // In a real app, you'd get the user ID from authentication
  const user = await User.findOne();
  res.json({ quantity: user.position, pnl: user.pnl });
});

app.post('/api/order', async (req, res) => {
  const { type, quantity, price } = req.body;
  // In a real app, you'd get the user ID from authentication
  const user = await User.findOne();
  
  const newOrder = new Order({
    type,
    quantity,
    price,
    status: 'open',
    userId: user._id
  });

  await newOrder.save();
  res.json({ message: 'Order submitted successfully' });
});

// Order matching function
async function matchOrders() {
  const bids = await Order.find({ type: 'buy', status: 'open' }).sort({ price: -1, createdAt: 1 });
  const asks = await Order.find({ type: 'sell', status: 'open' }).sort({ price: 1, createdAt: 1 });

  for (const bid of bids) {
    for (const ask of asks) {
      if (bid.price >= ask.price) {
        const matchedQuantity = Math.min(bid.quantity, ask.quantity);
        const matchPrice = ask.price;

        // Update orders
        bid.quantity -= matchedQuantity;
        ask.quantity -= matchedQuantity;
        
        if (bid.quantity === 0) bid.status = 'filled';
        if (ask.quantity === 0) ask.status = 'filled';

        await bid.save();
        await ask.save();

        // Update user positions and PnL
        const buyer = await User.findById(bid.userId);
        const seller = await User.findById(ask.userId);

        buyer.position += matchedQuantity;
        seller.position -= matchedQuantity;

        buyer.pnl -= matchedQuantity * matchPrice;
        seller.pnl += matchedQuantity * matchPrice;

        await buyer.save();
        await seller.save();

        if (ask.quantity === 0) break;
      } else {
        break;
      }
    }
    if (bid.status === 'filled') continue;
  }
}

// Run order matching every 5 seconds
setInterval(matchOrders, 5000);

app.listen(3000, () => console.log('Server running on port 3000'));
