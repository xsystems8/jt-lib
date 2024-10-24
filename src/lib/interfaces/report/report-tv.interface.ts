export interface TVChartData {
  exchange: string;
  interval: number;
  startTime: number;
  endTime: number;
  table: Array<TVTableShapeItem>;
  shapes?: TVUserShape[];
  multipointShapes?: TVUserMultipointShape[];
  indicator?: CustomIndicator;
  oscillator?: CustomOscillator;
}

export type TVShape =
  | 'icon'
  | 'anchored_text'
  | 'anchored_note'
  | 'emoji'
  | 'arrow_up'
  | 'arrow_down'
  | 'flag'
  | 'vertical_line'
  | 'horizontal_line'
  | 'long_position'
  | 'short_position'
  | 'sticker';

export type TVMultipointShape =
  | 'triangle'
  | 'curve'
  | 'circle'
  | 'ellipse'
  | 'path'
  | 'polyline'
  | 'text'
  | 'icon'
  | 'extended'
  | 'anchored_text'
  | 'anchored_note'
  | 'note'
  | 'signpost'
  | 'double_curve'
  | 'arc'
  | 'emoji'
  | 'arrow_up'
  | 'arrow_down'
  | 'arrow_left'
  | 'arrow_right'
  | 'price_label'
  | 'price_note'
  | 'arrow_marker'
  | 'flag'
  | 'vertical_line'
  | 'horizontal_line'
  | 'cross_line'
  | 'horizontal_ray'
  | 'trend_line'
  | 'info_line'
  | 'trend_angle'
  | 'arrow'
  | 'ray'
  | 'parallel_channel'
  | 'disjoint_angle'
  | 'flat_bottom'
  | 'pitchfork'
  | 'schiff_pitchfork_modified'
  | 'schiff_pitchfork'
  | 'balloon'
  | 'comment'
  | 'inside_pitchfork'
  | 'pitchfan'
  | 'gannbox'
  | 'gannbox_square'
  | 'gannbox_fixed'
  | 'gannbox_fan'
  | 'fib_retracement'
  | 'fib_trend_ext'
  | 'fib_speed_resist_fan'
  | 'fib_timezone'
  | 'fib_trend_time'
  | 'fib_circles'
  | 'fib_spiral'
  | 'fib_speed_resist_arcs'
  | 'fib_channel'
  | 'xabcd_pattern'
  | 'cypher_pattern'
  | 'abcd_pattern'
  | 'callout'
  | 'triangle_pattern'
  | '3divers_pattern'
  | 'head_and_shoulders'
  | 'fib_wedge'
  | 'elliott_impulse_wave'
  | 'elliott_triangle_wave'
  | 'elliott_triple_combo'
  | 'elliott_correction'
  | 'elliott_double_combo'
  | 'cyclic_lines'
  | 'time_cycles'
  | 'sine_line'
  | 'long_position'
  | 'short_position'
  | 'forecast'
  | 'date_range'
  | 'price_range'
  | 'date_and_price_range'
  | 'bars_pattern'
  | 'ghost_feed'
  | 'projection'
  | 'rectangle'
  | 'rotated_rectangle'
  | 'brush'
  | 'highlighter'
  | 'regression_trend'
  | 'fixed_range_volume_profile'
  | 'sticker'
  | 'anchored_vwap';

export interface TVUserShape {
  id: number;
  coords: ShapeCoords;
  shape: TVShape;
  text?: string;
  color?: string;
}

export interface TVUserMultipointShape {
  id: number;
  coords: ShapeCoords[];
  shape: TVMultipointShape;
  text?: string;
  color?: string;
}

export interface ShapeCoords {
  price: number;
  time: number;
}

export interface CustomIndicator {
  name?: string;
  description?: string;
  timeframe: number;
  data: CustomIndicatorData[];
}

interface CustomIndicatorData {
  timestamp: number;
  value: number;
}

export interface CustomOscillator {
  name?: string;
  description?: string;
  timeframe: number;
  data: CustomOscillatorData[];
}

interface CustomOscillatorData {
  timestamp: number;
  value: number;
}

export interface TVTableShapeItem {
  id: number;
  [key: string]: string | number;
}

export interface Constructor {
  name: string;
  interval: number;
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

export interface ReportWidget {
  addShape(shape: TVShape, params: AddShapeParams): void;
  addMultipointShape(shape: TVMultipointShape, params: AddMultipointShapeParams): void;
  addIndicator(params: AddIndicatorParams): void;
  addOscillator(params: AddOscillatorParams): void;
  prepareToReport(): TVChartDataReportBlock;
}
