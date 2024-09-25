import { Indicator, indicatorsMap } from './indicator';
import { normalize } from '../utils/numbers';

interface RelativeStrengthIndexOptions {
  period: number;
}

class RelativeStrengthIndex extends Indicator {
  private readonly period: number;

  constructor(symbol: string, timeframe: string, key: string, options: RelativeStrengthIndexOptions) {
    super(symbol, timeframe, key);

    this.period = options.period;
  }

  _lastIndex = 0;
  _lastTimeUpdated = 0;
  _positiveBuffer = [];
  _negativeBuffer = [];

  onCalculate() {
    const candles = this.candlesBuffer.getCandles();

    if (this._lastTimeUpdated >= this.candlesBuffer.getLastTimeUpdated()) return;
    if (candles.length <= this.period) return;

    // first calc
    if (this._lastIndex === 0) {
      this.buffer.push({ timestamp: candles[0].timestamp, value: 0 });
      this._positiveBuffer.push(0);
      this._negativeBuffer.push(0);

      let sumP = 0;
      let sumN = 0;

      for (let i = 1; i < this.period; i++) {
        this.buffer[i] = { timestamp: candles[i].timestamp, value: 0 };
        this._positiveBuffer[i] = 0;
        this._negativeBuffer[i] = 0;
        const diff = candles[i].close - candles[i - 1].close;
        sumP += diff > 0 ? diff : 0;
        sumN += diff < 0 ? -diff : 0;
      }

      this._positiveBuffer[this.period] = sumP / this.period;
      this._negativeBuffer[this.period] = sumN / this.period;
      this.buffer[this.period] = {
        timestamp: candles[this.period].timestamp,
        value: normalize(100 - 100 / (1 + this._positiveBuffer[this.period] / this._negativeBuffer[this.period])),
      };
      this._lastIndex = this.period - 1;
    }

    const startIndex = this._lastIndex + 1;

    for (let i = startIndex; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      this._positiveBuffer[i] = (this._positiveBuffer[i - 1] * (this.period - 1) + (diff > 0 ? diff : 0)) / this.period;
      this._negativeBuffer[i] =
        (this._negativeBuffer[i - 1] * (this.period - 1) + (diff < 0 ? -diff : 0)) / this.period;
      this.buffer[i] = {
        timestamp: candles[i].timestamp,
        value: normalize(100 - 100 / (1 + this._positiveBuffer[i] / this._negativeBuffer[i])),
      };
      this._lastTimeUpdated = candles[i].timestamp;
      this._lastIndex = i;
    }
  }

  getIndicatorValues() {
    if (!this.buffer.length) {
      this.onCalculate();
    }

    return this.buffer;
  }

  getValue(shift = 0) {
    this.onCalculate();
    return this.buffer[this._lastIndex - shift].value;
  }
}

export const getRSIValues = (symbol: string, timeframe: string, period = 14) => {
  const key = `rsi_${symbol}_${timeframe}_${period}`;
  let indicator = indicatorsMap.get(key);
  if (!indicator) {
    indicator = new RelativeStrengthIndex(symbol, timeframe, key, { period });
    indicatorsMap.set(key, indicator);
    return indicator.getIndicatorValues();
  } else {
    return indicator.getIndicatorValues();
  }
};

/**
 * Relative Strength Index (RSI)
 * @param symbol - symbol name
 * @param timeframe - timeframe name (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
 * @param period - period length (14)
 * @param shift - shift relative to current candle (0)
 * @returns {*}
 */
export const rsi = (symbol: string, timeframe: string, period = 14, shift = 0): any => {
  const key = `rsi_${symbol}_${timeframe}_${period}`;
  let indicator = indicatorsMap.get(key);
  if (!indicator) {
    indicator = new RelativeStrengthIndex(symbol, timeframe, key, { period });
    indicatorsMap.set(key, indicator);
  }

  return indicator.getValue(shift);
};
