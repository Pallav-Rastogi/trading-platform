const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { exec } = require('child_process');

const app = express();
app.use(bodyParser.json());

module.exports = async () => {
  try {
      await mongoose.connect(process.env.DB_URL, {});
      console.log("CONNECTED TO DATABASE SUCCESSFULLY");
  } catch (error) {
      console.error('COULD NOT CONNECT TO DATABASE:', error.message);
  }
};

mongoose.connect('mongodb+srv://nitinm23:vSSUeTsf5FwoUEqd@cluster0.e3psu.mongodb.net/', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Define MongoDB schemas
const orderSchema = new mongoose.Schema({
  type: { type: String, enum: ['buy', 'sell'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['open', 'filled', 'cancelled'], default: 'open' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  position: { type: Number, default: 0 },
  pnl: { type: Number, default: 0 }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);

// Function to run the order matching
function runOrderMatching() {
  exec('python order.py', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`Python script stderr: ${stderr}`);
      return;
    }
    console.log(`Python script output: ${stdout}`);
  });
}

// API routes
app.get('/api/orderbook', async (req, res) => {
  try {
    const bids = await Order.find({ type: 'buy', status: 'open' }).sort({ price: -1 });
    const asks = await Order.find({ type: 'sell', status: 'open' }).sort({ price: 1 });
    res.json({ bids, asks });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orderbook', error: error.message });
  }
});

app.get('/api/position/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ quantity: user.position, pnl: user.pnl });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user position', error: error.message });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const { type, quantity, price, userId } = req.body;
    
    if (!type || !quantity || !price || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (type !== 'buy' && type !== 'sell') {
      return res.status(400).json({ message: 'Invalid order type' });
    }
    
    if (quantity <= 0 || price <= 0) {
      return res.status(400).json({ message: 'Quantity and price must be positive' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newOrder = new Order({
      type,
      quantity,
      price,
      status: 'open',
      userId: user._id
    });

    await newOrder.save();
    res.json({ message: 'Order submitted successfully', orderId: newOrder._id });
    
    // Trigger order matching after new order is placed
    runOrderMatching();
  } catch (error) {
    res.status(500).json({ message: 'Error submitting order', error: error.message });
  }
});

app.post('/api/match-orders', (req, res) => {
  runOrderMatching();
  res.json({ message: 'Order matching initiated' });
});

// Run order matching every 5 seconds
setInterval(runOrderMatching, 5000);

app.listen(3000, () => console.log('Server running on port 3000'));