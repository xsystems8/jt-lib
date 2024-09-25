import { ReportWidget } from './report-widget';

export class TradingViewChart extends ReportWidget {
  private readonly _widgetName: string;
  private readonly _interval: number;
  private _shapes: TVUserShape[] = [];
  private _multipointShapes = [];
  private _table: TVTableShapeItem[] = [];
  private _indicator: CustomIndicator = null;
  private _oscillator: CustomOscillator = null;
  private _lastShapeId = 1;

  constructor(params: ReportTradingViewChartParams) {
    super();
    this._widgetName = params.name;
    this._interval = params.interval;
  }

  private updateTable(data: TVTableShapeItem | TVTableShapeItem[]) {
    if (Array.isArray(data)) {
      this._table = [...this._table, ...data];
    } else {
      this._table.push(data);
    }
  }

  addShape(shape: TradingViewShapes, params?: AddShapeParams) {
    const { coords = { price: close(), time: tms() }, color = 'red', text = '', props = {} } = params;

    const shapeId = this._lastShapeId++;
    this.updateTable({ id: shapeId, shape, text, color, price: coords.price, timestamp: coords.time, ...props });

    this._shapes.push({ id: shapeId, shape, coords, color, text });
  }

  addMultipointShape(shape: TradingViewMultipointShapes, params: AddMultipointShapeParams) {
    const { coords, color = 'red', text = '', props = {} } = params;

    const shapeId = this._lastShapeId++;

    const price = coords[0].price;
    const timestamp = coords[0].time;
    const priceEnd = coords[1].price;
    const timestampEnd = coords[1].time;

    this.updateTable({
      id: shapeId,
      shape,
      text,
      color,
      price,
      timestamp,
      priceEnd,
      timestampEnd,
    });

    this._multipointShapes.push({ id: shapeId, shape, coords, color, text });
  }

  addIndicator(params: AddIndicatorParams) {
    const { name, description = 'Custom indicator', data } = params;
    this._indicator = {
      name,
      description,
      timeframe: parseInt(ARGS.timeframe),
      data,
    };
  }

  addOscillator(params: AddOscillatorParams) {
    const { name, description = 'Custom oscillator', data } = params;
    this._oscillator = {
      name,
      description,
      timeframe: parseInt(ARGS.timeframe),
      data,
    };
  }

  prepareToReport(): TVChartDataReportBlock {
    const startDate = new Date(ARGS.startDate.getTime());
    const endDate = new Date(ARGS.endDate.getTime());
    endDate.setMonth(endDate.getMonth() + 1);

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return {
      type: 'trading_view_chart',
      name: this._widgetName,
      data: {
        interval: this._interval,
        startTime,
        endTime,
        shapes: this._shapes,
        table: this._table,
        indicator: this._indicator,
        oscillator: this._oscillator,
      },
    };
  }
}

export interface ReportTradingViewChartParams {
  name: string;
  interval: number;
}

export enum TradingViewShapes {
  ARROW_UP = 'arrow_up',
  ARROW_DOWN = 'arrow_down',
  FLAG = 'flag',
  VERTICAL_LINE = 'vertical_line',
  HORIZONTAL_LINE = 'horizontal_line',
  ICON = 'icon',
  EMOJI = 'emoji',
  STICKER = 'sticker',
  ANCHORED_TEXT = 'anchored_text',
  ANCHORED_NOTE = 'anchored_note',
}

export enum TradingViewMultipointShapes {
  TRIANGLE = 'triangle',
  CURVE = 'curve',
  CIRCLE = 'circle',
  ELLIPSE = 'ellipse',
  PATH = 'path',
  POLYLINE = 'polyline',
  TEXT = 'text',
  ICON = 'icon',
  EXTENDED = 'extended',
  ANCHORED_TEXT = 'anchored_text',
  ANCHORED_NOTE = 'anchored_note',
  NOTE = 'note',
  SIGNPOST = 'signpost',
  DOUBLE_CURVE = 'double_curve',
  ARC = 'arc',
  EMOJI = 'emoji',
  ARROW_UP = 'arrow_up',
  ARROW_DOWN = 'arrow_down',
  ARROW_LEFT = 'arrow_left',
  ARROW_RIGHT = 'arrow_right',
  PRICE_LABEL = 'price_label',
  PRICE_NOTE = 'price_note',
  ARROW_MARKER = 'arrow_marker',
  FLAG = 'flag',
  VERTICAL_LINE = 'vertical_line',
  HORIZONTAL_LINE = 'horizontal_line',
  CROSS_LINE = 'cross_line',
  HORIZONTAL_RAY = 'horizontal_ray',
  TREND_LINE = 'trend_line',
  INFO_LINE = 'info_line',
  TREND_ANGLE = 'trend_angle',
  ARROW = 'arrow',
  RAY = 'ray',
  PARALLEL_CHANNEL = 'parallel_channel',
  DISJOINT_ANGLE = 'disjoint_angle',
  FLAT_BOTTOM = 'flat_bottom',
  PITCHFORK = 'pitchfork',
  SCHIFF_PITCHFORK_MODIFIED = 'schiff_pitchfork_modified',
  SCHIFF_PITCHFORK = 'schiff_pitchfork',
  BALLOON = 'balloon',
  COMMENT = 'comment',
  INSIDE_PITCHFORK = 'inside_pitchfork',
  PITCHFAN = 'pitchfan',
  GANNBOX = 'gannbox',
  GANNBOX_SQUARE = 'gannbox_square',
  GANNBOX_FIXED = 'gannbox_fixed',
  GANNBOX_FAN = 'gannbox_fan',
  FIB_RETRACEMENT = 'fib_retracement',
  FIB_TREND_EXT = 'fib_trend_ext',
  FIB_SPEED_RESIST_FAN = 'fib_speed_resist_fan',
  FIB_TIMEZONE = 'fib_timezone',
  FIB_TREND_TIME = 'fib_trend_time',
  FIB_CIRCLES = 'fib_circles',
  FIB_SPIRAL = 'fib_spiral',
  FIB_SPEED_RESIST_ARCS = 'fib_speed_resist_arcs',
  FIV_CHANNEL = 'fib_channel',
  XABCD_PATTERN = 'xabcd_pattern',
  CYPHER_PATTERN = 'cypher_pattern',
  ABCD_PATTERN = 'abcd_pattern',
  CALLOUT = 'callout',
  TRIANGLE_PATTERN = 'triangle_pattern',
  // 3DIVERS_PATTERN = '3divers_pattern',
  HEAD_AND_SHOULDERS = 'head_and_shoulders',
  FIB_WEDGE = 'fib_wedge',
  ELLIOT_IMPULSE_WAVE = 'elliott_impulse_wave',
  ELLIOT_TRIANGLE_WAVE = 'elliott_triangle_wave',
  ELLIOT_TRIPLE_COMBO = 'elliott_triple_combo',
  ELLIOT_CORRECTION = 'elliott_correction',
  ELLIOT_DOUBLE_COMBO = 'elliott_double_combo',
  CYCLIC_LINES = 'cyclic_lines',
  TIME_CYCLES = 'time_cycles',
  SINE_LINE = 'sine_line',
  LONG_POSITION = 'long_position',
  SHORT_POSITION = 'short_position',
  FORECAST = 'forecast',
  DATE_RANGE = 'date_range',
  PRICE_RANGE = 'price_range',
  DATE_AND_PRICE_RANGE = 'date_and_price_range',
  BARS_PATTERN = 'bars_pattern',
  GHOST_FEED = 'ghost_feed',
  PROJECTION = 'projection',
  RECTANGLE = 'rectangle',
  ROTATED_RECTANGLE = 'rotated_rectangle',
  BRUSH = 'brush',
  HIGHLIGHTER = 'highlighter',
  REGRESSION_TREND = 'regression_trend',
  FIXED_RANGE_VOLUME_PROFILE = 'fixed_range_volume_profile',
  STICKER = 'sticker',
  ANCHORED_VWAP = 'anchored_vwap',
}

export interface ShapeCoords {
  price: number;
  time: number;
}

interface TVUserShape {
  id: number;
  coords: ShapeCoords;
  shape: TradingViewShapes;
  text?: string;
  color?: string;
}

interface TVTableShapeItem {
  id: number;
  [key: string]: string | number;
}

interface CustomIndicator {
  name?: string;
  description?: string;
  timeframe: number;
  data: CustomIndicatorData[];
}

interface CustomIndicatorData {
  timestamp: number;
  value: number;
}

interface CustomOscillator {
  name?: string;
  description?: string;
  timeframe: number;
  data: CustomOscillatorData[];
}

interface CustomOscillatorData {
  timestamp: number;
  value: number;
}

export interface AddShapeParams {
  coords?: ShapeCoords;
  color?: string;
  text?: string;
  props?: Record<string, string | number | boolean>;
}

export interface AddMultipointShapeParams {
  coords: ShapeCoords[];
  color?: string;
  text?: string;
  props?: Record<string, string | number | boolean>;
}

export interface AddIndicatorParams {
  name: string;
  description?: string;
  data: CustomIndicatorData[];
}

export interface AddOscillatorParams {
  name: string;
  description?: string;
  data: CustomOscillatorData[];
}
