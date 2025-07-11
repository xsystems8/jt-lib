import { globals } from './globals';
import { currentTime, currentTimeString } from '../utils/date-time';
import { getArgBoolean } from './base';
import { BaseError } from './errors';

const LOG_MAX_MESSAGES = 200;
const MAX_CONSOLE_LOG = 500;
const IS_DEBUG = getArgBoolean('isDebug', false);
const IS_STRINGIFY = getArgBoolean('isStringifyLogs', true);

type LogType = 'log' | 'trace' | 'warning' | 'error' | 'debug';

export function log(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  if (globals.IS_NO_LOGS && !showInConsole) return;
  _updateLog('log', event, msg, context, showInConsole);
}

export function trace(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  if (globals.IS_NO_LOGS) return;
  _updateLog('trace', event, msg, context, showInConsole);
}

export function warning(event: string, msg: string, context: Record<string, any> = {}, showInConsole = false) {
  //if (globals.IS_NO_LOGS) return;
  _updateLog('warning', '⚠️ ' + event, msg, { ...context, internalStack: new Error().stack.split('\n') }, true);
}

export function debug(event: string, msg: string, context: Record<string, any> = {}) {
  // if (globals.IS_NO_LOGS) return;
  //TODO check tester performance (debug() function increase time in 3 times)
  if (isTester()) return;
  if (IS_DEBUG) {
    const stack = new Error().stack.split('\n');
    _updateLog('debug', 'DEBUG - ' + event, msg, { ...context, stack }, !isTester());
  }
}

export function error(event: string, msg: string): void;
export function error(event: string, msg: string, context: any): void;
export function error(error: Error | BaseError, context: any): void;
export function error(error: Error | BaseError): void;
export function error(...args: any): void {
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
    if (globals.errorCount > 20) {
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

export function getLogs(type: string): Record<string, any>[] {
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
  if (globals.IS_NO_LOGS) return;
  globals.logOnce.set(event, { date: currentTimeString(), event, msg, args });
}

export function errorOnce(event, msg, args = {}, ttl = 0) {
  if (globals.IS_NO_LOGS) return;
  if (!isMessageLogged(event, msg, ttl)) {
    error(event, msg, args);
    return true;
  }
  return false;
}

export function warningOnce(event, msg, args = {}, ttl = 0) {
  if (globals.IS_NO_LOGS) return;
  if (!isMessageLogged(event, msg, ttl)) {
    warning(event, msg, args);
  }
}

function _updateLog(
  type: LogType,
  event: string,
  msg: string,
  context: Record<string, any> = {},
  showInConsole = false,
) {
  if (showInConsole || type === 'error') {
    const time = currentTimeString();
    const consoleMsg = `${time}| ${event} ${msg} `;
    const consoleContext = JSON.stringify(context, (key, v) => {
      return v === undefined ? 'undefined' : v;
    });

    if (type === 'log') {
      //consoleContext['stack'] = new Error().stack.split('\n');
      console.log(consoleMsg, consoleContext);
    }
    if (type === 'trace') {
      console.log(consoleMsg, consoleContext);
    }
    if (type === 'warning') {
      console.warn(consoleMsg, consoleContext);
    }
    if (type === 'debug') {
      console.warn(consoleMsg, consoleContext);
    }
    if (type === 'error') {
      console.error(consoleMsg, consoleContext);
    }
  }

  if (type === 'warning') type = 'error';
  if (globals.logs[type] === undefined) {
    globals.logs[type] = [];
  }
  if (globals.logs[type].length > LOG_MAX_MESSAGES + 50) {
    globals.logs[type].slice(-LOG_MAX_MESSAGES);
  }

  if (isTester() && showInConsole) {
    globals.consoleLogCount++;
    if (globals.consoleLogCount > MAX_CONSOLE_LOG) {
      console.error('Too many console.log() calls. Max count = ' + MAX_CONSOLE_LOG);
      //todo ADD reason argument to forceStop();
      forceStop();
    }
  }

  if (IS_STRINGIFY) {
    const contextJson = JSON.stringify(context, (key, v) => {
      return v === undefined ? 'undefined' : v;
    });
    globals.logs[type].push({ date: currentTimeString(), event: event, msg: msg, context: contextJson });
  } else {
    //if not stringify context inside context could be changed after log call it will be changed in logs
    //because of reference to the same object in memory
    globals.logs[type].push({ date: currentTimeString(), event: event, msg: msg, context: context });
  }
}
