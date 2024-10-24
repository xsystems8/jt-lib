import { uniqueId } from './base';
import { globals } from './globals';
import { log, warning } from './log';
import { BaseError } from './Errors';
import { currentTime } from './utils/date-time';

export class BaseObject {
  _id: string = '';
  _isDestroyed = false;
  _listenersId: any = [];
  _created = currentTime();

  constructor(args: any = {}) {
    let idPrefix = args.idPrefix ?? '';

    this.id = idPrefix + '_' + this.constructor.name + '#' + uniqueId(2);

    log('BaseObject::constructor', 'Object created with id ' + this.id, { args });

    return this;
  }

  async call(functionName: string, data?: any) {
    if (this._isDestroyed) {
      throw new BaseError('BaseObject::call this object is destroyed ');
    }
    return await this[functionName](data);
  }

  //ID is used for unsubscribing from events by object if you change id - you will not be able to unsubscribe from events
  set id(id: string) {
    if (globals.hasObject(id)) {
      this.id = id + uniqueId(2);
      log('BaseObject::id', `Object with id = ${id} already exists , new id = ${this._id}`);
      return;
    }
    if (this._id) {
      //TODO add unsubscribe from events and triggers and tests for it
      warning('BaseObject::id', `ID has been changed ${id} ->${this._id}`);
      globals.removeObject(this);
    }

    this._id = id;
    globals.addNewObject(this);
  }

  get id() {
    return this._id;
  }

  unsubscribe() {
    globals.events.unsubscribeByObjectId(this._id);
  }

  public destroy() {
    log('BaseObject::destroy', 'Object destroyed with id ' + this.id + ' ' + this.constructor.name);

    this._isDestroyed = true;
    globals.removeObject(this);
    this.unsubscribe();

    for (let propName of Object.keys(this)) {
      const obj = this[propName];
      if (obj === null || typeof obj !== 'object') continue;

      if (obj && obj instanceof BaseObject) {
        if (obj._isDestroyed) {
          warning('BaseObject::destroy', `Object ${obj.id} is already destroyed`);
          continue;
        }
        this[propName].destroy();
        continue;
      }

      const id = obj?.id;
      if (globals.hasObject(id)) {
        const type = obj.constructor.name;
        warning('BaseObject::destroy', `Object ${id} of ${type} is not destroyed`);
      }
    }
  }
}
