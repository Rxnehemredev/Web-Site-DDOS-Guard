'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor(level = 'info') {
    this.level = LEVELS[level] !== undefined ? level : 'info';
  }

  _shouldLog(level) {
    return LEVELS[level] <= LEVELS[this.level];
  }

  _timestamp() {
    return new Date().toISOString();
  }

  _write(level, tag, message, meta) {
    if (!this._shouldLog(level)) return;
    const base = `[${this._timestamp()}] [${level.toUpperCase()}] [${tag}] ${message}`;
    if (meta !== undefined) {
      // eslint-disable-next-line no-console
      console.log(base, meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(base);
    }
  }

  error(tag, message, meta) {
    this._write('error', tag, message, meta);
  }

  warn(tag, message, meta) {
    this._write('warn', tag, message, meta);
  }

  info(tag, message, meta) {
    this._write('info', tag, message, meta);
  }

  debug(tag, message, meta) {
    this._write('debug', tag, message, meta);
  }
}

module.exports = Logger;
