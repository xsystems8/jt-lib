import { Indicator, indicatorsMap } from './indicator';
import { normalize } from '../utils/numbers';
import { getCandlesBuffer } from '../candles-buffer';

interface SimpleMovingAverageIndicatorOptions {
  period: number;
}

class SimpleMovingAverageIndicator extends Indicator {
  private readonly period: number;
  _firstValue = 0;
  _lastIndex = 0;
  _sum = 0;

  constructor(symbol: string, timeframe: string, key: string, options: SimpleMovingAverageIndicatorOptions) {
    super(symbol, timeframe, key);
    this.period = options.period;
  }

  async onCandlesBufferNewCandle() {
    this.onCalculate();
  }

  onCandlesBufferUpdate() {
    if (!this.buffer.length) return;

    const candles = this.candlesBuffer.getCandles();
    const candle = candles[candles.length - 1];

    const sum = normalize(this._sum - this._firstValue + candle.close);
    const avg = normalize(sum / this.period);

    this.buffer[this.buffer.length - 1] = { timestamp: candle.timestamp, value: avg };
  }

  onCalculate() {
    const candles = this.candlesBuffer.getCandles();

    if (candles.length < this.period) return;

    if (this._lastIndex === 0) {
      this._firstValue = candles[0].close;

      for (let i = 0; i < this.period; i++) {
        this._sum += candles[i].close;
      }

      this._lastIndex = this.period - 1;
      const avg = normalize(this._sum / this.period);
      this.buffer.push({ timestamp: candles[this.period - 1].timestamp, value: avg });
    }

    const startIndex = this._lastIndex + 1;

    for (let i = startIndex; i < candles.length; i++) {
      this._sum = normalize(this._sum - this._firstValue + candles[i].close);
      this._firstValue = candles[i - this.period + 1].close;
      const avg = normalize(this._sum / this.period);
      this.buffer.push({ timestamp: candles[i].timestamp, value: avg });
      this._lastIndex = i;
    }
  }

  getIndicatorValues() {
    if (!this.buffer.length) {
      this.onCalculate();
    }

    return this.buffer;
  }
}

export const getSMAValues = (symbol: string, timeframe: string, period = 14) => {
  const key = `sma_${symbol}_${timeframe}_${period}`;
  let indicator = indicatorsMap.get(key);
  if (!indicator) {
    indicator = new SimpleMovingAverageIndicator(symbol, timeframe, key, { period });
    indicatorsMap.set(key, indicator);
    return indicator.getIndicatorValues();
  } else {
    return indicator.getIndicatorValues();
  }
};

export const sma = (symbol: string, timeframe: string, period = 14, shift = 0) => {
  const key = `rsi_${symbol}_${timeframe}_${period}`;
  let indicator = indicatorsMap.get(key);
  if (!indicator) {
    indicator = new SimpleMovingAverageIndicator(symbol, timeframe, key, { period });
    indicatorsMap.set(key, indicator);
  }

  return indicator.getValue(shift);
};
