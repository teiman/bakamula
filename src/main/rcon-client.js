import dgram from 'node:dgram';

const RCON_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const RESPONSE_TIMEOUT = 2000;

export class RconClient {
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = dgram.createSocket('udp4');
    this.pendingResolve = null;

    this.socket.on('message', (msg) => {
      if (this.pendingResolve) {
        const response = msg.slice(4).toString().trim();
        this.pendingResolve(response);
        this.pendingResolve = null;
      }
    });

    this.socket.on('error', (err) => {
      console.error('RCON socket error:', err.message);
    });
  }

  send(command) {
    return new Promise((resolve, reject) => {
      const payload = `rcon ${this.password} ${command}`;
      const packet = Buffer.concat([RCON_HEADER, Buffer.from(payload)]);

      this.pendingResolve = resolve;

      const timeout = setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          resolve(null);
        }
      }, RESPONSE_TIMEOUT);

      this.socket.send(packet, this.port, this.host, (err) => {
        if (err) {
          console.error(`[RconClient] Error sending to ${this.host}:${this.port}:`, err);
          clearTimeout(timeout);
          this.pendingResolve = null;
          reject(err);
        }
      });
    });
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // Ignore
    }
  }
}
