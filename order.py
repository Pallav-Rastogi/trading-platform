import time
from queue import Queue
from pymongo import MongoClient
from bson.objectid import ObjectId

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['trading_platform']

# Collections
orders = db['orders']
users = db['users']
trades = db['trades']

# Queues for storing incoming orders
buy_queue = Queue()
sell_queue = Queue()

def add_order(order):
    """Add an order to the appropriate queue."""
    if order['type'] == 'buy':
        buy_queue.put(order)
    elif order['type'] == 'sell':
        sell_queue.put(order)

def match_orders():
    """Match orders and update the database."""
    # Sort orders by price and time
    buy_orders = sorted(list(buy_queue.queue), key=lambda x: (-x['price'], x['timestamp']))
    sell_orders = sorted(list(sell_queue.queue), key=lambda x: (x['price'], x['timestamp']))

    matched_buys = []
    matched_sells = []

    for buy in buy_orders:
        for sell in sell_orders:
            if buy['price'] >= sell['price']:
                trade_quantity = min(buy['quantity'], sell['quantity'])
                trade_price = sell['price']

                # Update order quantities
                buy['quantity'] -= trade_quantity
                sell['quantity'] -= trade_quantity

                # Update user positions and PnL
                update_user(buy['userId'], trade_quantity, trade_price, 'buy')
                update_user(sell['userId'], trade_quantity, trade_price, 'sell')

                # Record the trade
                record_trade(buy, sell, trade_quantity, trade_price)

                if buy['quantity'] == 0:
                    matched_buys.append(buy)
                    break
                if sell['quantity'] == 0:
                    matched_sells.append(sell)
            else:
                break

    # Remove matched orders from queues and update database
    for order in matched_buys:
        buy_queue.queue.remove(order)
        update_order_status(order['_id'], 'filled')

    for order in matched_sells:
        sell_queue.queue.remove(order)
        update_order_status(order['_id'], 'filled')

    # Update partially filled orders in database
    for order in buy_queue.queue + sell_queue.queue:
        if order['quantity'] != orders.find_one({'_id': order['_id']})['quantity']:
            update_order_quantity(order['_id'], order['quantity'])

def update_user(user_id, quantity, price, order_type):
    """Update user's position and PnL."""
    user = users.find_one({'_id': ObjectId(user_id)})
    if order_type == 'buy':
        user['position'] += quantity
        user['pnl'] -= quantity * price
    else:  # sell
        user['position'] -= quantity
        user['pnl'] += quantity * price
    users.update_one({'_id': ObjectId(user_id)}, {'$set': user})

def record_trade(buy, sell, quantity, price):
    """Record a trade in the database."""
    trade = {
        'buyOrderId': buy['_id'],
        'sellOrderId': sell['_id'],
        'buyerId': buy['userId'],
        'sellerId': sell['userId'],
        'quantity': quantity,
        'price': price,
        'timestamp': time.time()
    }
    trades.insert_one(trade)

def update_order_status(order_id, status):
    """Update the status of an order in the database."""
    orders.update_one({'_id': ObjectId(order_id)}, {'$set': {'status': status}})

def update_order_quantity(order_id, quantity):
    """Update the quantity of an order in the database."""
    orders.update_one({'_id': ObjectId(order_id)}, {'$set': {'quantity': quantity}})

def order_matching_loop():
    """Main loop for order matching."""
    while True:
        match_orders()
        time.sleep(5)  # Wait for 5 seconds before next matching round

# Start the order matching loop
if __name__ == "__main__":
    order_matching_loop()
