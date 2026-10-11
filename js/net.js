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

  // Her modun 4 lobi yuvası var. Bir yuvayı cevap vermeyen (sekmesi uyuyan) bir maç tutuyorsa
  // kısa sürede bir sonraki yuvaya geçilir; boş yuva bulununca orada maç kurulur.
  async findMatch(modeKey, onStatus) {
    this.cancelled = false;
    if (!this.available) return 'offline';
    const SLOTS = 4;
    for (let slot = 0; slot < SLOTS; slot++) {
      const lobby = `${LOBBY_PREFIX}${modeKey}-${slot}`;
      if (this.cancelled) return 'cancel';
      onStatus(slot === 0 ? 'Online oyuncular aranıyor...' : `Online oyuncular aranıyor... (${slot + 1}/${SLOTS})`);
      const j = await this.tryJoin(lobby);
      if (j === 'joined') return 'client';
      if (this.cancelled) return 'cancel';
      if (j === 'error') return 'offline';
      if (j === 'none') {
        // Bu yuvada kimse yok: maçı burada kur
        onStatus('Açık maç bulunamadı — yeni maç kuruluyor...');
        const h = await this.tryHost(lobby);
        if (h === 'host') return 'host';
        if (h === 'error') return 'offline';
        // 'taken': biri aynı anda kurdu → tekrar katılmayı dene
        const j2 = await this.tryJoin(lobby);
        if (j2 === 'joined') return 'client';
      }
      // 'stale': yuvayı cevap vermeyen bir maç tutuyor → sonraki yuva
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
      // Lobi var ama bağlantı kurulamıyorsa (maç sahibi cevap vermiyor) 'stale' döner
      let opened = false;
      const timer = setTimeout(() => finish(opened ? 'stale' : 'error'), 6000);
      peer.on('open', () => {
        opened = true;
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
