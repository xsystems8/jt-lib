import { Observer } from './observer';
import { globals } from '../../globals';
import { log } from '../../log';

export class PositionObserver extends Observer {
  private closedOrders: Order[] = [];
  private tickOrderBuffer: Order[] = [];

  constructor() {
    super(PositionObserver.name);

    globals.events.subscribe('onOrderChange', this.onOrderChange, this);
    globals.events.subscribe('onTickEnded', this.onTickEnded, this);
  }

  async onOrderChange(order: Order) {
    log('ORDER', 'ORDER', { order }, true);

    if (order.status !== 'closed') return;

    this.closedOrders.push(order);
    this.tickOrderBuffer.push(order);
  }

  async onTickEnded() {
    for (const order of this.tickOrderBuffer) {
      await this.checkPositionEntryPrice(order);
      await this.checkPositionContracts(order);
    }

    this.tickOrderBuffer = [];
  }

  private async checkPositionEntryPrice(order: Order) {
    const apiPosition = (await getPositions([order.symbol]))[0];

    let totalValue = 0;
    let contracts = 0;

    for (const closed of this.closedOrders) {
      if (closed.symbol !== order.symbol || closed.side !== 'buy') continue;
      totalValue += closed.amount * closed.price;
      contracts += closed.amount;
    }

    const entryPrice = totalValue ? totalValue / contracts : order.price;

    if (apiPosition.entryPrice.toFixed(5) !== entryPrice.toFixed(5)) {
      this.error('Position entryPrice is not correct', {
        expected: entryPrice,
        received: apiPosition.entryPrice,
        position: apiPosition,
      });

      return;
    }
  }

  private async checkPositionContracts(order: Order) {
    const apiPosition = (await getPositions([order.symbol]))[0];
    const contracts = this.closedOrders.reduce(
      (res, order) => (order.side === 'buy' ? res + order.amount : res - order.amount),
      0,
    );

    if (apiPosition.contracts !== contracts) {
      this.error('Position contracts is not correct', {
        expected: contracts,
        received: apiPosition.contracts,
        position: apiPosition,
        order,
      });

      return;
    }
  }
}
