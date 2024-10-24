import { TriggerTask } from '../types';

export interface PriceTriggerInterface {
  addTask: (params: CreatePriceTaskParams) => void;
}

export interface CreatePriceTaskParams {
  name: string;
  triggerPrice: number;
  args?: any;
  callback?: (args?: any) => Promise<void>;
  retry?: boolean | number;
  comment?: string;
  group?: string;
}

export interface PriceTriggerTask extends TriggerTask {
  symbol: string;
  triggerPrice: number;
  direction: PriceTriggerDirection;
  group?: string;
}

export enum PriceTriggerDirection {
  Up = 'up',
  Down = 'down',
}
