import { globals } from '../core/globals';
import { error, log, warning } from '../core/log';
import { EventEmitter, TriggerService } from '../events';
import { Report } from '../report';
import { BaseObject } from '../core/base-object';
import { Storage } from '../core/storage';
import { getArgBoolean, getArgString } from '../core/base';
import { BaseError } from '../core/errors';
import { normalize } from '../utils/numbers';
import { CandlesBufferService } from '../candles';
import { errorContext } from '../utils/errors';
import { Indicators } from '../indicators';

export class Script extends BaseObject {
  MAX_ORDERS = 20000;
  connectionName: string; //required
  symbols: string[] = []; //required
  interval: number; // if set  - onTimer will be called every interval instead of onTick

  iterator = 0;

  hedgeMode: boolean;
  timeframe: number;
  version = 3;

  balanceTotal: number;
  balanceFree: number;
  _testerStartRealTime: number;
  _testerEndRealTime: number;

  isInitialized = false;

  constructor(args: GlobalARGS) {
    super(args);
    this._testerStartRealTime = Date.now();

    log('Script:constructor', '=============Constructor(v 2.6)=============', { args }, true);
    try {
      this.connectionName = getArgString('connectionName', undefined, true);
      this.hedgeMode = getArgBoolean('hedgeMode', false);
    } catch (e) {
      throw new BaseError(e);
    }

    if (isTester()) {
      this.symbols.push(args.symbol);
    } else {
      //TODO make symbolsInfo available in constructor
      if (!this.symbols?.length) {
        let symbol = '';
        let symbolsLine = getArgString('symbols', '');

        let symbols = symbolsLine.split(',');
        symbols.forEach((symbol) => {
          if (symbol.includes('/')) {
            this.symbols.push(symbol.trim());
          }
        });

        if (symbol !== '' && this.symbols.length === 0) {
          this.symbols = [symbol];
        }
      }
    }

    if (this.symbols.length === 0) {
      throw new BaseError('Script::constructor symbols is not defined');
    }

    const idPrefix = 'Global'; //
    globals.strategy = this;
    globals.events = new EventEmitter({ idPrefix });
    globals.triggers = new TriggerService({ idPrefix });
    globals.report = new Report({ idPrefix });
    globals.storage = new Storage({ idPrefix });
    globals.candlesBufferService = new CandlesBufferService({ idPrefix });
    globals.indicators = new Indicators({ idPrefix });

    //TODO add to ARGS.isMultiSymbols when optimization run by symbols (then delete this code)
    if (ARGS.isMultiSymbols === undefined) {
      ARGS.isMultiSymbols = true;
    }
  }

  protected async init() {
    try {
      let balanceInfo = await getBalance();
      this.balanceTotal = balanceInfo.total.USDT;
      this.balanceFree = balanceInfo.free.USDT;
      log('Script::init', 'getBalance', balanceInfo, true);
    } catch (e) {
      throw errorContext(e, {});
    } finally {
      this.isInitialized = false;
    }

    let initInfo = {
      balanceTotal: this.balanceTotal,
      balanceFree: this.balanceFree,
      symbols: this.symbols,
      hedgeMode: this.hedgeMode,
      ARGS,
    };

    try {
      this.isInitialized = true;
      await this.onInit();
    } catch (e) {
      error('Script::init', e);
    } finally {
      this.isInitialized = false;
    }
  }

  _isTickLocked = false;
  protected async runOnTick(data: Tick) {
    if (this._isTickLocked) {
      return;
    }
    if (this.isStop) {
      forceStop();
    }
    this._isTickLocked = true;
    try {
      //TODO delete all   await globals.events.emit('onBeforeTick');    await globals.events.emit('onAfterTick');

      // await this.onBeforeTick();
      //  await globals.events.emit('onBeforeTick');
      await this.onTick(data);
      // await globals.events.emit('onTick');
      await globals.events.emitOnTick();
      //  await this.onAfterTick();
      // await globals.events.emit('onAfterTick');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this._isTickLocked = false;
      this.iterator++;
    }
  }

  isStop = false;
  forceStop(reason: string) {
    this.isStop = true;
    forceStop();
    error('Script::forceStop', reason, {});
    throw new BaseError(reason);
  }

  protected runTickEnded = async (data: Tick) => {
    try {
      void globals.events.emit('onTickEnded', data);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  protected runOnTimer = async () => {
    try {
      this.iterator++;
      await this.onTimer();
      await globals.events.emit('onTimer');
    } catch (e) {
      await this.runOnError(e);
    }
  };
  closedOrdersId: Record<string, string> = {};
  protected runOnOrderChange = async (orders: Order[]) => {
    try {
      for (const order of orders) {
        if (!isTester()) {
          try {
            //TODO (Sometimes binance send closed order twice) investigate why!!!
            if (this.closedOrdersId[order.id]) {
              warning('Script::runOnOrderChange', 'Closed order came twice', { order }, true);
              return;
            }
            if (order.status === 'closed') {
              this.closedOrdersId[order.id] = order.id;
            }
          } catch (e) {
            error(e);
          }
        } else {
          this.MAX_ORDERS--;
          if (this.MAX_ORDERS <= 0) {
            this.forceStop('Max orders reached');
          }
        }

        await this.onOrderChange(order);
        await globals.events.emitOnOrderChange(order); // emit for special symbol
        await globals.events.emit('onOrderChange', order); //for all symbols
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  protected runOnError = async (e: any) => {
    if (this.isStop) {
      throw e;
    }
    error(e);
  };

  protected runArgsUpdate = async (args: GlobalARGS) => {
    try {
      await this.onArgsUpdate(args);
      await globals.events.emit('onArgsUpdate', args);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onError = async (e: any): Promise<never | void> => {
    throw e;
  };

  //TODO delete run method - because it is not used
  protected async run() {
    try {
      await globals.events.emit('onRun');
    } catch (e) {
      await this.runOnError(e);
    }
  }

  protected async stop() {
    log('Script:stop', '===========================Stop===========================', {}, true);
    try {
      await globals.events.emit('onBeforeStop');
      await globals.events.emit('onStop');
      await this.onStop();
      await globals.events.emit('onAfterStop');
    } catch (e) {
      await this.runOnError(e);
    }
    this._testerEndRealTime = Date.now();
    //  if (isTester()) {
    let min = normalize((this._testerEndRealTime - this._testerStartRealTime) / 1000 / 60, 0);
    let sec = normalize((this._testerEndRealTime - this._testerStartRealTime) / 1000, 0);
    log('Script:stop', `Tester spend ${min}:${sec}`, {}, true);
    //}
  }

  protected async runOnReportAction(action: string, payload: any) {
    try {
      await this.onReportAction(action, payload);
      await globals.events.emit('onReportAction', { action, payload });
    } catch (e) {
      await this.runOnError(e);
    }
  }

  async onReportAction(action: string, payload: any) {}

  async onStop() {}

  async onInit() {}

  async onBeforeTick() {}

  async onTick(data: Tick) {}

  async onAfterTick() {}

  async onOrderChange(order: Order) {}

  async onArgsUpdate(args: GlobalARGS) {}

  async onTimer() {}
}
