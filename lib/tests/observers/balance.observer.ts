import { Observer } from './observer';

import { globals } from '../../globals';
import { ObserverBalance } from './types';

export class BalanceObserver extends Observer {
  private tickOrderBuffer: Order[] = [];

  private observerBalance: ObserverBalance = {
    total: { USDT: ARGS.balance },
    free: { USDT: ARGS.balance },
    used: { USDT: 0 },
  };

  constructor() {
    super(BalanceObserver.name);

    globals.events.subscribe('onOrderChange', this.onOrderChange, this);
    globals.events.subscribe('onTickEnded', this.onTickEnded, this);
  }

  async onOrderChange(order: Order) {
    if (order.status !== 'closed') return;
    this.tickOrderBuffer.push(order);
  }

  async onTickEnded() {
    // const balance = await getBalance();

    // for (const order of this.tickOrderBuffer) {
    //   if (order.side === 'buy') {
    //     const expectedBalance = this.observerBalance.free.USDT - order.price * order.amount;
    //
    //     if (expectedBalance !== parseFloat(balance.free.USDT)) {
    //       this.error('Incorrect free USDT balance after order execution', {
    //         expected: expectedBalance,
    //         received: parseFloat(balance.free.USDT),
    //         order,
    //       });
    //     }
    //   }
    // }

    this.tickOrderBuffer = [];
  }
}
