import { globals } from '../../globals';
import { Watcher } from './watcher';
import { currentTimeString, currentTime } from '../../utils/date-time';

/**
 * check execution queue of orders
 */
export class OrdersWatcherPriority extends Watcher {
  constructor() {
    super();

    globals.events.subscribe('onOrderChange', this.onOrderChange, this);
    globals.events.subscribe('onBeforeStop', this.checkOnOrderExecuted, this);
    globals.events.subscribe('onBeforeStop', this.checkCanceledOrders, this);

    registerCallback('createOrder', this.onCreateOrder);
    registerCallback('cancelOrder', this.onCancelOrder);
  }

  orderInfo = {};
  canceledIds = [];
  onCancelOrder = (params: any, result: any) => {
    let id = params[0];

    this.canceledIds.push(id);
    let orderInfo = this.orderInfo[id];
    if (!orderInfo) {
      this.error('OrdersWatcherPriority:onCancelOrder', 'Order not found in orderInfo with id = ' + id, {
        params,
        result,
      });
      return;
    }

    orderInfo.createCancelTime = currentTime();
    orderInfo.createCancelSTime = currentTimeString();
  };
  async checkCanceledOrders() {
    let order: Order;
    let orderInfo;
    for (let id of this.canceledIds) {
      order = await getOrder(id);
      orderInfo = this.orderInfo[id];
      if (order.status !== 'canceled') {
        if (orderInfo.closeTime > orderInfo.createCancelTime) {
          this.error('OrdersWatcherPriority:checkCanceledOrders', 'Order with id = ' + id + ' should be canceled', {
            order: order,
            orderInfo: this.orderInfo[id],
          });
        }
      }
    }
  }

  onCreateOrder = (params, result) => {
    let symbol = params[0];
    let type = params[1];
    let side = params[2];
    let price = params[3];
    let amount = params[4];
    let orderParams = params[5] ?? {};

    let id = result.id;
    let clientOrderId = orderParams.clientOrderId;

    if (this.orderInfo[id]) {
      this.errorOnce(
        'OrdersWatcherPriority:onCreateOrder',
        'order already exists not possible to create order with the same id',
        { params, result },
      );
    }

    this.orderInfo[id] = {
      id: id,
      clientOrderId: clientOrderId,
      description: 'Create time of order taken from callback createOrder, cancelOrder, other from onOrderChange',
      type: type,
      isTriggerOrder: Boolean(orderParams.stopLossPrice || orderParams.takeProfitPrice), // for sl tp
      createTime: currentTime(),
      createSTime: currentTimeString(),
      openTime: null,
      openSTime: null,
      untriggeredTime: null,
      untriggeredSTime: null,
      closeTime: null,
      closeSTime: null,
      createCancelTime: null,
      createCancelSTime: null,
      cancelTime: null,
      cancelSTime: null,
      modifyTime: null,
      modifySTime: null,
      symbol: symbol,
      iterator: 0,
      statusChanging: [],
      order: result,
    };

    if (clientOrderId) {
      this.orderInfo[clientOrderId] = this.orderInfo[id]; // GHJ.M5

      clientOrderId = clientOrderId.split('.')[1];
      if (clientOrderId) {
        this.orderInfo[clientOrderId] = this.orderInfo[id]; // M5
      }
    }
  };

  async onOrderChange(order: Order) {
    await this.checkOrderTime(order);
  }

  async checkOrderTime(order: Order) {
    let orderInfo = this.orderInfo[order.id];

    if (!orderInfo) {
      this.errorOnce('OrdersWatcherPriority:checkOrderTime', 'Order not found in orderInfo', { order });
      return;
    }

    orderInfo.statusChanging.push(order.status);
    orderInfo.iterator++;

    if (order.status === 'open') {
      if (!orderInfo.openTime) {
        orderInfo.openTime = currentTime();
        orderInfo.openSTime = currentTimeString();
      } else {
        this.errorOnce('OrdersWatcherPriority:checkOrderTime', '!!!TODO check is order modify', { order });
      }
    }
    if (order.status === 'untriggered') {
      orderInfo.untriggeredTime = currentTime();
      orderInfo.untriggeredSTime = currentTimeString();
    }
    if (order.status === 'closed') {
      orderInfo.closeTime = currentTime();
      orderInfo.closeSTime = currentTimeString();
    }
    if (order.status === 'canceled') {
      orderInfo.cancelTime = currentTime();
      orderInfo.cancelSTime = currentTimeString();

      if (orderInfo.createCancelTime === null) {
        this.error('OrdersWatcherPriority:checkOrderTime', 'Order canceled by tester env', {
          orderInfo: orderInfo,
          marketInfo: { ask: ask(), bid: bid(), close: close() },
          order,
          positions: await getPositions(),
        });
      }
    }

    if (order.type === 'limit') {
      if (orderInfo.openTime !== orderInfo.createTime && order.status === 'open')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Limit order with status = open should be sent to OnOrderChange at the same candle when it was created',
          { orderInfo: orderInfo, order: order },
        );

      if (orderInfo.openTime >= orderInfo.closeTime && order.status === 'close')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Limit order with status = close could be executed only on next candles after it was open',
          { orderInfo: orderInfo, order: order },
        );
    }

    if (order.type === 'market') {
      if (orderInfo.openTime !== orderInfo.createTime && order.status === 'open')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Market order with status = open should be sent to OnOrderChange at the same candle when it was created',
          { orderInfo: orderInfo, order: order },
        );

      if (orderInfo.openTime !== orderInfo.closeTime && order.status === 'close')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Market order with status = close could be executed on the same candle when it was created ',
          { orderInfo: orderInfo, order: order },
        );
    }
    // this.orderInfo[order.id] = orderInfo;
    //trace('OrdersWatcherPriority:checkOrderTime', '', orderInfo);
  }

  async checkOnOrderExecuted() {
    for (const id in this.orderInfo) {
      let orderInfo = this.orderInfo[id];
      if (tms() <= orderInfo.createTime) {
        continue;
      }
      if (orderInfo.type === 'market') {
        if (!orderInfo.isTriggerOrder) {
          if (orderInfo.openTime === null || orderInfo.closeTime === null) {
            this.error('OrdersWatcherPriority:onStop', 'onOrderChange() was not executed for market order', {
              orderInfo: orderInfo,
            });
          }
        } else {
          if (orderInfo.untriggeredTime === null) {
            this.error('OrdersWatcherPriority:onStop', 'onOrderChange() was not executed for market order', {
              orderInfo: orderInfo,
            });
          }
        }
      }

      if (orderInfo.type === 'limit') {
        if (orderInfo.openTime === null) {
          this.error('OrdersWatcherPriority:onStop', 'onOrderChange() was not executed for limit order', {
            orderInfo: orderInfo,
          });
        }
      }
    }
  }
}
