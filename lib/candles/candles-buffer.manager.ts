import { BaseObject } from '../base-object';
import { CandlesBuffer, CandlesBufferOptions } from './candles-buffer';

export class CandlesBufferManager extends BaseObject {
  private readonly bufferMap: Record<string, CandlesBuffer> = {};

  async createBuffer(options: CandlesBufferOptions): Promise<CandlesBuffer> {
    const { symbol, timeframe } = options;
    const key = `${symbol}-${timeframe}`;

    if (this.bufferMap[key]) return this.bufferMap[key];

    const buffer = new CandlesBuffer(options);
    await buffer.init();

    this.bufferMap[key] = buffer;

    return buffer;
  }
}
