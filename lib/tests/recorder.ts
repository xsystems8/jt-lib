import { Storage } from '../storage';
import { globals } from '../globals';
import { RecordParams } from './types';

const contextMethods = {
  createOrder: createOrder,
  modifyOrder: modifyOrder,
  cancelOrder: cancelOrder,
};

export class Recorder {
  private readonly storageKey: string;

  constructor(params: RecordParams) {
    if (!['record', 'play'].includes(params.mode)) {
      throw new Error('[Recorder] options.mode should be equal "record" or "play"');
    }

    if (!params.storageKey) {
      throw new Error('[Recorder] options.storageKey required');
    }

    this.mode = params.mode;
    this.storageKey = params.storageKey;

    // globals.events.subscribe('onTick', this.onTick);
    // globals.events.subscribe('onStop', this.onStop);

    if (this.mode !== 'record') return;

    Object.keys(contextMethods).forEach((method) => {
      registerCallback(method, (args, result) => {
        const record = { timestamp: tms(), method, args, result };
        this.records[tms()] = !!this.records[tms()] ? [...this.records[tms()], record] : [record];
      });
    });
  }

  records: Record<string, any> = {};
  mode = 'record';
  isInit = false;

  init = async () => {
    await this.restoreState();
    // info(`[Recorder] initialized. Records:`);
    // info(this.records);
    this.isInit = true;
  };

  onTick = async (data) => {
    if (this.mode !== 'play') return;

    if (!this.isInit) {
      await this.init();
    }

    const { timestamp } = data;
    const records = this.records[timestamp];
    for (let record of records) {
      // await contextMethods[record.method](...record.args);
    }
  };

  onStop = async () => {
    // info('recorder records');
    // info(this.records);
    if (this.mode !== 'record') return;
    await this.storeState();
  };

  storeState = async () => {
    const storage = new Storage(['mode', 'storageKey']);
    await storage.storeState(this.storageKey, this);
    // info('[Recorder] state saved.');
  };

  restoreState = async () => {
    const storage = new Storage(['mode', 'storageKey']);
    await storage.restoreState(this.storageKey, this);
    // info('[Recorder] state restored.');
  };
}
