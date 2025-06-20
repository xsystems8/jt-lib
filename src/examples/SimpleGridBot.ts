import { Script } from '../lib/script';
import { StandardReportLayout } from '../lib/report/layouts/standart.report.layout';
import { globals } from '../lib/core/globals';
import { currentTime } from '../lib/utils/date-time';
import { SimpleGridBasket } from './basket/SimpleGridBasket';

class Strategy extends Script {
  static definedArgs = [
    {
      key: 'symbols',
      defaultValue: 'BCH/USDT,BTC/USDT,ADA/USDT,ETH/USDT,XRP/USDT,TRX/USDT,SOL/USDT,LTC/USDT,BNB/USDT,DOGE/USDT',
      mode: 'tester',
    },
    {
      key: 'sizeUsd',
      defaultValue: 100,
    },
    {
      key: 'gridStepPercent',
      defaultValue: 5,
    },
  ];
  baskets: Record<string, SimpleGridBasket> = {};
  private reportLayout: StandardReportLayout;

  async onInit() {
    this.reportLayout = new StandardReportLayout();

    globals.triggers.addTaskByTime({
      callback: this.createBaskets,
      triggerTime: currentTime() + 60 * 1000,
      name: 'createBaskets',
    });
  }

  // Create a basket for each symbol
  createBaskets = async () => {
    for (const symbol of this.symbols) {
      this.baskets[symbol] = new SimpleGridBasket({
        symbol,
        connectionName: this.connectionName,
      });

      await this.baskets[symbol].init();
    }
  };
}
