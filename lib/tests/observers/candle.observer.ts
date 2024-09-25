import { globals } from '../../globals';
import { Observer } from './observer';

import { currentTimeString, currentTime } from '../../utils/date-time';

export class CandleObserver extends Observer {
  private prevTime = 0;
  private candleHoles = [];
  private period = 0; //period detected on second candle

  constructor() {
    super(CandleObserver.name);
    globals.events.subscribe('onAfterTick', this.checkCandlesHoles, this);
  }

  onStop = async () => {
    if (this.candleHoles.length > 0) {
      this.error('Candles holes detected', this.candleHoles);
    }
  };

  async checkCandlesHoles() {
    if (this.prevTime === 0) {
      this.prevTime = currentTime();
      return;
    }

    if (this.period === 0) {
      this.period = currentTime() - this.prevTime;
      return;
    }

    if (this.candleHoles.length > 20) return;

    const diffMin = currentTime() - this.prevTime;
    if (diffMin !== this.period) {
      this.candleHoles.push({ time: currentTimeString(), diffMin });
    }

    this.prevTime = currentTime();
  }
}
