import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_BUFFER_LINES = 1000;

function quoteArg(arg) {
  if (arg.includes(' ') || arg.includes('\t')) {
    return `"${arg}"`;
  }
  return arg;
}

export class FTEQWManager {
  constructor() {
    this.process = null;
    this.outputBuffer = [];
    this.outputCallback = null;
    this.pendingBuffer = '';
  }

  spawn(basedir, game, map, engine, rconPassword, rconPort = 27500, protocol = 'nq') {
    if (this.process) {
      this.kill();
    }

    const args = [
      '-dedicated',
      '-basedir', basedir,
      '-game', game || 'id1',
      '+sv_public', '0'
    ];

    if (rconPassword) {
      args.push('+set', 'rcon_password', rconPassword);
    }

    args.push('+set', 'sv_port', String(rconPort));

    if (map) {
      args.push('+map', map);
    }

    // Use selected engine or default to fteqwsv64.exe (or ironwail.exe if preferred default)
    const executable = path.join(basedir, engine || 'fteqwsv64.exe');

    const commandStr = `${quoteArg(executable)} ${args.map(quoteArg).join(' ')}`;
    const spawnMsg = `[FTEQWManager] Spawning: ${commandStr}`;

    console.log(spawnMsg);
    this._handleOutput(spawnMsg);

    this.process = spawn(executable, args, {
      cwd: basedir,
      windowsHide: true,
      detached: true,
      // Ironwail/Quake crashes if stdin is a pipe because GetNumberOfConsoleInputEvents fails.
      // Ignoring stdin prevents it's from trying to read from a console handle that doesn't exist?
      // Let's try 'ignore' first. If this fails, we might need a different approach.
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => this._handleData(data));
    this.process.stderr.on('data', (data) => this._handleData(data));

    this.process.on('close', (code) => {
      this._flushPending();
      this._emitLine(`[Server exited with code ${code}]`);
      this.process = null;
    });

    this.process.on('error', (err) => {
      this._emitLine(`[Error: ${err.message}]`);
      this.process = null;
    });
  }

  _handleData(data) {
    const text = data.toString();
    // Append new data to any pending partial line
    const buffer = this.pendingBuffer + text;

    // Split by newline
    const lines = buffer.split(/\r?\n/);

    // The last element is either an empty string (if buffer ended with newline)
    // or a partial line that hasn't finished yet.
    this.pendingBuffer = lines.pop(); // Keep the last chunk for next time

    for (const line of lines) {
      if (line) {
        // Log internally for debugging/terminal view
        console.log('[FTEQW]', line);
        this._emitLine(line);
      }
    }
  }

  _flushPending() {
    if (this.pendingBuffer) {
      this._emitLine(this.pendingBuffer);
      this.pendingBuffer = '';
    }
  }

  _emitLine(line) {
    this.outputBuffer.push(line);
    if (this.outputBuffer.length > MAX_BUFFER_LINES) {
      this.outputBuffer.shift();
    }
    if (this.outputCallback) {
      this.outputCallback(line);
    }
  }

  _handleOutput(text) {
    // Legacy method, redirect to data handler or ignore
    this._handleData(Buffer.from(text));
  }

  kill() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning() {
    return this.process !== null;
  }

  getOutput() {
    return [...this.outputBuffer];
  }

  sendCommand(command) {
    if (this.process && this.process.stdin) {
      console.log('[FTEQWManager] Sending stdin command:', command);
      this.process.stdin.write(command + '\n');
    } else {
      console.log('[FTEQWManager] Cannot send command - no process or stdin');
    }
  }

  onOutput(callback) {
    this.outputCallback = callback;
  }
}
