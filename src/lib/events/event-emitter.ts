import { BaseObject } from '../base-object';
import { EventListener, TickExecutionData } from './types';
import { uniqueId } from '../base';
import { BaseError } from '../Errors';
import { error, log } from '../log';
import { currentTimeString, timeCurrent } from '../utils/date-time';

export class EventEmitter extends BaseObject {
  private readonly tickExecInterval = new Map<string, TickExecutionData>();
  private readonly _listeners = new Map<string, EventListener[]>();

  private defaultTickInterval = 2000;

  constructor(args: { idPrefix: string }) {
    super(args);
  }

  subscribeOnOrderChange(handler: (order: Order) => Promise<any>, owner: BaseObject, symbol: string) {
    return this.subscribe(`onOrderChange_${symbol}`, handler, owner);
  }

  subscribeOnTick(handler: (data?: any) => Promise<any>, owner: BaseObject, symbol: string, interval?: number) {
    const event = `emitOnTick_${symbol}`;

    if (!interval) {
      interval = this.defaultTickInterval;
    }

    interval = Math.max(interval, this.defaultTickInterval);

    this.tickExecInterval.set(event, {
      interval,
      symbol,
      nextTick: timeCurrent() + interval,
    });

    return this.subscribe(event, handler, owner);
  }

  /**
   * Subscribe to event with listener. You can use on() instead of subscribe().
   * !important: function (listener) wouldn't be deleted even object witch has this function is destroyed (you should unsubscribe manually)
   * @param eventName - event name
   * @param handler - event handler
   * @param owner - object witch has this listener (for unsubscribing by object)
   * @returns {string} - listener id (for unsubscribing by id)
   */
  subscribe(eventName: string, handler: (data?: any) => Promise<any>, owner: BaseObject): string {
    if (typeof handler !== 'function') {
      throw new BaseError('EventEmitter::subscribe() handler should be a function  ', { eventName });
    }

    if (!handler.name) {
      throw new BaseError('EventEmitter::subscribe() Anonymous arrow functions are not supported', { eventName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('EventEmitter::subscribe() The owner must be an instance of the BaseObject class', {
        eventName,
      });
    }
    if (!owner[handler.name]) {
      throw new BaseError(
        `EventEmitter::subscribe() The handler ${handler.name} must be a method of the BaseObject class`,
        { eventName },
      );
    }

    const id = uniqueId(10);

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }

    const listeners = this._listeners.get(eventName);

    const listenerData: EventListener = {
      id,
      event: eventName,
      owner,
      handler: handler.bind(owner),
      handlerName: handler.name,
      ownerName: owner.constructor.name,
      ownerId: owner.id,
      result: {},
    };

    listeners.push(listenerData);

    log('EventsEmitter:subscribe', `A handler for the ${eventName} event has been registered`, {
      eventName,
      id,
      ownerId: owner.id,
    });

    return id;
  }

  async emitOnOrderChange(order: Order) {
    await this.emit(`onOrderChange_${order.symbol}`, order);
  }

  async emitOnTick() {
    for (const [event, execData] of this.tickExecInterval.entries()) {
      if (tms(execData.symbol) >= execData.nextTick) {
        await this.emit(event);
        execData.nextTick = tms(execData.symbol) + execData.interval;
      }
    }
  }

  /**
   * Emit event with data
   * @param eventName - event name (string)
   * @param data - data for _listeners (any)
   * @returns {Promise<void>} - promise
   */
  async emit(eventName: string, data?: any): Promise<void> {
    const listeners = this._listeners.get(eventName);
    if (!listeners || !listeners.length) return;

    for (const listener of listeners) {
      try {
        let result = await listener.handler(data);
        listener.result = { result, updated: currentTimeString(), ownerId: listener.ownerId };
      } catch (e) {
        error(e, { ...listener, owner: undefined, data });
      }
    }
  }

  setDefaultTickInterval(interval: number) {
    interval = Math.max(1000, interval);
    this.defaultTickInterval = interval;
  }

  getListenersCount() {
    return Array.from(this._listeners.values()).reduce((acc, listeners) => acc + listeners.length, 0);
  }

  getListeners() {
    return Array.from(this._listeners.values()).flat();
  }

  /**
   * Unsubscribe from event by listener id
   * @param listenerId - listener id
   * @returns {boolean} - true if listener was found and unsubscribed
   */
  unsubscribeById(listenerId: string): boolean {
    for (const [eventName, listeners] of this._listeners.entries()) {
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].id !== listenerId) continue;

        listeners.splice(i, 1);

        log('EventsEmitter:unsubscribe', `Listener ${listenerId} unsubscribed from event ${eventName}`);

        return true;
      }
    }

    error('EventsEmitter:unsubscribe', `Listener ${listenerId} was not found.`);

    return false;
  }

  /**
   * Unsubscribe from event by object
   * @param objectId - object id
   * @returns {number} - count of unsubscribed _listeners
   */
  unsubscribeByObjectId(objectId: string): number {
    let unsubscribedIds = 0;

    for (const [eventName, listeners] of this._listeners.entries()) {
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].ownerId !== objectId) continue;
        const listenerId = listeners[i].id;
        listeners.splice(i, 1);

        unsubscribedIds++;

        log('EventsEmitter:unsubscribeByObjectId', `Object ${objectId} unsubscribed from event ${eventName}`, {
          listenerId,
        });
      }
    }

    return unsubscribedIds;
  }
}
