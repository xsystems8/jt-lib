export interface WatcherError {
  date: string;
  event: string;
  message: string;
  params: string;
}

export interface AddWatcherError extends Omit<WatcherError, 'params'> {
  params: Record<string, any>;
}
