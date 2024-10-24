import { ReportTable, TableRow } from './widgets/report-table';
import { ChartType, ReportChart, ReportChartOptions } from './widgets/report-chart';
import { ReportCard, ReportCardParams } from './widgets/report-card';
import {
  AddShapeParams,
  ShapeCoords,
  TradingViewChart,
  TradingViewMultipointShapes,
  TradingViewShapes,
} from './widgets/report-tv';
import { ReportActionButton } from './widgets/report-action-button';
import { ReportText, TextOptions } from './widgets/report-text';
import { error, errorOnce, getLogs, log, logOnce, warningOnce } from '../log';
import { BaseObject } from '../base-object';
import { AggType, ExtendedReportChartOptions } from './types';
import { BufferIndicatorItem } from '../indicator/types';
import { BaseError } from '../Errors';
import { deleteObject } from '../utils/objects';

/**
 * Report - provide functionality for create report of trading strategy. Report can be viewed in web interface.
 * Widgets:
 * - Cards - show value of some variable
 * - Tables - show data in table
 * - Charts - show chart with lines
 * - TradingView charts - show chart with indicators and shapes
 *
 *  @note: for tester report should be updated in OnStop() function when script is finished.
 *  @note: for real trading report could be updated by time interval. But it is not recommended to update report too often.
 *  default interval: 5 sec.
 */

type LayoutInfoObjType = 'table' | 'chart' | 'text' | 'tvChart' | 'card' | 'actionButton';
type LayoutInfo = {
  type: LayoutInfoObjType;
  name: string;
  index: number;
};

export class Report extends BaseObject {
  private title: string;
  private description: string;
  private tables: Record<string, ReportTable> = {};
  private cards: Record<string, ReportCard> = {};
  private optimizedValues: Record<string, ReportCard> = {};
  private texts: Record<string, ReportText> = {};
  private charts: Record<string, ReportChart> = {};
  private tvCharts: Record<string, TradingViewChart> = {};
  private actionButtons: Record<string, ReportActionButton> = {};

  private _layoutIndexes: Record<string, LayoutInfo> = {};
  private _layoutIterator = 0;
  private _layoutIAllowedTypes = ['table', 'chart', 'text', 'tvChart', 'card', 'actionButton'];
  isSetLayoutIndexByDefault: boolean = true;

  symbol: string = ARGS.symbol;

  private _reportData: ReportData;

  isLogToReport = true;

  lastTimeUpdate = 0;
  chartCoinsBasket = new ReportChart('Coins Basket', { chartType: ChartType.Line, aggPeriod: 24 * 60 * 60 * 1000 }); // 4 hours
  constructor(args) {
    super(args);
  }

  setLayoutIndex(type: LayoutInfoObjType, name: string, index: number = undefined) {
    if (!index) index = this._layoutIterator = this._layoutIterator + 100;

    if (!this._layoutIAllowedTypes.includes(type)) {
      throw new BaseError('Report::setLayoutIndex: type should be table, chart, text or tvChart', {
        type,
        name,
        index,
        allowedTypes: this._layoutIAllowedTypes,
      });
    }
    let objInfo: LayoutInfo = {
      type,
      name,
      index,
    };

    const key = type + '-' + name;
    this._layoutIndexes[key] = objInfo;
  }

  deleteLayoutIndex(type: LayoutInfoObjType, name: string) {
    const key = type + '-' + name;
    delete this._layoutIndexes[key];
  }

  async updateReportByLayoutIndex(args = {}) {
    // sort this._layoutIndexes[key].index by index
    let ReportObjects: LayoutInfo[] = Object.values(this._layoutIndexes).sort((a, b) => a.index - b.index);
    //TODO  delete symbols from reportData
    let reportData: ReportData = {
      id: getArtifactsKey(),
      symbol: '',
      blocks: [],
    };
    let objNotExists = [];
    //sort by index
    try {
      if (this.title) {
        reportData.blocks.push(new ReportText(this.title, 'h1', 'center').prepareDataToReport());
      }

      if (this.description) {
        reportData.blocks.push(new ReportText(this.description, 'subtitle1', 'center').prepareDataToReport());
      }

      for (let objInfo of ReportObjects) {
        switch (objInfo.type) {
          case 'table':
            let obj = this.tables[objInfo.name];
            if (obj) {
              reportData.blocks.push(obj.prepareDataToReport());
            } else {
              objNotExists.push(objInfo);
            }
            break;
          case 'chart':
            let chart = this.charts[objInfo.name];
            if (chart) {
              reportData.blocks.push(chart.prepareDataToReport());
            } else {
              objNotExists.push(objInfo);
            }
            break;
          case 'text':
            let text = this.texts[objInfo.name];
            if (text) {
              reportData.blocks.push(text.prepareDataToReport());
            } else {
              objNotExists.push(objInfo);
            }
            break;
          case 'card':
            let card = this.cards[objInfo.name];
            if (card) {
              reportData.blocks.push(card.prepareDataToReport());
            } else {
              objNotExists.push(objInfo);
            }
            break;
          case 'actionButton':
            let actionButton = this.actionButtons[objInfo.name];
            if (actionButton) {
              reportData.blocks.push(actionButton.prepareDataToReport());
            } else {
              objNotExists.push(objInfo);
            }
            break;
        }
      }

      // if (objNotExists.length > 0) {
      //   logOnce('report.updateReportByLayoutIndex', 'Report objects not exists', { objNotExists });
      // }

      if (this.isLogToReport) {
        let logs = getLogs('error');
        if (logs.length > 0) {
          reportData.blocks.push({
            type: 'table',
            name: 'Warnings & Errors',
            isVisible: true,
            data: logs.slice(0, 100),
          });
        }

        logs = getLogs('trace');
        if (logs.length > 0) {
          let to = Math.min(Math.round(logs.length / 2), 100);
          reportData.blocks.push({
            type: 'table',
            name: 'Trace',
            isVisible: true,
            data: logs.slice(0, to).concat(logs.slice(-to)),
          });
        }

        logs = getLogs('log');
        if (logs.length > 0) {
          let to = Math.min(Math.round(logs.length / 2), 100);

          reportData.blocks.push({
            type: 'table',
            name: 'Log',
            isVisible: true,
            data: logs.slice(0, to).concat(logs.slice(-to)),
          });
        }

        //LOG ONCE
        logs = getLogs('logOnce');
        if (logs.length > 0) {
          reportData.blocks.push({
            type: 'table',
            name: 'LogOnce',
            isVisible: true,
            data: logs.slice(0, 200),
          });
        }
      }

      if (this.optimizedValues && isTester()) {
        let opResults = {};

        for (let valueName in this.optimizedValues) {
          try {
            let cardInfo = this.optimizedValues[valueName];
            opResults[valueName] = cardInfo.getValue();
          } catch (e) {
            error(e, { valueName });
          }
        }

        reportData.blocks.push({
          type: 'optimizer_results',
          name: 'Optimization results',
          data: opResults,
        });

        if (args['isChartOptimazer']) {
          reportData.blocks.push(await this.chartCoinsBasket.prepareDataToOptimizer());
        }
      }
    } catch (e) {
      error(e);
    }
    logOnce('Report::updateReportByLayoutIndex', 'Report Objects', {
      ReportObjects,

      objNotExists: objNotExists,
    });
    await updateReport(reportData);
  }

  setTitle(title: string) {
    this.title = title;
  }

  /**
   * Set description for report
   * @param description - description of report
   */
  setDescription(description: string) {
    this.description = description;
  }

  getCardByName(name: string): ReportCard {
    if (this.cards[name]) return this.cards[name];
    else {
      throw new BaseError('Report::getCardByName: card with name ' + name + ' not found');
    }
  }

  addCard(cardName: string, card: ReportCard) {
    this.cards[cardName] = card;
  }

  addTable(tableName: string, table: ReportTable) {
    this.tables[tableName] = table;
    this.setLayoutIndex('table', tableName);
  }

  addText(textName: string, text: ReportText) {
    this.texts[textName] = text;
    this.setLayoutIndex('text', textName);
  }

  addChart(chartName: string, chart: ReportChart) {
    this.charts[chartName] = chart;
    this.setLayoutIndex('chart', chartName);
  }

  addTVChart(chartName: string, chart: TradingViewChart) {
    this.tvCharts[chartName] = chart;
    this.setLayoutIndex('tvChart', chartName);
  }

  addActionButton(actionButtonName: string, actionButton: ReportActionButton) {
    this.actionButtons[actionButtonName] = actionButton;
  }

  getTextByName(name: string): ReportText | undefined {
    if (this.texts[name]) return this.texts[name];
    return undefined;
  }

  getTableByName(name: string): ReportTable | undefined {
    if (this.tables[name]) return this.tables[name];
    return undefined;
  }

  getChartByName(name: string): ReportChart | undefined {
    if (this.charts[name]) return this.charts[name];
    return undefined;
  }

  getTVChartByName(name: string): TradingViewChart | undefined {
    if (this.tvCharts[name]) return this.tvCharts[name];
    return undefined;
  }

  getActionButtonByName(name: string): ReportActionButton | undefined {
    if (this.actionButtons[name]) return this.actionButtons[name];
    return undefined;
  }

  createOptimizedCard(cardName: string, cardOptions?: ReportCardParams) {
    if (this.optimizedValues[cardName]) return;

    if (!cardOptions) cardOptions = {};
    cardOptions.title = cardName;

    this.optimizedValues[cardName] = new ReportCard(cardOptions);
  }

  optimizedSetValue(name: string, value: number | string | boolean, aggType: AggType = 'last') {
    if (!this.optimizedValues[name]) {
      this.createOptimizedCard(name);
    }
    this.optimizedValues[name].setValue(value, aggType);
  }

  createCard(cardName: string, params?: ReportCardParams) {
    if (this.cards[cardName]) return;

    if (!params) params = {};
    params.title = cardName;

    this.cards[cardName] = new ReportCard(params);

    if (this.isSetLayoutIndexByDefault) {
      this.setLayoutIndex('card', cardName);
    }
  }

  /**
   * Add card with value to report Card widget
   * @param cardName - name of card
   * @param value - value of card if value with the same cardName passed several times, then aggregation will be applied.
   * @param aggType - aggregation type (last, min, max, sum, avg) default: last
   * @param params - card params.
   * @returns void
   * @example
   * report.cardSetValue('profit', 100, 'sum');
   * report.cardSetValue('profit', 200, 'sum');
   * //profit card will be 300
   *
   */
  cardSetValue(
    cardName: string,
    value: number | string | boolean,
    aggType: AggType = 'last',
    params?: ReportCardParams,
  ) {
    if (!this.cards[cardName]) this.createCard(cardName, params);

    this.cards[cardName].setValue(value, aggType, params?.options);
  }

  createText(textName: string, text: string, textOptions?: TextOptions) {
    if (this.texts[textName]) return;

    this.texts[textName] = new ReportText(text, textOptions?.variant, textOptions?.align);

    if (this.isSetLayoutIndexByDefault) {
      this.setLayoutIndex('text', textName);
    }
  }

  textSetValue(textName: string, text: string, textOptions?: TextOptions) {
    if (!this.texts[textName]) this.createText(textName, text, textOptions);
    else this.texts[textName].setText(text);
  }

  createTable(tableName: string) {
    if (this.tables[tableName]) return;

    this.tables[tableName] = new ReportTable(tableName);

    if (this.isSetLayoutIndexByDefault) {
      this.setLayoutIndex('table', tableName);
    }
  }

  tableUpdate(tableName: string, data: TableRow[] | TableRow, idField: string = 'id') {
    if (!this.tables[tableName]) {
      this.createTable(tableName);
    }

    if (Array.isArray(data)) {
      this.tables[tableName].upsertRecords(data, idField);
    } else {
      this.tables[tableName].upsert(data, idField);
    }
  }

  createChart(chartName: string, options?: ReportChartOptions) {
    if (this.charts[chartName]) return;

    this.charts[chartName] = new ReportChart(chartName, options);

    if (this.isSetLayoutIndexByDefault) {
      this.setLayoutIndex('chart', chartName);
    }
  }

  chartAddPointAgg(
    chartName: string,
    lineName: string,
    pointValue: number,
    aggType: AggType = 'last',
    options?: ExtendedReportChartOptions,
  ) {
    if (isNaN(pointValue)) {
      warningOnce(
        'report.chartAddPointAgg',
        ' pointValue should be Number pointValue=' + pointValue + ' chartName=' + chartName + ' lineName=' + lineName,
        {},
        86400000,
      );

      pointValue = null;
    }

    if (!this.charts[chartName]) {
      this.createChart(chartName, options);
    }

    this.charts[chartName].addPointAggByDate(lineName, pointValue, aggType, options?.lineColor);
  }

  chartAddPoint(chartName: string, lineName: string, pointValue: number, options?: ExtendedReportChartOptions) {
    if (!this.charts[chartName]) {
      this.createChart(chartName, options);
    }
    this.charts[chartName].addPointByDate(lineName, pointValue, options?.lineColor);
  }

  //TODO tvCharts should be only one chart
  // уtvCharts->tvChart and refactor tvCharts[chartName] to tvChart
  /**
   * Add arrows to TradingView chart widget for each order.
   * @param orders - array of orders
   * @param timeframe - timeframe of chart in minutes. Default: 60 (1h)
   * @returns void
   */
  tvChartAddOrders(orders: Order[], timeframe = 60) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: timeframe });
    }

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const shape = order.side === 'buy' ? TradingViewShapes.ARROW_UP : TradingViewShapes.ARROW_DOWN;
      const color = order.side === 'buy' ? 'green' : 'red';
      const coords = { price: order.price, time: order.timestamp };

      this.tvCharts[chartName].addShape(shape, { color, text: order.clientOrderId, coords });
    }
  }

  /**
   * Add shape to TradingView chart widget.
   * @param shape - shape type  (ARROW_UP, ARROW_DOWN, CIRCLE, CROSS, FLAG, LABEL, LINE, MARKER, SQUARE, TRIANGLE, X)
   * @param shapeParams - shape params { color, coords = {price,time}, text}
   * @param props - additional properties they will be added to table with key as column name and value as column value
   * @param timeframe - timeframe of chart in minutes. Default: 240 (4h)
   */
  tvChartAddShape(
    shape: TradingViewShapes,
    shapeParams: AddShapeParams,
    props?: Record<string, string | number | boolean>,
    timeframe = 240,
  ) {
    //
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: timeframe });
    }

    log('report.tvChartAddShapeA', 'add shape', { shape, params: shapeParams, props });
    this.tvCharts[chartName].addShape(shape, { ...shapeParams, props: props });
  }

  //NOT INCLUDE TO MANUAL it is not working correctly
  //TODO possibly need to create multipoint shape params type
  /**
   * Add shape to TradingView chart widget.
   * @param shape
   * @param color
   * @param text
   * @param endPoint
   */
  tvChartAddMultipointShape(shape: TradingViewMultipointShapes, color: string, text: string, endPoint: ShapeCoords) {
    //
    const chartName = 'tvChartMain';

    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 240 });
    }

    this.tvCharts[chartName].addMultipointShape(shape, {
      color,
      text,
      coords: [{ price: close(), time: tms() }, endPoint],
    });
  }

  tvChartAddIndicator(indicatorName: string, description: string, data: BufferIndicatorItem[]) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 1 });
    }

    this.tvCharts[chartName].addIndicator({ name: indicatorName, description, data });
  }

  tvChartAddOscillator(oscillatorName: string, description: string, data: BufferIndicatorItem[]) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 1 });
    }

    this.tvCharts[chartName].addOscillator({ name: oscillatorName, description, data });
  }

  createActionButton(title: string, action: string, value: string) {
    if (this.actionButtons[action]) return;

    this.actionButtons[action] = new ReportActionButton(title, action, value);

    if (this.isSetLayoutIndexByDefault) {
      this.setLayoutIndex('actionButton', action);
    }
  }

  dropActionButton(action: string) {
    delete this.actionButtons[action];

    this.deleteLayoutIndex('actionButton', action);
  }

  clearTable(tableName: string) {
    if (this.tables[tableName]) {
      this.tables[tableName].clear();
    }
  }
  dropTable(tableName: string) {
    error('Report::dropTable', 'not use this -> use clear', tableName);
    this.deleteLayoutIndex('table', tableName);
  }

  dropCard(cardName: string) {
    delete this.cards[cardName];
    this.deleteLayoutIndex('card', cardName);
  }

  dropChart(chartName: string) {
    delete this.charts[chartName];
    this.deleteLayoutIndex('chart', chartName);
  }

  dropTVChart(chartName: string) {
    delete this.tvCharts[chartName];
    this.deleteLayoutIndex('tvChart', chartName);
  }

  dropText(textName: string) {
    delete this.texts[textName];
    this.deleteLayoutIndex('text', textName);
  }

  async updateReport() {
    this.lastTimeUpdate = Date.now();

    this._reportData = {
      id: getArtifactsKey(),
      symbol: this.symbol,
      description: this.description,
      blocks: [],
    };

    if (this.title) {
      this._reportData.blocks.push(new ReportText(this.title, 'h1', 'center').prepareDataToReport());
    }

    if (this.description) {
      this._reportData.blocks.push(new ReportText(this.description, 'subtitle1', 'center').prepareDataToReport());
    }

    //----------------CARDS
    if (this.cards) {
      for (let cardName in this.cards) {
        try {
          let cardInfo = this.cards[cardName].prepareDataToReport();
          this._reportData.blocks.push(cardInfo);
        } catch (e) {
          error(e);
        }
      }
    }

    //----------------CHARTS
    if (this.charts) {
      for (let chartName in this.charts) {
        try {
          let chartInfo = this.charts[chartName].prepareDataToReport();
          this._reportData.blocks.push(chartInfo);
        } catch (e) {
          error(e);
        }
      }
    }

    //----------------TABLES
    if (this.tables) {
      for (let tableName in this.tables) {
        try {
          let tableInfo = this.tables[tableName].prepareDataToReport();
          this._reportData.blocks.push(tableInfo);
        } catch (e) {
          error(e);
        }
      }
    }

    //----------------OPTIMIZED VALUES
    if (this.optimizedValues) {
      let opResults = {};

      for (let valueName in this.optimizedValues) {
        try {
          let cardInfo = this.optimizedValues[valueName];
          opResults[valueName] = cardInfo.getValue();
        } catch (e) {
          error(e);
        }
      }

      this._reportData.blocks.push({
        type: 'optimizer_results',
        name: 'Optimization results',
        data: opResults,
      });
    }

    //----------------TRADING VIEW CHARTS
    if (this.tvCharts) {
      for (const chart in this.tvCharts) {
        try {
          const reportInfo = this.tvCharts[chart].prepareToReport();
          this._reportData.blocks.push(reportInfo);
        } catch (e) {
          error(e);
        }
      }
    }

    if (this.actionButtons) {
      for (const button in this.actionButtons) {
        try {
          this._reportData.blocks.push(this.actionButtons[button].prepareDataToReport());
        } catch (e) {
          error(e);
        }
      }
    }

    let logs = getLogs('error');
    if (logs.length > 0) {
      this._reportData.blocks.push({
        type: 'table',
        name: 'Warnings & Errors',
        isVisible: true,
        data: logs.slice(0, 100),
      });
    }

    logs = getLogs('trace');
    if (logs.length > 0) {
      let to = Math.min(Math.round(logs.length / 2), 100);
      this._reportData.blocks.push({
        type: 'table',
        name: 'Trace',
        isVisible: true,
        data: logs.slice(0, to).concat(logs.slice(-to)),
      });
    }

    logs = getLogs('log');
    if (logs.length > 0) {
      let to = Math.min(Math.round(logs.length / 2), 100);

      this._reportData.blocks.push({
        type: 'table',
        name: 'Log',
        isVisible: true,
        data: logs.slice(0, to).concat(logs.slice(-to)),
      });
    }

    //LOG ONCE
    logs = getLogs('logOnce');
    if (logs.length > 0) {
      this._reportData.blocks.push({
        type: 'table',
        name: 'LogOnce',
        isVisible: true,
        data: logs.slice(0, 200),
      });
    }

    await updateReport(this._reportData);
  }
}
