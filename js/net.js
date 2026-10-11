// ONLINE BAĞLANTI (PeerJS / WebRTC — ayrı bir sunucu gerekmez)
// Maç ararken önce o modun lobisine bağlanmayı dener. Lobi yoksa sen ev sahibi (host) olursun,
// maç botlarla hemen başlar; sonradan gelen oyuncular botların yerine geçer.
import { LOBBY_PREFIX } from './config.js';

const NET_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable']);

export class Net {
  constructor() {
    this.peer = null;
    this.conns = new Map();
    this.hostConn = null;
    this.role = 'offline';
    this.handlers = {};
    this.cancelled = false;
  }

  get available() { return typeof window.Peer === 'function'; }
  get clientCount() { return this.conns.size; }

  async findMatch(modeKey, onStatus) {
    this.cancelled = false;
    if (!this.available) return 'offline';
    const lobby = LOBBY_PREFIX + modeKey;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.cancelled) return 'cancel';
      onStatus('Online oyuncular aranıyor...');
      const j = await this.tryJoin(lobby);
      if (j === 'joined') return 'client';
      if (j === 'error' || this.cancelled) return this.cancelled ? 'cancel' : 'offline';
      onStatus('Açık maç bulunamadı — yeni maç kuruluyor...');
      const h = await this.tryHost(lobby);
      if (h === 'host') return 'host';
      if (h === 'error') return 'offline';
      // 'taken': biri aynı anda lobi kurdu, ona katılmayı dene
    }
    return 'offline';
  }

  tryJoin(lobby) {
    return new Promise((resolve) => {
      let done = false;
      const peer = new window.Peer(undefined, { debug: 0 });
      const finish = (r) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (r !== 'joined') peer.destroy();
        resolve(r);
      };
      const timer = setTimeout(() => finish('none'), 8000);
      peer.on('open', () => {
        const conn = peer.connect(lobby, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          this.peer = peer;
          this.hostConn = conn;
          this.role = 'client';
          conn.on('data', (d) => this.handlers.onHostMessage?.(d));
          conn.on('close', () => this.handlers.onHostLost?.());
          finish('joined');
        });
      });
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') finish('none');
        else if (NET_ERRORS.has(err.type)) finish('error');
        else finish('none');
      });
    });
  }

  tryHost(lobby) {
    return new Promise((resolve) => {
      let done = false;
      const peer = new window.Peer(lobby, { debug: 0 });
      const finish = (r) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (r !== 'host') peer.destroy();
        resolve(r);
      };
      const timer = setTimeout(() => finish('error'), 8000);
      peer.on('open', () => {
        this.peer = peer;
        this.role = 'host';
        peer.on('connection', (conn) => this.bindClient(conn));
        peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
        finish('host');
      });
      peer.on('error', (err) => {
        if (done) { console.warn('Ağ hatası', err.type); return; }
        finish(err.type === 'unavailable-id' ? 'taken' : 'error');
      });
    });
  }

  bindClient(conn) {
    conn.on('open', () => this.conns.set(conn.peer, conn));
    conn.on('data', (d) => this.handlers.onClientMessage?.(conn.peer, d));
    conn.on('close', () => {
      this.conns.delete(conn.peer);
      this.handlers.onClientLeft?.(conn.peer);
    });
    conn.on('error', () => {});
  }

  send(msg) {
    if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  }

  sendTo(peerId, msg) {
    const c = this.conns.get(peerId);
    if (c && c.open) c.send(msg);
  }

  broadcast(msg, except) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  close() {
    this.cancelled = true;
    try { this.peer?.destroy(); } catch { /* yok say */ }
    this.peer = null;
    this.hostConn = null;
    this.conns.clear();
    this.role = 'offline';
  }
}
