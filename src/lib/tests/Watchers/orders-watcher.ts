import { globals } from '../../globals';
import { Watcher } from './watcher';
import { checkOrderStructure } from '../helpers';
import { currentTimeString, currentTime } from '../../utils/date-time';
import { isZero } from '../../utils/numbers';

/**
 * Check order execution and order structure
 *
 */
export class OrdersWatcher extends Watcher {
  orderInfoById = {};
  orderById = {};
  feeTaker = 0;
  takerVoluve = 0;
  feeMaker = 0;
  makerVolume = 0;
  limitOrdersCnt = 0;
  marketOrdersCnt = 0;
  constructor() {
    super();

    //globals.events.subscribe('onOrderChange', this.updateOrderInfo, this);
    globals.events.subscribe('onOrderChange', this.checkOrder, this);
    globals.events.subscribe('onTickEnded', this.onTickEnded, this);
    globals.events.subscribe('onStop', this.onStop, this);
  }

  async checkOrder(order: Order) {
    if (!this.orderById[order.id]) {
      this.orderById[order.id] = [];
    }

    this.orderById[order.id].push(order);

    if (order.type === 'limit' && order.status === 'open') {
      //place task to check limit order execution on order.price
      // TODO: неправильно передаются аргументы
      // globals.triggers.addTaskByPriceC(order.price, this.checkLimitExecuted, { order: order, doubleTaskId: order.id });
    }

    this.updateOrderInfo(order);

    //check order structure
    this.addErrors(checkOrderStructure(order));

    //Check spread
    if (order.status === 'closed' && order.type === 'market') {
      let halfSpread = Math.abs(close() - order.price);
      let testerSpread = close() * ARGS.marketOrderSpread;
      if (!isZero(2 * halfSpread - testerSpread)) {
        this.errorOnce('checkOrder', 'Spread is not correct', {
          halfSpread: halfSpread,
          calcSpread: 2 * halfSpread,
          testerSpread: testerSpread,
          marketOrderSpread: ARGS.marketOrderSpread,
          marketInfo: { h: high(), l: low(), c: close(), o: open(), t: tms() },
          order: order,
        });
      }
    }
    //
    if (order.amount <= 0) {
      this.error('checkOrder', 'Order amount is not correct amount = ' + order.amount, {
        order: order,
      });
    }

    //fee check
    if (order.status === 'closed') {
      if (order.type === 'market') {
        this.feeTaker += order.price * order.amount * ARGS.takerFee;
        this.takerVoluve += order.amount * order.price;
        this.marketOrdersCnt++;
      }
      if (order.type === 'limit') {
        this.feeMaker += order.price * order.amount * ARGS.makerFee;
        this.makerVolume += order.amount * order.price;
        this.limitOrdersCnt++;
      }
    }
  }

  async onStop() {
    let feeCalc = this.feeTaker + this.feeMaker;
    let feeApi = isTester() ? getFee() : 0; // runtime does not have getFee() function

    if (!isZero(feeCalc - feeApi)) {
      this.errorOnce('onStop', 'Fee is not correct ', {
        feeCalc: feeCalc,
        feeApi: feeApi,
        feeTaker: this.feeTaker,
        feeMaker: this.feeMaker,
        takerVoluve: this.takerVoluve,
        makerVolume: this.makerVolume,
        marketOrdersCnt: this.marketOrdersCnt,
        limitOrdersCnt: this.limitOrdersCnt,
      });
    }
  }
  //
  limitOrdersToCheck = [];
  checkLimitExecuted = async (params: any) => {
    let order = params.order;
    //all orders will be checked at the end of the tick in onTickEnded
    this.limitOrdersToCheck.push(order);
  };

  async onTickEnded() {
    if (this.limitOrdersToCheck.length > 0) {
      for (let order of this.limitOrdersToCheck) {
        let id = order.id;
        let lastOrder = this.orderById[id][this.orderById[id].length - 1];

        if (lastOrder.status !== 'close' && lastOrder.status !== 'canceled') {
          this.errorOnce('checkLimitExecuted', 'Limit order not executed at ' + order.price, {
            order: order,
            lastOrder: lastOrder,
          });
        }
      }
    }
  }

  updateOrderInfo(order: Order) {
    if (!this.orderInfoById[order.id]) {
      this.orderInfoById[order.id] = {
        type: order.type,
      };
    }
    let orderInfo = this.orderInfoById[order.id];

    if (order.status === 'open') {
      if (orderInfo.openTime) {
        //TODO check if order was changed
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          comment: '!!!it could because order was changed',
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.openTime = order.timestamp;
    }

    if (order.status === 'filled') {
      orderInfo.filledTime = order.timestamp;
    }

    if (order.status === 'closed') {
      if (orderInfo.closedTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.closedTime = order.timestamp;
    }

    if (order.status === 'canceled') {
      if (orderInfo.canceledTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.canceledTime = order.timestamp;
    }

    if (order.status === 'rejected') {
      if (orderInfo.rejectedTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.rejectedTime = order.timestamp;
    }
  }
}
