import { BaseObject } from '../base-object';
import {
  CreateTriggerOrderByTaskParams,
  ExchangeOrder,
  ExchangeParams,
  StopOrderData,
  StopOrderQueueItem,
  TriggerType,
  MarketInfoShort,
} from './types';
import { BaseError } from '../Errors';
import { TriggerService } from '../events';
import { error, log, logOnce, warning } from '../log';
import { getArgNumber, uniqueId } from '../base';
import { globals } from '../globals';
import { timeToString } from '../utils/date-time';
import { positionProfit } from './heplers';
import { normalize } from '../utils/numbers';

export class Exchange extends BaseObject {
  LEVERAGE_INFO_KEY = 'exchange-leverage-info-';
  readonly triggerService: TriggerService;
  protected readonly symbol: string;
  protected _connectionName: string;
  protected readonly hedgeMode: boolean = false;
  protected readonly triggerType: TriggerType = 'script';
  protected readonly ordersByClientId = new Map<
    string,
    Order & { userParams: Record<string, number | string | boolean> }
  >();
  protected readonly stopOrdersByOwnerShortId = new Map<string, StopOrderData>();
  protected readonly stopOrdersQueue = new Map<string, StopOrderQueueItem>();

  protected symbolInfo: SymbolInfo;
  protected leverage: number = 50;
  protected prefix: string;
  protected maxLeverage: number;
  protected contractSize: number;
  protected minContractQuoted: number;
  protected _minContractBase: number;
  protected minContractStep: number;

  private nextOrderId = 0;

  isInit = false;

  constructor(params: ExchangeParams) {
    super(params);

    if (!params.connectionName || params.connectionName === '') {
      throw new BaseError('Exchange::constructor Argument "connectionName" is not defined', params);
    }

    if (!params.symbol || params.symbol === '') {
      throw new BaseError('Exchange::constructor Argument "symbol" is not defined', params);
    }

    this.triggerType = params.triggerType ?? 'script';
    this._connectionName = params.connectionName;
    this.symbol = params.symbol; // TODO validate symbol
    this.leverage = params.leverage ?? 50;
    this.hedgeMode = params.hedgeMode;

    this.setPrefix(params.prefix);

    globals.events.subscribeOnOrderChange(this.beforeOnOrderChange, this, this.symbol);

    this.triggerService = new TriggerService({ idPrefix: this.symbol, symbol: this.symbol });
    this.triggerService.registerPriceHandler(params.symbol, 'executeStopLoss', this.createTriggerOrderByTask, this);
    this.triggerService.registerPriceHandler(params.symbol, 'executeTakeProfit', this.createTriggerOrderByTask, this);
    this.triggerService.registerPriceHandler(params.symbol, 'executeTriggerOrder', this.createTriggerOrderByTask, this);
  }

  private set connectionName(value: string) {
    this._connectionName = value;
  }

  get connectionName(): string {
    return this._connectionName;
  }

  async init() {
    this.symbolInfo = await symbolInfo(this.symbol);

    if (!isTester()) {
      logOnce('Exchange::init ' + this.symbol, 'symbolInfo', this.symbolInfo);

      if (!this.symbolInfo) {
        throw new BaseError('Exchange::init symbolInfo is not defined for symbol ' + this.symbol, {
          symbol: this.symbol,
        });
      }
    } else {
      //TODO update symbol info for futures in tester (then delete code below)
      this.symbolInfo['limits']['amount']['min'] = 0.00001;

      if (this._connectionName.includes('binance')) {
        this.symbolInfo['limits']['cost']['min'] = 5;
      }
      this.maxLeverage = getArgNumber('defaultLeverage', 100);
    }

    if (!this.symbolInfo?.limits?.amount?.min) {
      throw new BaseError('Exchange::init min amount is not defined for symbol ' + this.symbol, {
        symbolInfo: this.symbolInfo,
      });
    }

    if (this.symbolInfo.limits?.cost?.min) {
      this.minContractQuoted = this.symbolInfo.limits.cost.min;
    } else {
      this.minContractQuoted = this.symbolInfo.limits.amount.min * this.close();
    }

    //TODO update symbolInfo minCost (bybit minCost is 5 but not info in symbolInfo)
    if (this._connectionName.includes('bybit')) {
      this.minContractQuoted = 5;
    }

    this.contractSize = this.symbolInfo.contractSize ?? 1;
    this.minContractStep = this.symbolInfo.limits.amount.min;

    if (this.leverage > this.maxLeverage) {
      throw new BaseError('Exchange:init leverage (' + this.leverage + ') is high for symbol ' + this.symbol, {
        symbol: this.symbol,
        leverage: this.leverage,
        maxLeverage: this.maxLeverage,
      });
    }

    // --- Set leverage ---
    if (!isTester()) {
      let levKey = this.LEVERAGE_INFO_KEY + this._connectionName + '-' + this.symbol;
      let leverageInfo = Number(await globals.storage.get(levKey));

      if (leverageInfo !== this.leverage) {
        try {
          const response = await setLeverage(this.leverage, this.symbol);
          await globals.storage.set(levKey, this.leverage);
          log('Exchange:init', 'setLeverage ' + this.leverage + ' ' + this.symbol, { response });
        } catch (e) {
          // bybit returns error if leverage already set, unfortunately there is no way to check leverage before set.
          if (e.message.includes('leverage not modified') && e.message.includes('bybit')) {
            log('Exchange:init', 'setLeverage ' + this.leverage + ' ' + this.symbol, {
              message:
                'bybit returns error if leverage already set, unfortunately there is no way to check leverage before set.',
            });
            await globals.storage.set(levKey, this.leverage);
          } else {
            throw new BaseError(e, { symbolInfo: this.symbolInfo });
          }
        }
      } else {
        log('Exchange:init', 'Leverage already set', { leverage: this.leverage, symbol: this.symbol });
      }
    }
    // --- Set leverage ---

    if (this.triggerType !== 'script' && this.triggerType !== 'exchange') {
      throw new BaseError('Exchange::init', 'Wrong trigger type ' + this.triggerType);
    }

    log('Exchange::init', '', {
      symbol: this.symbol,
      triggerType: this.triggerType + '',
      connectionName: this._connectionName,
      hedgeMode: this.hedgeMode,
      prefix: this.prefix,
      leverage: this.leverage,
      maxLeverage: this.maxLeverage,
      contractSize: this.contractSize,
      minContractQuoted: this.minContractQuoted,
      minContractStep: this.minContractStep,
    });

    this.isInit = true;
  }

  /**
   * min contract size is calculated by min amount in quote currency (minContractQuoted) and current price
   */
  get minContractBase(): number {
    return this.getContractsAmount(this.minContractQuoted);
  }

  private async beforeOnOrderChange(order: Order) {
    const { prefix, shortClientId, ownerClientOrderId, triggerOrderType } = this.parseClientOrderId(
      order.clientOrderId,
    );

    if (prefix !== this.prefix)
      return { status: 'not processed', orderPrefix: prefix, currentPrefix: this.prefix, order };

    try {
      const stopOrders = this.stopOrdersByOwnerShortId.get(ownerClientOrderId);

      // cancel stop orders if one of them is fulfilled.
      if (order.status === 'closed' && !!stopOrders) {
        const { slOrderId, tpOrderId } = stopOrders;

        if (order.id === slOrderId && tpOrderId) {
          await this.cancelOrder(tpOrderId);
        }

        if (order.id === tpOrderId && slOrderId) {
          await this.cancelOrder(slOrderId);
        }
      }

      // cancel stop orders if one of them is executed.
      if (order.status === 'canceled' && !!stopOrders && this.triggerType === 'exchange') {
        const { slOrderId, tpOrderId } = stopOrders;
        if (slOrderId) {
          await this.cancelOrder(slOrderId);
        }
        if (tpOrderId) {
          await this.cancelOrder(tpOrderId);
        }
      }

      const stopOrderQueue = this.stopOrdersQueue.get(order.clientOrderId);
      // If executed order has SL or TP params, create stop orders
      if (order.status === 'closed' && stopOrderQueue) {
        await this.createSlTpOrders(order.clientOrderId, stopOrderQueue.sl, stopOrderQueue.tp);
      }
      log('Exchange::onOrderChange', '', {
        order,
        prefix,
        ownerClientOrderId,
        shortClientId,
        stopOrderQueue,
        stopOrders,
        triggerOrderType,
      });
    } catch (e) {
      error(e, { order });
    }
    return await this.onOrderChange(order);
  }

  protected async onOrderChange(order: Order) {
    return { order };
  }

  /**
   * Create order on exchange
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @param params - if params['sl'] or params['tp'] set, stop orders will be created automatically by this order.
   * @returns {Promise<Order>}
   */
  async createOrder(
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, unknown>,
  ): Promise<Order> {
    const args = { type, side, amount, price, params };

    if (!this.isInit) throw new BaseError('Exchange::createOrder - exchange not initialized', args);
    if (amount <= 0) throw new BaseError('Exchange::createOrder amount must be > 0', args);
    if (!['sell', 'buy'].includes(side)) throw new BaseError('Exchange::createOrder side must be buy or sell', args);

    if (this.hedgeMode) {
      params['positionSide'] = side === 'buy' ? 'long' : 'short';

      if (params['reduceOnly']) {
        params['positionSide'] = side === 'buy' ? 'short' : 'long';
      }
    }

    params['leverage'] = params['leverage'] ?? this.leverage;

    const clientOrderId = this.generateClientOrderId(
      this.prefix,
      type,
      !!params['reduceOnly'] ?? false,
      params['ownerClientOrderId'] as string,
      params['triggerOrderType'] as string,
    );

    params.clientOrderId = clientOrderId;

    // If stop orders params set, save it to stopOrdersQueue then this params will be used in onOrderChange function
    // stop orders will be created when owner order executed (status = 'closed')
    if (params['sl'] || params['tp']) {
      this.stopOrdersQueue.set(clientOrderId, {
        ownerOrderId: clientOrderId,
        sl: params['sl'] as number,
        tp: params['tp'] as number,
        prefix: this.prefix,
      });

      log('Exchange::createOrder', 'Stop orders params saved', this.stopOrdersQueue.get(clientOrderId));
    }

    const triggerPrice = params.triggerPrice || params.stopLossPrice || params.takeProfitPrice;

    if (triggerPrice && this.triggerType === 'script') {
      let ownerClientOrderId = params.ownerClientOrderId as string;

      let triggerOrderType = undefined;
      if (params.takeProfitPrice || params.stopLossPrice) {
        triggerOrderType = params.takeProfitPrice ? 'TP' : 'SL';
      }

      const orderParams = {
        type,
        side,
        amount,
        price,
        params: { reduceOnly: params.reduceOnly, ownerClientOrderId, triggerOrderType },
      };

      let taskId: string;
      let taskName: string;

      if (params.stopLossPrice) taskName = 'executeStopLoss';
      if (params.takeProfitPrice) taskName = 'executeTakeProfit';
      if (params.triggerPrice) taskName = 'executeTriggerOrder';

      taskId = this.triggerService.addTaskByPrice({
        name: taskName,
        triggerPrice: triggerPrice as number,
        symbol: this.symbol,
        group: ownerClientOrderId as string,
        args: orderParams,
      });

      log('Exchange::createOrder', 'Trigger price task ' + taskName + ' added', {
        taskId,
        triggerOrdersParams: args,
        options: {
          id: params.clientOrderId,
          group: params.ownerShortId,
        },
        params,
      });

      return { clientOrderId, id: null } as Order;
    }

    const { orderParams, userParams } = this.validateParams(params);
    const marketInfo = { lastPrice: this.close(), ask: this.ask(), bid: this.bid() };

    let order: Order;

    try {
      order = await createOrder(this.symbol, type, side, amount, price, orderParams);

      this.ordersByClientId.set(clientOrderId, { ...order, userParams });
    } catch (e) {
      throw new BaseError(e, {
        marketInfo,
        orderParams,
        userParams,
        args,
        e,
      });
    }

    if (!order.id) {
      error('Exchange::createOrder', 'Order not created', {
        marketInfo,
        order,
        params,
        args,
        orderParams,
        userParams,
      });

      return order;
    }

    log('Exchange::createOrder', `[${this.symbol}] Order created ` + (params.reduceOnly ? 'R' : '') + ' ' + type, {
      marketInfo,
      args,
      orderParams,
      userParams,
      order,
      triggerPrice,
    });

    return order;
  }

  getUserOrderParams(clientOrderId: string): Record<string, number | string | boolean> {
    let order = this.ordersByClientId.get(clientOrderId);
    return order?.userParams ?? {};
  }

  /**
   * Set prefix for clientOrderId (used for identify orders created by this exchange)
   * @param prefix - prefix for clientOrderId
   * @returns {void}
   * Note: *
   * Prefix is used to identify orders created by this exchange if you change prefix,
   * you will not be able to get onOrderChange events for orders created with the old prefix.
   */
  setPrefix(prefix?: string): void {
    this.prefix = prefix ?? uniqueId(4);
    log('Exchange::setPrefix', 'Prefix set to ' + this.prefix);
  }

  getPrefix() {
    return this.prefix;
  }

  /**
   * Create market buy order
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async buyMarket(amount: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('market', 'buy', amount, 0, { ...params, tp, sl });
  }

  /**
   * Create market sell order
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async sellMarket(amount: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('market', 'sell', amount, 0, { ...params, tp, sl });
  }

  /**
   * Create limit buy order
   * @param amount - order amount
   * @param limitPrice - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async buyLimit(amount: number, limitPrice: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('limit', 'buy', amount, limitPrice, { ...params, tp, sl });
  }

  /**
   * Create limit sell order
   * @param amount - order amount
   * @param limitPrice - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   *
   */
  async sellLimit(amount: number, limitPrice: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('limit', 'sell', amount, limitPrice, { ...params, tp, sl });
  }

  /**
   * Modify order by id (change price, amount)
   * @param orderId - order id
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @returns {Promise<Order>}
   */
  async modifyOrder(orderId: string, type: OrderType, side: OrderSide, amount: number, price: number): Promise<Order> {
    const args = { orderId, symbol: this.symbol, type, side, amount, price };

    try {
      const order = await modifyOrder(orderId, this.symbol, type, side, amount, price);

      log('Exchange::modifyOrder', 'Order modified', {
        args,
        order,
        before: this.ordersByClientId.get(orderId) ?? null,
      });

      return order;
    } catch (e) {
      throw new BaseError(e, { ...args, order: this.ordersByClientId.get(orderId) });
    }
  }

  /**
   * Cancel order by id
   * @param orderId - order id
   * @returns {Promise<Order>}
   */
  async cancelOrder(orderId: string): Promise<Order> {
    try {
      if (typeof orderId !== 'string') {
        error('Exchange:cancelOrder ', 'orderId must be string ', { orderId, orderIdType: typeof orderId });
        return {};
      }
      const order = await cancelOrder(orderId, this.symbol);

      if (isTester()) {
        const order = await getOrder(orderId);
        if (order.status !== 'canceled' && order.status !== 'closed') {
          error('Exchange:cancelOrder ', 'Order not canceled', {
            orderId,
            symbol: this.symbol,
            order,
          });
          return;
        }
      }

      log('Exchange:cancelOrder', 'Order canceled', { orderId, symbol: this.symbol });

      return order;
    } catch (e) {
      throw new BaseError(e, { orderId, symbol: this.symbol });
    }
  }

  /**
   * Create take profit order (close position)
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount - order amount
   * @param takeProfitPrice - trigger price (take profit price)
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async createTakeProfitOrder(
    sideToClose: OrderSide,
    amount: number,
    takeProfitPrice: number,
    params = {},
  ): Promise<Order> {
    const side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    return this.createOrder('market', side, amount, takeProfitPrice, {
      ...params,
      takeProfitPrice,
      reduceOnly: true,
    });
  }

  /**
   * Create stop loss order (close position)
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount  - order amount
   * @param stopLossPrice - trigger price (stop loss price)
   * @param params - params for createOrder function (see createOrder function)
   * @note - stop loss order could be only market type
   * @returns {Promise<Order>}
   */
  async createStopLossOrder(
    sideToClose: OrderSide,
    amount: number,
    stopLossPrice: number,
    params = {},
  ): Promise<Order> {
    const side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    return this.createOrder('market', side, amount, stopLossPrice, {
      ...params,
      stopLossPrice,
      reduceOnly: true,
    });
  }

  // ------------- Triggered orders ----------------
  // note: This function uses our own library for working with trigger orders.
  // It is important to note that these orders are not placed directly into the exchange's order book. Instead, they are stored locally
  // and are activated only when the market price reaches the specified trigger price.
  // Once activated, the corresponding order (market or limit) is sent to the exchange for execution.
  /**
   * Creates a trigger order (market or limit) that is sent to the exchange when the price reaches the specified trigger price.
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price - order price (used only for limit orders)
   * @param triggerPrice - trigger price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<void>}
   */
  async createTriggeredOrder(
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    triggerPrice: number,
    params = {},
  ): Promise<Order> {
    return this.createOrder(type, side, amount, price, { ...params, triggerPrice });
  }

  /**
   * Create reduce only order (close position)
   * @param type - 'market' or 'limit'
   * @param sideToClose - 'buy' | 'sell' | 'long | 'short
   * @param amount - order amount
   * @param price -  order price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  createReduceOrder = async (
    type: OrderType,
    sideToClose: OrderSide | 'long' | 'short',
    amount: number,
    price: number,
    params = {},
  ): Promise<Order> => {
    let side: OrderSide;
    //TODO keep sideToClose only long short (sideToClose -> posSideToClose = long short)
    if (sideToClose === 'buy' || sideToClose === 'long') side = 'sell';
    if (sideToClose === 'sell' || sideToClose === 'short') side = 'buy';
    return await this.createOrder(type, side, amount, price, { ...params, reduceOnly: true });
  };

  getExtendedOrders(): ExchangeOrder[] {
    return Array.from(this.ordersByClientId.values()).map((order) => {
      const { ownerClientOrderId, shortClientId } = this.parseClientOrderId(order.clientOrderId);
      const stopOrderData = this.stopOrdersByOwnerShortId.get(ownerClientOrderId);
      let stopOrder: Order;

      if (stopOrderData) {
        const tpOrder = this.ordersByClientId.get(stopOrderData.tpClientOrderId);
        const slOrder = this.ordersByClientId.get(stopOrderData.slClientOrderId);

        if (tpOrder?.status === 'closed') {
          stopOrder = tpOrder;
        }

        if (slOrder?.status === 'closed') {
          stopOrder = slOrder;
        }
      }

      return {
        id: order.id,
        clientOrderId: order.clientOrderId,
        shortClientId: shortClientId,
        side: order.side as 'buy' | 'sell',
        openPrice: order.price,
        closePrice: stopOrder ? stopOrder.price : 0,
        amount: order.amount,
        status: order.status,
        profit: stopOrder ? positionProfit(order.side, order.price, stopOrder.price, order.amount) : 0,
        reduceOnly: order.reduceOnly,
        cost: Math.abs(order.price * order.amount),
        dateOpen: timeToString(order.timestamp),
        dateClose: stopOrder ? timeToString(stopOrder.timestamp) : '',
        userParams: order.userParams,
      };
    });
  }

  async getPositionBySide(side: 'short' | 'long'): Promise<Position> {
    if (side !== 'long' && side !== 'short') {
      throw new BaseError(`Exchange::getPositionBySide`, `wrong position side: ${side}`);
    }

    const positions = await this.getPositions();
    let pos;

    if (!isTester()) {
      //for binance could be 3 positions in array (long, short, both)
      pos = positions.filter((position) => position.side === side)?.[0];
    } else {
      if (positions[0] && positions[0]?.side === side) {
        pos = positions[0];
      } else if (positions[1] && positions[1]?.side === side) {
        pos = positions[1];
      }
    }

    if (!pos) {
      return {
        emulated: true,
        side: side,
        symbol: this.symbol,
        entryPrice: 0,
        contracts: 0,
        unrealizedPnl: 0,
        leverage: 0,
        liquidationPrice: 0,
        collateral: 0,
        notional: 0,
        markPrice: 0,
        timestamp: 0,
        initialMargin: 0,
        initialMarginPercentage: 0,
        maintenanceMargin: 0,
        maintenanceMarginPercentage: 0,
        marginRatio: 0,
        datetime: '',
        hedged: this.hedgeMode,
        percentage: 0,
        contractSize: 0,
      };
    }
    return pos;
  }

  async getPositions() {
    return getPositions([this.symbol]);
  }

  private async createSlTpOrders(ownerClientOrderId: string, sl?: number, tp?: number) {
    if (!sl && !tp) return;

    const orderToClose = this.ordersByClientId.get(ownerClientOrderId);

    if (!orderToClose) {
      warning('Exchange::createSlTpOrders', 'Order not found or not closed', { ownerClientOrderId });
      return;
    }

    let slOrder: Order;
    let tpOrder: Order;

    if (sl) {
      slOrder = await this.createStopLossOrder(orderToClose.side as OrderSide, orderToClose.amount, sl, {
        ownerClientOrderId,
        triggerOrderType: 'SL',
        prefix: this.prefix,
      });
    }

    if (tp) {
      tpOrder = await this.createTakeProfitOrder(orderToClose.side as OrderSide, orderToClose.amount, tp, {
        ownerClientOrderId,
        triggerOrderType: 'TP',
        prefix: this.prefix,
      });
    }
    log('Exchange::createSlTpOrders', 'Stop order created', {
      tp,
      sl,
      tpOrder,
      slOrder,
      ownerClientOrderId,
      prefix: this.prefix,
    });
    this.stopOrdersByOwnerShortId.set(ownerClientOrderId, {
      slOrderId: slOrder?.id,
      slClientOrderId: slOrder?.clientOrderId,
      tpOrderId: tpOrder?.id,
      tpClientOrderId: tpOrder?.clientOrderId,
      ownerOrderClientId: ownerClientOrderId,
    });

    return { slOrder, tpOrder };
  }

  private createTriggerOrderByTask(taskParams: CreateTriggerOrderByTaskParams) {
    const { type, side, amount, params, price } = taskParams;

    log('Exchange::createOrderByTriggers', '', { orderParams: taskParams });

    return this.createOrder(type, side, amount, price, params);
  }

  private generateClientOrderId(
    prefix: string,
    type: OrderType,
    isReduce = false,
    ownerClientOrderId?: string,
    triggerOrderType?: string,
  ) {
    let idPrefix = type === 'market' ? 'M' : 'L';
    if (isReduce && !ownerClientOrderId) {
      idPrefix = 'R';
    }
    let id = `${normalize(tms() / 1000, 0)}-${prefix}-${idPrefix}${this.nextOrderId++}`;

    if (ownerClientOrderId) {
      if (triggerOrderType !== 'SL' && triggerOrderType !== 'TP') {
        error(
          'Exchange::generateClientOrderId',
          'triggerOrderType (SL or TP) is required to generate clientId for linked stopOrders',
          { prefix, type, isReduce, ownerClientOrderId, triggerOrderType },
        );
      } else {
        id = ownerClientOrderId + '.' + triggerOrderType;
      }
    }

    if (this._connectionName === 'gateio') id = `t-${id}`;

    return id;
  }

  protected parseClientOrderId(clientOrderId: string) {
    const split = clientOrderId.split('-');

    if (this._connectionName === 'gateio') {
      split.shift();
    }

    let shortClientId = split[2];

    let triggerOrderType = undefined;
    let ownerClientOrderId = undefined;
    let shortOwnerClientId = undefined;

    if (shortClientId) {
      let splitShortId = shortClientId.split('.');

      triggerOrderType = splitShortId[1] ?? null;
      shortOwnerClientId = splitShortId[0];
      ownerClientOrderId = triggerOrderType ? split[0] + '-' + split[1] + '-' + shortOwnerClientId : null;
    }

    return {
      uniquePrefix: split[0] ?? null,
      prefix: split[1] ?? null,
      shortClientId,
      ownerClientOrderId,
      triggerOrderType,
      clientOrderId: clientOrderId,
    };
  }

  private validateParams(params: Record<string, unknown>): {
    orderParams: Record<string, number | string | boolean>;
    userParams: Record<string, number | string | boolean>;
  } {
    const orderParams = {};
    const userParams = {};

    const allowedParams = {
      positionSide: this.hedgeMode && this._connectionName.toLowerCase().includes('binance'),
      positionIdx: this._connectionName.toLowerCase().includes('bybit') && this.hedgeMode,
      timeInForce: true,
      leverage: true,
      clientOrderId: true,
      stopPrice: true,
      triggerPrice: true,
      reduceOnly: true, // TODO check  - binance generate error if reduceOnly = true and stopPrice or triggerPrice set
      takeProfitPrice: true,
      stopLossPrice: true,
    };

    if (this.hedgeMode) {
      if (this._connectionName.toLowerCase().includes('binance')) {
        allowedParams['reduceOnly'] = false; // for binance -  reduceOnly not used because has positionSide is enough
      }
      if (this._connectionName.toLowerCase().includes('bybit')) {
        params['positionIdx'] = params['positionSide'] === 'long' ? '1' : '2';
      }
    }

    for (let key in params) {
      if (allowedParams[key]) {
        orderParams[key] = params[key];
      } else {
        userParams[key] = params[key];
      }
    }

    log('Exchange::validateParams', '', {
      params,
      userParams,
      orderParams,
      allowedParams,
      connectionName: this._connectionName,
    });

    return { orderParams, userParams };
  }

  async getOrders() {
    return await getOrders(this.symbol);
  }
  getContractsAmount = (usdAmount: number, executionPrice?: number) => {
    if (!executionPrice) {
      executionPrice = this.close();
    }
    // contractSize = 10 xrp
    // 1 xrp = 0.5 usd   1 contract = 10 xrp = 5 usd
    return usdAmount / executionPrice / this.contractSize; // 100 / 0.5 / 10 = 20
  };

  getUsdAmount = (contractsAmount: number, executionPrice?: number) => {
    if (!executionPrice) {
      executionPrice = this.close();
    }
    // contractSize = 10 xrp
    // xrp = 0.5 usd   1 contract = 10 xrp = 5 usd
    return contractsAmount * executionPrice * this.contractSize; // 1*0.5*10 = 5
  };

  ask() {
    return ask(this.symbol)?.[0];
  }

  askVolume() {
    return ask(this.symbol)?.[1];
  }

  bid() {
    return bid(this.symbol)?.[0];
  }

  bidVolume() {
    return bid(this.symbol)?.[1];
  }

  high() {
    return high(this.symbol);
  }

  low() {
    return low(this.symbol);
  }

  open() {
    return open(this.symbol);
  }

  close() {
    return close(this.symbol);
  }

  volume() {
    return volume(this.symbol);
  }

  unsubscribe() {
    globals.events.unsubscribeByObjectId(this.id);
    this.triggerService.cancelAll();
  }

  async marketInfoShort(): Promise<MarketInfoShort> {
    let info = {} as MarketInfoShort;

    let posBuy = await this.getPositionBySide('long');
    let posSell = await this.getPositionBySide('short');

    info.symbol = this.symbol;
    info.buyContracts = posBuy.contracts;
    info.buySizeUsd = this.getUsdAmount(posBuy.contracts, posBuy.entryPrice);
    info.BuyEntryPrice = posBuy.entryPrice;
    info.sellContracts = posSell.contracts;
    info.sellSizeUsd = this.getUsdAmount(posSell.contracts, posSell.entryPrice);
    info.sellEntryPrice = posSell.entryPrice;

    return info;
  }
}
