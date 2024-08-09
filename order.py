import time
from queue import Queue
from pymongo import MongoClient
from bson.objectid import ObjectId

# MongoDB connection
#IP 14.139.38.107/32
#user nitinm23
#pass vSSUeTsf5FwoUEqd
client = MongoClient('mongodb+srv://nitinm23:vSSUeTsf5FwoUEqd@cluster0.e3psu.mongodb.net/')
db = client['trading_platform']

# Collections
orders = db['orders']
users = db['users']
trades = db['trades']

def load_open_orders():
    """Load all open orders from the database."""
    buy_orders = list(orders.find({'type': 'buy', 'status': 'open'}).sort([('price', -1), ('timestamp', 1)]))
    sell_orders = list(orders.find({'type': 'sell', 'status': 'open'}).sort([('price', 1), ('timestamp', 1)]))
    return buy_orders, sell_orders

def match_orders(buy_orders, sell_orders):
    """Match orders and update the database."""
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
                
                # Update orders in database
                if buy['quantity'] == 0:
                    update_order_status(buy['_id'], 'filled')
                else:
                    update_order_quantity(buy['_id'], buy['quantity'])
                
                if sell['quantity'] == 0:
                    update_order_status(sell['_id'], 'filled')
                else:
                    update_order_quantity(sell['_id'], sell['quantity'])
                
                if buy['quantity'] == 0 or sell['quantity'] == 0:
                    break
            else:
                break
        if buy['quantity'] == 0:
            break

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

def main():
    buy_orders, sell_orders = load_open_orders()
    match_orders(buy_orders, sell_orders)
    print("Order matching completed")

if __name__ == "__main__":
    main()