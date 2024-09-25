import { Observer } from './observer';
import { isZero } from '../../utils/numbers';
import { ObserverOrder } from './types';
import { globals } from '../../globals';
import { uniqueId } from '../../base';

/**
 * Check order execution and order structure
 */
export class OrderObserver extends Observer {
  private orders: Record<string, ObserverOrder[]> = {};

  private tickOrderBuffer: Record<string, ObserverOrder[]> = {};

  private feeTaker = 0;
  private takerVolume = 0;
  private feeMaker = 0;
  private makerVolume = 0;
  private limitOrdersCnt = 0;
  private marketOrdersCnt = 0;

  constructor() {
    super(OrderObserver.name);

    globals.events.subscribe('onOrderChange', this.checkOrder, this);
    globals.events.subscribe('onTickEnded', this.onTickEnded, this);
    globals.events.subscribe('onStop', this.onStop, this);
  }

  async checkOrder(order: Order) {
    if (!this.orders[order.id]) {
      this.orders[order.id] = [];
    }

    if (!this.tickOrderBuffer[order.id]) {
      this.tickOrderBuffer[order.id] = [];
    }

    const copy = { ...order, uid: uniqueId(10) };
    this.orders[order.id].push(copy);
    this.tickOrderBuffer[order.id].push(copy);

    this.validateOrderSchema(order);
    this.calculateFee(order);

    if (order.type === 'market') {
      this.runMarketOrderTests(order);
    }

    if (order.type === 'limit') {
      this.runLimitOrderTests(order);
    }

    if (order.amount <= 0) {
      this.error('Order amount is not correct amount = ' + order.amount, {
        order: order,
      });
    }
  }

  async onTickEnded() {
    this.checkMarketOrders();
  }

  async onStop() {
    let feeCalc = this.feeTaker + this.feeMaker;
    let feeApi = isTester() ? getFee() : 0; // runtime does not have getFee() function

    if (!isZero(feeCalc - feeApi)) {
      this.errorOnce('Fee is not correct ', {
        feeCalc: feeCalc,
        feeApi: feeApi,
        feeTaker: this.feeTaker,
        feeMaker: this.feeMaker,
        takerVolume: this.takerVolume,
        makerVolume: this.makerVolume,
        marketOrdersCnt: this.marketOrdersCnt,
        limitOrdersCnt: this.limitOrdersCnt,
      });
    }
  }

  private runMarketOrderTests(order: Order) {
    switch (order.status) {
      case 'open':
        // the market order must be executed on the same candle
        if (order.timestamp !== tms()) {
          this.error('The market order was not executed on the current candle', { order });
        }
        break;
      case 'closed':
        this.validateSpread(order);

        const minPrice = close() - ARGS.marketOrderSpread;
        const maxPrice = close() + ARGS.marketOrderSpread;

        if (order.price < minPrice || order.price > maxPrice) {
          this.error('The market order was executed at the wrong price', {
            order,
            currentClose: close(),
          });
        }
        break;
    }
  }

  private runLimitOrderTests(order: Order) {
    switch (order.status) {
      case 'closed':
        const currentTickOrder = this.tickOrderBuffer[order.id]?.find((order) => order.type === 'open');
        if (currentTickOrder) {
          this.error('A limit order should not be executed on the same candle that was placed', {
            open: currentTickOrder,
            close: order,
          });
        }

        const openOrder = this._getOpenOrder(order.id);

        if (!openOrder) {
          this.error('Opening limit order not found', { closed: order });
          break;
        }

        if (order.side === 'buy' && order.price >= high()) {
          this.error('Limit order filled before trigger price', {
            open: openOrder,
            closed: order,
            price: high(),
          });
        }

        if (order.side === 'sell' && order.price <= low()) {
          this.error('Limit order filled before trigger price', {
            open: openOrder,
            closed: order,
            price: low(),
          });
        }

        const minPrice = openOrder.price - ARGS.marketOrderSpread;
        const maxPrice = openOrder.price + ARGS.marketOrderSpread;

        if (order.price < minPrice || order.price > maxPrice) {
          this.error('The limit order was executed at the wrong price', {
            open: openOrder,
            closed: order,
          });
        }

        break;
    }
  }

  private validateSpread(order: Order) {
    const halfSpread = Math.abs(close() - order.price);
    const testerSpread = close() * ARGS.marketOrderSpread;

    if (!isZero(2 * halfSpread - testerSpread)) {
      this.errorOnce('Spread is not correct', {
        halfSpread: halfSpread,
        calcSpread: 2 * halfSpread,
        testerSpread: testerSpread,
        marketOrderSpread: ARGS.marketOrderSpread,
        marketInfo: { h: high(), l: low(), c: close(), o: open(), t: tms() },
        order: order,
      });
    }
  }

  private validateOrderSchema(order: Order) {
    const schema = {
      id: 'string',
      clientOrderId: 'string',
      datetime: 'string',
      timestamp: 'number',
      lastTradeTimestamp: 'number',
      status: 'string', //'open' | 'closed' | 'canceled' |
      symbol: 'string',
      type: 'string',
      timeInForce: 'string',
      side: 'string',
      price: 'number',
      average: 'number',
      amount: 'number',
      filled: 'number',
      remaining: 'number',
      cost: 'number',
      trades: 'any',
      fee: 'any',
      info: 'any',
      reduceOnly: 'boolean',
    };

    const orderProps = Object.keys(schema);
    const errors = [];

    for (const prop of orderProps) {
      if (order[prop] === undefined) {
        errors.push({ message: 'Order has no key: ' + prop, params: { order: order } });
      }

      if (schema[prop] === 'any') continue;

      if (typeof order[prop] !== schema[prop]) {
        errors.push({
          message: 'Order has wrong type of key: ' + prop + ' type should be ' + schema[prop],
          params: { order: order },
        });
      }
    }

    const maxDigits = 100000000;

    if (Math.round(order.amount * maxDigits) / maxDigits <= 0) {
      errors.push({
        message: 'Order has wrong amount: ' + order.amount,
        params: { order: order },
      });
    }

    //price
    if (order.price < 0 || !order.price) {
      errors.push({
        message: 'Order has wrong price: ' + order.price,
        params: { order: order },
      });
    }

    //side
    if (order.side !== 'buy' && order.side !== 'sell') {
      errors.push({
        message: 'Order has wrong side: ' + order.side,
        params: { order: order },
      });
    }

    //amount
    if (order.amount <= 0 || !order.amount) {
      errors.push({
        message: 'Order has wrong amount: ' + order.amount,
        params: { order: order },
      });
    }

    //status
    if (
      order.status !== 'open' &&
      order.status !== 'closed' &&
      order.status !== 'canceled' &&
      order.status !== 'expired' &&
      order.status !== 'rejected' &&
      order.status !== 'untriggered'
    ) {
      errors.push({
        message: 'Order has wrong status: ' + order.status,
        params: { order: order },
      });
    }

    //type
    if (
      order.type !== 'limit' &&
      order.type !== 'market' &&
      order.type !== 'stop' &&
      order.type !== 'stop-limit' &&
      order.type !== 'trailing-stop' &&
      order.type !== 'fill-or-kill' &&
      order.type !== 'immediate-or-cancel'
    ) {
      errors.push({
        message: 'Order has wrong type: ' + order.type,
        params: { order: order },
      });
    }

    errors.forEach((error) => {
      this.error(error.message, error.params);
    });
  }

  private calculateFee(order: Order) {
    if (order.status === 'closed') {
      if (order.type === 'market') {
        this.feeTaker += order.price * order.amount * ARGS.takerFee;
        this.takerVolume += order.amount * order.price;
        this.marketOrdersCnt++;
      }
      if (order.type === 'limit') {
        this.feeMaker += order.price * order.amount * ARGS.makerFee;
        this.makerVolume += order.amount * order.price;
        this.limitOrdersCnt++;
      }
    }
  }

  private checkMarketOrders() {
    for (const orderId in this.tickOrderBuffer) {
      const marketOrders = this.tickOrderBuffer[orderId].filter((order) => order.type === 'market');
      if (!marketOrders.length) continue;
      if (marketOrders.length < 2) {
        this.error('Two orders are expected (open, closed) when opening an order at the market price', {
          orders: this.orders[orderId],
        });
      }
    }

    this.tickOrderBuffer = {};
  }

  private _getOpenOrder(orderId: string) {
    const orders = this.orders[orderId].filter((order) => order.status === 'open');

    if (orders.length === 1) {
      return orders[0];
    }

    const lastOrder = orders.sort((a, b) => b.timestamp - a.timestamp)[0];
    const modified = orders.filter((order) => order.timestamp === lastOrder.timestamp);

    if (modified.length === 1) return lastOrder;

    return modified.sort((a, b) => b.price - a.price)[0];
  }

  private checkOrdersSummary() {
    const ordersCounter: Record<string, number> = {};

    Object.values(this.orders).map((orders) => orders.flat());
  }
}
