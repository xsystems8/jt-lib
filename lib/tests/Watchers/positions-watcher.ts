import { globals } from '../../globals';
import { checkPositionStructure } from '../helpers';
import { Watcher } from './watcher';
import { isZero } from '../../utils/numbers';
import { errorOnce } from '../../log';
import { currentTimeString } from '../../utils/date-time';

export class PositionsWatcher extends Watcher {
  private isHedged: boolean;
  private isPositionsUpdated: boolean;
  buySize = 0;
  sellSize = 0;

  constructor() {
    super();

    globals.events.subscribe('onOrderChange', this.onOrderChange, this);
    globals.events.subscribe('onBeforeTick', this.checkPositions, this);
    globals.events.subscribe('onBeforeTick', this.addSizeToChart, this);
  }

  async onOrderChange(order: Order) {
    await this._updatePosSlot(order); //updatePosition -> checkPosition
  }

  profit = 0;

  _updatePosSlot = async (order: Order) => {
    if (order.status === 'closed') {
      if (order.reduceOnly) {
        if (order.side === 'sell') {
          this.buySize = this.buySize - order.amount;
        }
        if (order.side === 'buy') {
          this.sellSize = this.sellSize - order.amount;
        }
      } else {
        if (order.side === 'buy') {
          this.buySize = this.buySize + order.amount;
        }
        if (order.side === 'sell') {
          this.sellSize = this.sellSize + order.amount;
        }
      }

      this.isHedged = true;

      let posSide = 'both'; //
      let isReduce = order.reduceOnly;
      let side = order.side === 'buy' ? 'long' : 'short';
      if (isReduce) side = side === 'long' ? 'short' : 'long';
      if (this.isHedged) posSide = side;

      let posSlot = this.getPosSlot(posSide);
      if (!posSlot.side) posSlot.side = side;

      if (isReduce) {
        let profit = 0;
        if (order.side === 'sell') {
          profit += order.amount * (order.price - posSlot.entryPrice);
        } else {
          profit += order.amount * (posSlot.entryPrice - order.price);
        }

        this.profit += profit;
        posSlot.profit += profit;

        //  global.report.chartAddPointAgg('Profit Comparison Watcher', 'Profit calc', this.profit, 'last');
        //  global.report.chartAddPointAgg('Profit Comparison Watcher', 'Profit', await getProfit(), 'last');
      }

      if (!isReduce) {
        posSlot.entryPrice =
          (posSlot.size * posSlot.entryPrice + order.amount * order.price) / (posSlot.size + order.amount);

        posSlot.size += order.amount;
      } else {
        if (posSlot.size - order.amount === 0) {
          posSlot.entryPrice = 0;
        }
        posSlot.size -= order.amount;
      }

      posSlot.size = isZero(posSlot.size) ? 0 : posSlot.size;

      if (posSlot.size < 0) {
        errorOnce('basket:updatePosSlot', 'posSlot.size < 0', {
          posSlot: posSlot,
          order: order,
        });
      }
      // _consoleInfo('ob:updatePosSlot', 'posSlot.size', { posSlot: posSlot });
      // ko();
      this._posSlot[posSide] = posSlot;
      this.isPositionsUpdated = true;
      let posSize = null;

      let positions = await getPositions();
      for (let pos of positions) {
        if (pos.side === posSide) {
          posSize = pos.contracts;
        }
      }
      let row = {
        currentTime: currentTimeString(),
        id: order.id,
        clId: order.clientOrderId,
        datetime: order.datetime,
        posSide: posSide,
        currentPrice: close(),
        entryPrice: posSlot.entryPrice,
        orderSide: order.side,
        orderSize: order.amount,
        calcSize1: posSlot.size,
        calcSize2: posSide === 'long' ? this.buySize : this.sellSize,
        posSize: posSize,
        reduce: order.reduceOnly,
      };

      globals.report.tableUpdate('Position changes', row, 'clId');
    }
  };

  _posSlot = {};
  getPosSlot(posSide = 'both') {
    // _consoleInfo('ob:getPosSlot', 'getPosSlot', { slot: posSide, side: side });
    if (!this._posSlot[posSide]) {
      this._posSlot[posSide] = {
        side: '',
        size: 0,
        entryPrice: 0,
        profit: 0,
      };
    }
    return this._posSlot[posSide];
  }
  async checkPositions() {
    let positions = await getPositions();

    if (positions.length > 2) {
      this.errorOnce('checkPositions', 'positions.length > 2 || maximum 2 slots (short,long)', {
        positions: positions,
      });
    }

    for (let pos of positions) {
      let ownPos = this.isHedged ? this.getPosSlot(pos.side) : this.getPosSlot('both');

      //size
      if (!isZero(pos.contracts - ownPos.size)) {
        this.errorOnce('checkPositions', 'pos.size != ownPos.size = ' + ownPos.size, {
          posSide: pos.side,
          posContracts: pos.contracts,
          calcContracts: ownPos.size,
          buySize: this.buySize,
          sellSize: this.sellSize,
          positions: positions,
          ownPos: ownPos,
        });
      }
      //entryPrice
      if (!isZero(pos.entryPrice - ownPos.entryPrice)) {
        this.errorOnce('checkPositions', 'pos.entryPrice != ownPos.entryPrice', {
          positions: positions,
          ownPos: ownPos,
        });
      }

      //check structure
      this.addErrors(checkPositionStructure(pos));
    }
  }

  async addSizeToChart() {
    if (!this.isPositionsUpdated) {
      return;
    } else {
      this.isPositionsUpdated = false;
    }
    let positions = await getPositions();

    let buySize = 0;
    let sellSize = 0;
    let bothSize = 0;
    let entryPriceBuy = 0;
    let entryPriceSell = 0;
    for (let pos of positions) {
      if (pos.side === 'long') {
        buySize += pos.contracts;
        entryPriceBuy = pos.entryPrice;
      }
      if (pos.side === 'short') {
        sellSize += pos.contracts;
        entryPriceSell = pos.entryPrice;
      }
      bothSize += pos.contracts;
    }

    if (this.isHedged) {
      globals.report.chartAddPoint('Positions size', 'Calc long', this._posSlot['long']?.size ?? 0);
      globals.report.chartAddPoint('Positions size', 'Real long', buySize);

      globals.report.chartAddPoint('Positions size', 'Calc short', this._posSlot['short']?.size ?? 0);
      globals.report.chartAddPoint('Positions size', 'Real short', sellSize);

      globals.report.chartAddPoint('Entry price', 'Calc long', this._posSlot['long']?.entryPrice ?? 0);
      globals.report.chartAddPoint('Entry price', 'Real long', entryPriceBuy);

      globals.report.chartAddPoint('Entry price', 'Calc short', this._posSlot['short']?.entryPrice ?? 0);
      globals.report.chartAddPoint('Entry price', 'Real short', entryPriceSell);
    } else {
      globals.report.chartAddPoint('Positions size', 'Calc both', this._posSlot['both']?.size ?? 0);
      globals.report.chartAddPoint('Positions size', 'Real both', bothSize);
    }
  }
}
