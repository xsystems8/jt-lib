import { BaseObject } from '../base-object';
import { RelativeStrengthIndex } from './rsi';
import { SimpleMovingAverageIndicator } from './sma';
import { globals } from '../globals';

export class Indicator extends BaseObject {
  private rsiIndicators: Record<string, RelativeStrengthIndex> = {};
  private smaIndicators: Record<string, SimpleMovingAverageIndicator> = {};

  async rsi(symbol: string, timeframe: TimeFrame, period = 14, shift = 0) {
    const indicator = await this.getRSIIndicator(symbol, timeframe, period);
    return indicator.getValue(shift);
  }

  async rsiValues(symbol: string, timeframe: TimeFrame, period: number) {
    const indicator = await this.getRSIIndicator(symbol, timeframe, period);
    return indicator.getIndicatorValues();
  }

  async sma(symbol: string, timeframe: TimeFrame, period = 14, shift = 0) {
    const indicator = await this.getSMAIndicator(symbol, timeframe, period);
    return indicator.getValue(shift);
  }

  async smaValues(symbol: string, timeframe: TimeFrame, period: number) {
    const indicator = await this.getSMAIndicator(symbol, timeframe, period);
    return indicator.getIndicatorValues();
  }

  private async getRSIIndicator(symbol: string, timeframe: TimeFrame, period: number) {
    const key = `${symbol}_${timeframe}_${period}`;
    let indicator = this.rsiIndicators[key];

    if (!indicator) {
      const candlesBuffer = await globals.candlesBufferManager.createBuffer({ symbol, timeframe });
      indicator = new RelativeStrengthIndex(candlesBuffer, { symbol, timeframe, period });
      this.rsiIndicators[key] = indicator;
    }

    return indicator;
  }

  private async getSMAIndicator(symbol: string, timeframe: TimeFrame, period: number) {
    const key = `${symbol}_${timeframe}_${period}`;
    let indicator = this.smaIndicators[key];

    if (!indicator) {
      const candlesBuffer = await globals.candlesBufferManager.createBuffer({ symbol, timeframe });
      indicator = new SimpleMovingAverageIndicator(candlesBuffer, { symbol, timeframe, period });
      this.smaIndicators[key] = indicator;
    }

    return indicator;
  }
}
