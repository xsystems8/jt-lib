import type { EventEmitter, TriggerService } from './events';
import type { Report } from './report';
import type { Script } from './script';
import type { Storage } from './storage';
import type { BaseObject } from './base-object';
import type { CandlesBufferManager } from './candles';
import type { Exchange } from './exchange';
import { getArgBoolean } from './base';

class GlobalScope {
  private _strategy: Script = null;
  private _triggers: TriggerService = null;
  private _report: Report = null;
  private _events: EventEmitter = null;
  private _storage: Storage = null;
  private _candlesBufferManager: CandlesBufferManager = null;
  private _isTradeAllowed = true;

  public exchange: Exchange = null;

  public balanceInfo = {};
  public positionsInfo = {};
  public _objects = {};
  logOnce: Map<string, any> = new Map();
  logOnceObj = {};
  params = {};
  logs = {};
  errorCount = 0;
  lastErrorTime = 0;
  public userData: Map<string, any> = new Map();

  constructor() {
    this.isTradeAllowed = getArgBoolean('isTradeAllowed', true);
  }

  public addNewObject(object: BaseObject) {
    this._objects[object.id] = object;
  }

  public removeObject(object: BaseObject) {
    if (this._objects[object.id] && this._objects[object.id] === object) {
      delete this._objects[object.id];
    } else {
      console.error(`GlobalScope::removeObject Object with id ${object.id} not found`);
    }
  }

  public hasObject(id: string) {
    return !!this._objects[id];
  }

  set isTradeAllowed(isTradeAllowed) {
    this._isTradeAllowed = isTradeAllowed;
  }

  get isTradeAllowed() {
    return this._isTradeAllowed;
  }

  set strategy(strategy) {
    this._strategy = strategy;
  }

  get strategy() {
    return this._strategy;
  }

  set candlesBufferManager(manager: CandlesBufferManager) {
    if (this._candlesBufferManager) {
      throw new Error('CandlesBufferManager already exists');
    }

    this._candlesBufferManager = manager;
  }

  get candlesBufferManager() {
    return this._candlesBufferManager;
  }

  set storage(storage: Storage) {
    if (this._storage) {
      throw new Error('Storage already set with id ' + this._storage?.id);
    }
    this._storage = storage;
  }

  get storage() {
    return this._storage;
  }

  set events(events) {
    if (this._events) {
      throw new Error('EventsEmitter already set with id ' + this._events?.id);
    }
    this._events = events;
  }

  get events() {
    return this._events;
  }

  set triggers(trigger) {
    if (this._triggers) {
      throw new Error('Triggers already set with id ' + this._triggers?.id);
    }
    this._triggers = trigger;
  }

  get triggers() {
    return this._triggers;
  }

  set report(report) {
    if (this._report) {
      throw new Error('Report already set with id ' + this._report?.id);
    }
    this._report = report;
  }

  get report(): Report {
    return this._report;
  }

  getClassName(obj: object) {
    return obj?.constructor?.name;
  }

  isObject(obj: object) {
    return typeof obj === 'object';
  }
}

export const globals = new GlobalScope();