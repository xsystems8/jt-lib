import { Watcher } from './watcher';

export class BalanceWatcher extends Watcher {
  private readonly profit: number;
  private readonly tolerance: number;

  constructor() {
    super();
  }

  checkProfitAndBalance = async () => {
    let testerProfit = await getProfit();

    if (Math.abs(testerProfit - this.profit) > this.tolerance) {
      this.errorOnce('checkProfitAndBalance', 'testerProfit != this.profit', {
        testerProfit: testerProfit,
        thisProfit: this.profit,
      });
    }
  };
}
