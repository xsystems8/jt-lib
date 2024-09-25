import { Trigger } from '../trigger';
import { TriggerHandler, TriggerTask } from '../types';
import { CreatePriceTaskParams, PriceTriggerDirection, PriceTriggerInterface, PriceTriggerTask } from './types';
import { currentTime, currentTimeString } from '../../../utils/date-time';
import { error, log, warning } from '../../../log';
import { globals } from '../../../globals';
import { BaseObject } from '../../../base-object';
import { BaseError } from '../../../Errors';

const MAX_INACTIVE_TASKS = 100;

export class PriceTrigger extends Trigger implements PriceTriggerInterface {
  private readonly _registeredHandlers = new Map<string, TriggerHandler>();
  private readonly upperPriceTasks = new Map<string, PriceTriggerTask>();
  private readonly lowerPriceTasks = new Map<string, PriceTriggerTask>();
  private readonly inactiveTasks = new Map<string, PriceTriggerTask>();

  private upperMinPrice: number | null = null;
  private lowerMaxPrice: number | null = null;

  private _eventListenerId: string | null = null;
  private nextId = 1;

  symbol: string;
  constructor(args: { symbol: string; idPrefix?: string }) {
    if (!args?.symbol) {
      throw new BaseError('PriceTrigger::constructor symbol is required ', args);
    }
    let idPrefix = args?.idPrefix ?? args.symbol;
    super({ ...args, idPrefix });
    this.symbol = args.symbol;
  }

  registerHandler(taskName: string, handler: Function, owner: BaseObject) {
    if (typeof handler !== 'function') {
      // in typescript function.name is not defined for arrow functions
      throw new BaseError('PriceTrigger::registerHandler() Arrow function is not allowed in callback', { taskName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('PriceTrigger::registerHandler() The owner must be an instance of the BaseObject class');
    }
    if (!owner[handler.name] || typeof owner[handler.name] !== 'function') {
      throw new BaseError(
        `PriceTrigger::registerHandler() ${handler.name} should be a function of ${owner.constructor.name}`,
      );
    }
    if (this._registeredHandlers.get(taskName)) {
      error('PriceTrigger::registerHandler', 'The handler for the task is already registered', { taskName });

      throw new BaseError(
        `PriceTrigger::registerHandler() The handler for the task ${taskName} is already registered`,
        {
          taskName,
        },
      );
    }

    log('PriceTrigger::registerHandler', 'New handler registered', { taskName });
    this._registeredHandlers.set(taskName, { callback: handler.bind(owner), funcName: handler.name });
  }

  hasHandler(taskName: string): boolean {
    return this._registeredHandlers.has(taskName);
  }

  addTask(params: CreatePriceTaskParams): string | undefined {
    if (isNaN(params.triggerPrice)) {
      error('PriceTrigger::addTask', 'Price is not a number', { params });
      return undefined;
    }

    const id = `price#${this.nextId++}`;
    const currentPrice = close(this.symbol);
    let direction = PriceTriggerDirection.Up;

    if (currentPrice > params.triggerPrice) {
      direction = PriceTriggerDirection.Down;
    }

    const task: PriceTriggerTask = {
      ...params,
      symbol: this.symbol,
      id,
      type: 'price',
      direction,
      executedTimes: 0,
      isActive: true,
      isTriggered: false,
      created: currentTimeString(),
      createdTms: currentTime(),
      lastExecuted: null,
    };

    switch (direction) {
      case PriceTriggerDirection.Up:
        this.upperMinPrice = this.upperMinPrice
          ? Math.min(this.upperMinPrice, params.triggerPrice)
          : params.triggerPrice;
        this.upperPriceTasks.set(id, task);
        break;
      case PriceTriggerDirection.Down:
        this.lowerMaxPrice = this.lowerMaxPrice
          ? Math.max(this.lowerMaxPrice, params.triggerPrice)
          : params.triggerPrice;
        this.lowerPriceTasks.set(id, task);
    }

    if (!this._eventListenerId) {
      this._eventListenerId = globals.events.subscribeOnTick(this.onTick, this, this.symbol);
    }

    log('PriceTrigger::addTask', 'New task registered', { task: params });

    return id;
  }

  private async onTick() {
    const currentPrice = close(this.symbol);

    if (currentPrice > this.lowerMaxPrice && currentPrice < this.upperMinPrice) return;

    if (this.upperMinPrice && currentPrice >= this.upperMinPrice) {
      for (const task of this.upperPriceTasks.values()) {
        if (task.triggerPrice > currentPrice) continue;
        await this.executeTask(task);
      }

      this.recalculateBorderPrices(PriceTriggerDirection.Up);
    } else {
      for (const task of this.lowerPriceTasks.values()) {
        if (task.triggerPrice < currentPrice) continue;
        await this.executeTask(task);
      }

      this.recalculateBorderPrices(PriceTriggerDirection.Down);
    }

    if (!this.lowerPriceTasks.size && !this.upperPriceTasks.size) {
      globals.events.unsubscribeById(this._eventListenerId);
      this._eventListenerId = null;
    }

    this.clearInactive();
  }

  private async executeTask(task: PriceTriggerTask) {
    if (!task.callback && !this._registeredHandlers.get(task.name)) {
      task.isActive = false;

      if (task.direction === PriceTriggerDirection.Up) {
        this.upperPriceTasks.delete(task.id);
      } else {
        this.lowerPriceTasks.delete(task.id);
      }

      this.inactiveTasks.set(task.id, task);

      throw new BaseError(`There is no registered handler or callback for the task`, { task });
    }

    try {
      if (task.callback) {
        task.result = await task.callback(task.args);
      } else {
        const handler = this._registeredHandlers.get(task.name);
        task.result = await handler.callback(task.args);
      }
      task.isTriggered = true;
      task.isActive = false;
      task.executedTimes++;
      task.lastExecuted = currentTimeString();

      this.inactiveTasks.set(task.id, task);

      if (task.group) {
        Array.from(this.upperPriceTasks.values())
          .filter((activeTask) => activeTask.group === task.group)
          .forEach((task) => {
            this.inactiveTasks.set(task.id, { ...task, isActive: false });
            this.upperPriceTasks.delete(task.id);
          });

        Array.from(this.lowerPriceTasks.values())
          .filter((activeTask) => activeTask.group === task.group)
          .forEach((task) => {
            this.inactiveTasks.set(task.id, { ...task, isActive: false });
            this.lowerPriceTasks.delete(task.id);
          });
      }

      if (task.direction === PriceTriggerDirection.Up) {
        this.upperPriceTasks.delete(task.id);
        return;
      }

      this.lowerPriceTasks.delete(task.id);
    } catch (e) {
      error(e, {
        task,
      });

      if (!task.retry) {
        task.isActive = false;
        task.isTriggered = true;
        task.error = e.message;

        this.inactiveTasks.set(task.id, task);

        if (task.direction === PriceTriggerDirection.Up) {
          this.upperPriceTasks.delete(task.id);
          return;
        }

        this.lowerPriceTasks.delete(task.id);

        return;
      }

      if (typeof task.retry === 'number') {
        task.retry -= 1;
      }

      await this.executeTask(task);
    }
  }

  cancelTask(taskId: string) {
    let isUpperTask = true;
    let task: PriceTriggerTask;

    task = this.upperPriceTasks.get(taskId);

    if (!task) {
      isUpperTask = false;
      task = this.lowerPriceTasks.get(taskId);
    }

    if (!task) {
      error(PriceTrigger.name, 'An error occurred while canceling the task: Task not found', { taskId });
      return;
    }

    this.lowerPriceTasks.delete(task.id);
    this.upperPriceTasks.delete(task.id);
    this.inactiveTasks.set(taskId, task);
    this.recalculateBorderPrices(isUpperTask ? PriceTriggerDirection.Up : PriceTriggerDirection.Down);
    this.clearInactive();
  }

  getTasksByName(taskName: string): TriggerTask[] {
    return [...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()].filter(
      (task) => task.name === taskName,
    );
  }

  getAllTasks(): TriggerTask[] {
    return [...this.inactiveTasks.values(), ...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()];
  }

  getActiveTasks(): TriggerTask[] {
    return [...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()];
  }

  getInactiveTasks(): TriggerTask[] {
    return Array.from(this.inactiveTasks.values());
  }

  cancelAll() {
    for (const task of this.lowerPriceTasks.values()) {
      this.inactiveTasks.set(task.id, task);
      this.lowerPriceTasks.delete(task.id);
    }

    for (const task of this.upperPriceTasks.values()) {
      this.inactiveTasks.set(task.id, task);
      this.upperPriceTasks.delete(task.id);
    }

    this.upperMinPrice = null;
    this.lowerMaxPrice = null;

    this.clearInactive();
  }

  private recalculateBorderPrices(direction?: PriceTriggerDirection) {
    if (!direction) {
      for (const task of this.lowerPriceTasks.values()) {
        this.lowerMaxPrice = Math.max(this.lowerMaxPrice, task.triggerPrice);
      }
      for (const task of this.upperPriceTasks.values()) {
        this.upperMinPrice = Math.min(this.upperMinPrice, task.triggerPrice);
      }

      return;
    }

    if (direction === PriceTriggerDirection.Up) {
      for (const task of this.upperPriceTasks.values()) {
        this.upperMinPrice = Math.min(this.upperMinPrice, task.triggerPrice);
      }
    }

    if (direction === PriceTriggerDirection.Down) {
      for (const task of this.lowerPriceTasks.values()) {
        this.lowerMaxPrice = Math.max(this.lowerMaxPrice, task.triggerPrice);
      }
    }
  }

  private clearInactive() {
    if (this.inactiveTasks.size < MAX_INACTIVE_TASKS) return;

    Array.from(this.inactiveTasks.values())
      .sort((a, b) => b.createdTms - a.createdTms)
      .slice(0, -100)
      .forEach((task) => this.inactiveTasks.delete(task.id));
  }

  beforeStore() {
    Array.from(this.upperPriceTasks.entries()).forEach(([taskId, task]) => {
      if (!!task.callback) {
        this.upperPriceTasks.delete(taskId);
      }
    });
    Array.from(this.lowerPriceTasks.entries()).forEach(([taskId, task]) => {
      if (!!task.callback) {
        this.lowerPriceTasks.delete(taskId);
      }
    });
    this.inactiveTasks.clear();
  }

  afterRestore() {
    for (let task of this.getActiveTasks()) {
      if (task.callback) {
        this.cancelTask(task.id);
        warning('PriceTrigger::afterRestore', 'Task with callback was canceled', { task });
      }
    }
  }
}
