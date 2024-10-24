import { globals } from './globals';
import { currentTime, currentTimeString } from './utils/date-time';
import { getArgBoolean } from './base';
import { BaseError } from './Errors';
const LOG_MAX_MESSAGES = 200;

export function log(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  _updateLog('log', event, msg, context, showInConsole);
}

export function trace(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  _updateLog('trace', event, msg, context, showInConsole);
}

export function warning(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  _updateLog('warning', '⚠️ ' + event, msg, context, true);
}

export function error(event: string, msg: string): void;
export function error(event: string, msg: string, context: any): void;
export function error(error: Error | BaseError, context: any): void;
export function error(error: Error | BaseError): void;
export function error(...args: any): void {
  if (getArgBoolean('isDebug', false)) {
    warning('error', 'error args', { ...args, t0: typeof args[0] }, true);
  }

  //------error(error: BaseError)------
  if (args[0] && args[0] instanceof Error) {
    let error: BaseError;

    if (args[0] instanceof BaseError) {
      error = args[0];
    } else {
      error = new BaseError(args[0], args[1]);
    }

    if (args[1]) {
      let context = args[1];
      let line = new Error().stack.split('\n')[2];

      error.addContext(line, context);
    }

    let stack = error.stack.split('\n');
    let allContext = error.allContext;
    let internalStack = error.internalStack;

    let prevFuncName = new Error().stack.split('\n')[2].split(' ')[3];

    _updateLog('error', prevFuncName, '🚫 ' + error.message, { stack, allContext, internalStack });
  }
  //-----------------error(event: string, msg: string, args: any)-----------------
  else if (args[0] && typeof args[0] === 'string') {
    let event = args[0];
    let msg = args[1];
    let context = args[2];

    let stack = new Error().stack.split('\n');
    _updateLog('error', event, '🚫 ' + msg, { stack, context });
  } else {
    let stack = new Error().stack.split('\n');
    _updateLog('error', 'error()', '🚫 Something wrong with arguments in error() function ', { stack, args });
  }

  globals.errorCount++;
  if (isTester()) {
    if (globals.errorCount > 30) {
      let errCnt = globals.errorCount;
      globals.errorCount = 0;
      globals.strategy.forceStop('Too many errors count=' + errCnt);
    }
  } else {
    if (globals.errorCount > 10) {
      let errCnt = globals.errorCount;

      globals.errorCount = 0;
      globals.strategy.forceStop('Too many errors count =' + errCnt);
    }
    if (globals.lastErrorTime + 60 * 60 * 1000 > currentTime()) {
      globals.errorCount = 0;
      globals.lastErrorTime = currentTime();
    }
  }
}

export function getLogs(type: string) {
  if (type === 'logOnce') {
    return Array.from(globals.logOnce.values());
  }
  if (globals.logs[type] === undefined) {
    globals.logs[type] = [];
  }
  return globals.logs[type];
}

function isMessageLogged(event: string, msg: string, ttl = 0) {
  if (globals.logOnce === undefined) globals.logOnce = new Map();
  const key = event + msg;
  ttl = ttl ? ttl : 86400000 * 365 * 10; // 10 years

  if (globals.logOnce.has(key) === false) {
    globals.logOnce.set(key, ttl);
    return false;
  } else if (globals.logOnce.get(key) < tms()) {
    globals.logOnce.set(key, ttl);
    return false;
  }

  return true;
}

export function logOnce(event, msg, args = {}, ttl = 0) {
  globals.logOnce.set(event, { date: currentTimeString(), event, msg, args });
}

export function logOnceObj(event, msg, args = {}, ttl = 0) {
  globals.logOnceObj[event] = { date: currentTimeString(), event, msg, args };
}

export function traceOnce(event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    trace(event, msg, args);
  }
}

export function errorOnce(event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    error(event, msg, args);
    return true;
  }
  return false;
}

export function warningOnce(event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    warning(event, msg, args);
  }
}

export function debugLog(...args: any[]) {
  console.log({ date: currentTimeString(), ...args });

  log('debugLog', '', { ...args });
}

type LogType = 'log' | 'trace' | 'warning' | 'error';

function _updateLog(type: LogType, event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  if (globals.logs[type] === undefined) {
    globals.logs[type] = [];
  }

  if (globals.logs[type].length > LOG_MAX_MESSAGES + 50) {
    globals.logs[type].slice(-LOG_MAX_MESSAGES);
  }

  const argsN = JSON.stringify(args);

  globals.logs[type].push({ date: currentTimeString(), event: event, msg: msg, args: argsN });

  if (showInConsole) {
    if (type === 'log') {
      console.log(event + ' | ' + msg, args);
    }
    if (type === 'trace') {
      console.log(event + ' | ' + msg, args);
    }

    if (type === 'warning') {
      console.warn(event + ' | ' + msg, args);
    }
  }

  if (type === 'error') {
    const time = currentTimeString();
    console.error(`${event} at ${time} ${msg} `, args);
  }
}
