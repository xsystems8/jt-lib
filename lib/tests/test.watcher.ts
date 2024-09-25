import { globals } from '../globals';

import { BalanceWatcher } from './Watchers/balance-watcher';
import { OrdersWatcher } from './Watchers/orders-watcher';
import { OrdersWatcherPriority } from './Watchers/orders.watcher.priority';
import { PositionsWatcher } from './Watchers/positions-watcher';

import { Watcher } from './Watchers/watcher';

import { logOnce, trace } from '../log';
import { TestWatcherParams } from './types';

export class TestWatcher extends Watcher {
  private ordersWatcher: OrdersWatcher;
  private ordersWatcherPriority: OrdersWatcherPriority;
  private positionsWatcher: PositionsWatcher;

  isHedged = true;
  posSlot = {};
  profit = 0;

  /**
   * Creates an instance of TestWatcher. After creating an instance, you need to call the init() method.
   * Watcher is a class that monitors how the Strategy tester works.
   * @param params -
   * @example
   * const watcher = new TestWatcher();
   * watcher.init();
   */
  constructor(params?: TestWatcherParams) {
    super();

    //TODO change to false
    this.isHedged = globals.strategy.hedgeMode;
    globals.events.subscribe('onAfterTick', this.onAfterTick, this);
    // globals.events.subscribe('onInit', this.initA, this);

    return this;
  }

  async onAfterTick() {
    if (!isTester()) {
      await globals.events.emit('onTickEnded');
    }
  }
  async initA() {
    trace('TestWatcher:init', 'init');

    //    this.balanceWatcher = new BalanceWatcher();
    this.ordersWatcher = new OrdersWatcher();
    this.ordersWatcherPriority = new OrdersWatcherPriority();
    this.positionsWatcher = new PositionsWatcher();
    //this.candlesWatcher = new CandlesWatcher();
    return this;
  }
}
