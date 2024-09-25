import { BaseObject } from '../base-object';
import { CandlesBuffer, getCandlesBuffer } from '../candles-buffer';
import { trace } from '../log';
import { BufferIndicatorItem } from './types';

export const indicatorsMap = new Map<string, Indicator>();

export class Indicator extends BaseObject {
  private readonly symbol: string;
  private readonly timeframe: string;
  private readonly key: string;
  protected candlesBuffer: CandlesBuffer;
  protected buffer: BufferIndicatorItem[] = [];

  constructor(symbol: string, timeframe: string, key: string) {
    super();
    this.candlesBuffer = getCandlesBuffer(symbol, timeframe);

    trace('Indicator:constructor', '', {
      class: this.candlesBuffer?.constructor?.name + ' ',
      buffId: this.candlesBuffer?.id + ' ',
      symbol: symbol,
      timeframe: timeframe,
      key: key,
      bufferKeys: Object.keys(indicatorsMap),
    });
    if (this.candlesBuffer?.constructor?.name !== 'CandlesBuffer') {
      throw new Error(
        `Indicator:constructor - candlesBuffer(${symbol},${timeframe}) should be created before indicator in OnInit()`,
      );
    }

    //candlesBuffer should be created before indicator
    //TODO show error if candlesBuffer not created

    this.key = key;
    this.symbol = symbol;
    this.timeframe = timeframe;
  }

  clear() {
    this.buffer = [];
  }

  getValue(shift = 0) {
    return this.buffer[this.buffer.length - shift].value;
  }

  getIndicatorValues() {
    return this.buffer;
  }
}
