import { globals } from '../globals';
import { error, log, warning } from '../log';
import { EventEmitter, TriggerService } from '../events';
import { Report } from '../report';
import { BaseObject } from '../base-object';
import { Storage } from '../storage';
import { getArgBoolean, getArgString } from '../base';
import { BaseError } from '../Errors';
import { normalize } from '../utils/numbers';
import { CandlesBufferManager } from '../candles';

/**
 * This is a base class for all strategies with extended functionality.
 * works for both tester and live trading.
 * Strategy class should be extended from this class.
 */
export class Script extends BaseObject implements BaseScriptInterface {
  connectionName: string; //required
  symbols: string[] = []; //required
  symbol: string;
  interval: string; // if set  - onTimer will be called every interval instead of onTick
  args: GlobalARGS;
  iterator = 0;
  hedgeMode: boolean;
  timeframe: number;
  version = 1;

  balanceTotal: number;
  balanceFree: number;
  _testerStartRealTime: number;
  _testerEndRealTime: number;

  isInitialized = false;

  constructor(args: GlobalARGS) {
    super(args);
    this._testerStartRealTime = Date.now();
    this.args = args;

    log(
      'Script:constructor',
      '===========================Constructor(v 1.1)===========================',
      { args },
      true,
    );
    try {
      this.connectionName = getArgString('connectionName', undefined, true);
      this.hedgeMode = getArgBoolean('hedgeMode', false);
    } catch (e) {
      throw new BaseError(e);
    }

    if (isTester()) {
      this.symbols.push(args.symbol);
    } else {
      if (!this.symbols?.length) {
        let symbol = '';
        let symbolsLine = getArgString('symbols', '');

        let symbols = symbolsLine.split(',');

        symbols.forEach((symbol) => {
          if (symbol.includes('/')) {
            this.symbols.push(symbol);
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

    const idPrefix = 'Global';
    globals.strategy = this;
    globals.events = new EventEmitter({ idPrefix });
    globals.triggers = new TriggerService({ idPrefix });
    globals.report = new Report({ idPrefix });
    globals.storage = new Storage({ idPrefix });
    globals.candlesBufferManager = new CandlesBufferManager({ idPrefix });
  }

  init = async () => {
    try {
      let balanceInfo = await getBalance();
      this.balanceTotal = balanceInfo.total.USDT;
      this.balanceFree = balanceInfo.free.USDT;
    } catch (e) {
      throw new BaseError(e);
    } finally {
      this.isInitialized = false;
    }
    log(
      'Script:init',
      'init info',
      {
        balanceTotal: this.balanceTotal,
        balanceFree: this.balanceFree,
        symbols: this.symbols,
        hedgeMode: this.hedgeMode,
        args: ARGS,
      },
      true,
    );
    try {
      this.isInitialized = true;
      await this.onInit();
      await globals.events.emit('onInit');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.isInitialized = false;
    }
  };

  _isTickLocked = false;
  async runOnTick() {
    if (this._isTickLocked) {
      return;
    }
    if (this.isStop) {
      forceStop();
    }
    this._isTickLocked = true;
    try {
      await this.onBeforeTick();
      await globals.events.emit('onBeforeTick');
      await this.onTick();

      await globals.events.emit('onTick');
      //emit for special symbol
      await globals.events.emitOnTick();
      await this.onAfterTick();
      await globals.events.emit('onAfterTick');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this._isTickLocked = false;
      this.iterator++;
    }
  }

  isStop = false;
  forceStop(reason: string) {
    error('Script:forceStop', reason, {});
    this.isStop = true;
    forceStop();
  }

  runTickEnded = async (data: Tick[]) => {
    try {
      void globals.events.emit('onTickEnded', data);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnTimer = async () => {
    try {
      this.iterator++;
      await this.onTimer();
      await globals.events.emit('onTimer');
    } catch (e) {
      await this.runOnError(e);
    }
  };
  closedOrdersId: Record<string, string> = {};
  runOnOrderChange = async (orders: Order[]) => {
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
        }

        await this.onOrderChange(order);
        await globals.events.emitOnOrderChange(order); // emit for special symbol
        await globals.events.emit('onOrderChange', order); //for all symbols
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnError = async (e: any) => {
    if (this.isStop) {
      throw e;
    }
    error(e);
  };

  runArgsUpdate = async (args: GlobalARGS) => {
    try {
      this.args = { ...args };
      await this.onArgsUpdate(args);
      await globals.events.emit('onArgsUpdate', args);
      if (args.isTradeAllowed !== undefined) {
        globals.isTradeAllowed = args.isTradeAllowed === 'true';
        await globals.events.emit('onTradeAllowed', { isTradeAllowed: global.isTradeAllowed });
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onError = async (e: any): Promise<never | void> => {
    throw e;
  };

  run = async () => {
    try {
      await globals.events.emit('onRun');
    } catch (e) {
      await this.runOnError(e);
    }
  };

  stop = async () => {
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
    let min = normalize((this._testerEndRealTime - this._testerStartRealTime) / 1000 / 60, 0);
    let sec = normalize((this._testerEndRealTime - this._testerStartRealTime) / 1000, 0);
    log('Script:stop', `Tester spend ${min}:${sec}`, {}, true);
  };

  async runOnReportAction(action: string, payload: any) {
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

  async onTick() {}

  async onAfterTick() {}

  async onOrderChange(order: Order) {}

  async onArgsUpdate(args: GlobalARGS) {}

  async onTimer() {}
}
