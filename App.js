// App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [userPosition, setUserPosition] = useState({ quantity: 0, pnl: 0 });
  const [orderType, setOrderType] = useState('buy');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const orderbookResponse = await axios.get('/api/orderbook');
      setOrderbook(orderbookResponse.data);

      const positionResponse = await axios.get('/api/position');
      setUserPosition(positionResponse.data);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const submitOrder = async () => {
    await axios.post('/api/order', { type: orderType, quantity, price });
    // Refresh orderbook and position after submitting an order
    const orderbookResponse = await axios.get('/api/orderbook');
    setOrderbook(orderbookResponse.data);
    const positionResponse = await axios.get('/api/position');
    setUserPosition(positionResponse.data);
  };

  return (
    <div>
      <h1>Single Stock Trading Platform</h1>
      <div>
        <h2>Orderbook</h2>
        <div>
          <h3>Bids</h3>
          {orderbook.bids.map((bid, index) => (
            <div key={index}>{bid.price}: {bid.quantity}</div>
          ))}
        </div>
        <div>
          <h3>Asks</h3>
          {orderbook.asks.map((ask, index) => (
            <div key={index}>{ask.price}: {ask.quantity}</div>
          ))}
        </div>
      </div>
      <div>
        <h2>Your Position</h2>
        <p>Quantity: {userPosition.quantity}</p>
        <p>PnL: {userPosition.pnl}</p>
      </div>
      <div>
        <h2>Submit Order</h2>
        <select value={orderType} onChange={e => setOrderType(e.target.value)}>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantity" />
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" />
        <button onClick={submitOrder}>Submit Order</button>
      </div>
    </div>
  );
};

export default App;
