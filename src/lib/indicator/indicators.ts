import { BaseObject } from '../base-object';
import { RelativeStrengthIndex } from './rsi';
import { SimpleMovingAverageIndicator } from './sma';
import { globals } from '../globals';

export class Indicators extends BaseObject {
  async rsi(symbol: string, timeframe: TimeFrame, period = 14): Promise<RelativeStrengthIndex> {
    const candlesBuffer = await globals.candlesBufferService.getBuffer({ symbol, timeframe });
    return new RelativeStrengthIndex(candlesBuffer, { symbol, timeframe, period });
  }

  async sma(symbol: string, timeframe: TimeFrame, period = 14): Promise<SimpleMovingAverageIndicator> {
    const candlesBuffer = await globals.candlesBufferService.getBuffer({ symbol, timeframe });
    return new SimpleMovingAverageIndicator(candlesBuffer, { symbol, timeframe, period });
  }
}