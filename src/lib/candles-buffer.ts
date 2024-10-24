import {
  roundTimeByTimeframe,
  convertTimeframeToString,
  calculateCandlesInMonth,
  convertTimeframeToNumber,
} from './utils/timeframe';
import { error, log, trace, warning } from './log';
import { EventEmitter } from './events';
import { globals } from './globals';
import { timeToString } from './utils/date-time';
import { BaseObject } from './base-object';

const candlesBufferMap = {};

interface CandlesBufferOptions {
  symbol: string;
  timeframe: string | number;
  maxBufferLength: number;
  preloadCandlesCount: number;
}

export class CandlesBuffer extends BaseObject {
  private readonly tfS: string;
  private readonly tfN: number;
  private readonly symbol: string;
  private readonly _preloadCandlesCount: number;
  private readonly _maxBufferLength: number;
  private readonly emitter: EventEmitter;
  private _isInitialized = false;
  private _buffer = [];
  private _lastTimeUpdated = null;
  private currentCandle: Candle = null;

  constructor(options: CandlesBufferOptions) {
    super();
    const { timeframe, maxBufferLength = 100, symbol, preloadCandlesCount = 30 } = options;
    this.tfS = convertTimeframeToString(timeframe);
    this.tfN = convertTimeframeToNumber(timeframe);

    this.symbol = symbol;
    this._maxBufferLength = maxBufferLength;
    this._preloadCandlesCount = preloadCandlesCount;
    this.emitter = new EventEmitter({ idPrefix: 'CandlesBufferEmitter' });
  }

  getCandles() {
    return this._buffer;
  }

  clear() {
    this._buffer = [];
  }

  async init() {
    if (this._isInitialized) return;

    globals.events.subscribe('onBeforeTick', this.updateBuffer, this);

    let startTime = Date.now() - this._preloadCandlesCount * this.tfN * 1000 * 60;
    const startTimestamp = ARGS.startDate.getTime();
    if (isTester()) {
      startTime = startTimestamp - this._preloadCandlesCount * this.tfN * 1000 * 60;
    }

    try {
      //TODO fix getHistory() it should return candles from startTime and exact count of _preloadCandlesCount
      // add volume to candle data
      let historyCandles = [];
      if (1) {
        //Delete this after getHistory will be fixed
        let fullMonth = calculateCandlesInMonth(startTime) + 1;
        // historyCandles = await getHistory(this.tfN, startTime, fullMonth);

        historyCandles = historyCandles.slice(-this._preloadCandlesCount);
      } else {
        // historyCandles = await getHistory(this.tfN, startTime, this._preloadCandlesCount);
      }

      //  global.report.tableUpdate('historyCandles', historyCandles.slice(-10));
      trace('CandlesBuffer:init', 'historyCandles', {
        count: historyCandles.length,
        startTime: startTime,
        startTimestamp: startTimestamp,
        timeframe: this.tfS,
        startTimeHuman: timeToString(startTime),
        _preloadCandlesCount: this._preloadCandlesCount,
      });
      trace('historyCandles 1', 'historyCandles', historyCandles[0]);

      this._buffer = historyCandles.map(([timestamp, open, high, low, close]) => ({
        timestamp,
        open,
        high,
        low,
        close,
      }));
      await this.emitter.emit('new-candle-update');

      this._isInitialized = true;
      log('CandlesBuffer:init', 'Candles buffer initialized for symbol  ' + this.symbol, {
        candlesCount: this._buffer.length,
        timeframe: this.tfS,
        startDate: timeToString(this._buffer[0]['timestamp']) ?? 'no data',
        endDate: timeToString(this._buffer[this._buffer.length - 1]['timestamp']) ?? 'no data',
        maxBufferLength: this._maxBufferLength,
        preloadCandlesCount: this._preloadCandlesCount,
      });
    } catch (e) {
      error(e);
    }
  }

  // onBufferUpdate(callback) {
  //   this.emitter.on('update', callback);
  // }
  //
  // onBufferNewCandle(callback) {
  //   this.emitter.on('new-candle-update', callback);
  // }

  updateBuffer = async (data: Tick) => {
    if (!this._isInitialized) {
      warning('updateBuffer', 'Before updating the candles buffer, you must call the init method.');
      return;
    }

    const { timestamp, high, low, close, open, volume } = data;
    const candleTimestamp = roundTimeByTimeframe(timestamp, this.tfN);

    this.currentCandle = this._buffer[this._buffer.length - 1];

    if (this.currentCandle.timestamp < candleTimestamp) {
      this.newCandle({
        timestamp: candleTimestamp,
        high,
        low,
        open,
        close,
        volume,
      });
    } else {
      this.updateCurrentCandle(data);
      await this.emitter.emit('update');
    }
    this._lastTimeUpdated = timestamp;
  };

  newCandle(candle: Candle) {
    this._buffer.push(candle);
    this.currentCandle = this._buffer[this._buffer.length - 1];
  }

  updateCurrentCandle(candle: Candle) {
    this.currentCandle.low = Math.min(this.currentCandle.low, candle.low);
    this.currentCandle.high = Math.max(this.currentCandle.high, candle.high);
    this.currentCandle.close = candle.close;
    this.currentCandle.volume = candle.volume;
    // return currentCandle;
  }
  getLastTimeUpdated() {
    return this._lastTimeUpdated;
  }
}

export const getCandlesBuffer = (symbol: string, timeframe: string | number) => {
  timeframe = convertTimeframeToString(timeframe);
  if (!timeframe) {
    error('getCandlesBuffer', `timeframe ${timeframe} is not defined `, { symbol, timeframe });
  }
  return candlesBufferMap[`${symbol}:${timeframe}`];
};

export const setCandlesBuffer = async (
  symbol: string,
  timeframe: string | number,
  maxBufferLength = 500,
  preloadCandlesCount = 200,
) => {
  timeframe = convertTimeframeToString(timeframe);
  if (!timeframe) {
    error('setCandlesBuffer', `timeframe ${timeframe} is not defined `, { symbol, timeframe });
  }

  if (candlesBufferMap[`${symbol}:${timeframe}`]) {
    return candlesBufferMap[`${symbol}:${timeframe}`];
  }
  const candlesBuffer = new CandlesBuffer({ symbol, timeframe, maxBufferLength, preloadCandlesCount });
  await candlesBuffer.init();

  candlesBufferMap[`${symbol}:${timeframe}`] = candlesBuffer;
  return candlesBufferMap[`${symbol}:${timeframe}`];
};
