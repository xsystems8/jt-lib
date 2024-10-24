import { BaseObject } from '../../base-object';
import { globals } from '../../globals';
import { currentTimeString } from '../../utils/date-time';
import { AddWatcherError, WatcherError } from './types';
import { warning } from '../../log';

export class Watcher extends BaseObject {
  constructor() {
    super();
    globals.events.subscribe('onStop', this._errorsToReport, this);
  }

  errors: WatcherError[] = [];
  errorKeys = {};

  error(event: string, message: string, params: Record<string, any>) {
    this.errors.push({ date: currentTimeString(), event: event, message: message, params: JSON.stringify(params) });

    if (!isTester()) {
      warning('Watcher:error', event + ' ' + message, params);
    }
  }

  addErrors(errors: AddWatcherError[]) {
    for (let error of errors) {
      this.errorOnce(error.event, error.message, error.params);
    }
  }

  errorOnce(event: string, message: string, params: Record<string, any>) {
    let key = event + message;
    if (this.errorKeys[key]) {
      return;
    }
    this.errorKeys[key] = true;
    this.error(event, message, params);
  }

  async _errorsToReport() {
    globals.report.tableUpdate('Watcher errors', this.errors as Record<string, any>);
  }
}
