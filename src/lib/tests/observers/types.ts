export interface ObserverError {
  date: string;
  message: string;
  // params: Record<string, unknown>;
  params: object;
}

export type ObserverOrder = Order & { uid: string };

export interface ObserverBalance {
  total: { USDT: number; [coin: string]: number };
  free: { USDT: number; [coin: string]: number };
  used: { USDT: number; [coin: string]: number };
}
