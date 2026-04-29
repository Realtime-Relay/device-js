import {
  connect,
  Events,
  DebugEvents,
  credsAuthenticator,
  JSONCodec,
} from "nats";
import {
  DeliverPolicy,
  jetstream,
  jetstreamManager,
  AckPolicy,
  ReplayPolicy,
} from "@nats-io/jetstream";
import { encode, decode } from "@msgpack/msgpack";
import { decode as decodeJwt } from "nats-jwt";
import {
  NotConnectedError,
  TimeoutError,
  ValidationError,
} from "./utils/errors.js";
import { SubjectBuilder } from "./utils/subject-builder.js";

export const TransportStatus = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  AUTH_FAILED: "auth_failed",
  RECONNECT_FAILED: "reconnect_failed",
});

// const NATS_SERVERS_PRODUCTION = [
//   "tls://api.relay-x.io:4221",
//   "tls://api.relay-x.io:4222",
//   "tls://api.relay-x.io:4223",
// ];

const NATS_SERVERS_PRODUCTION = [
  "nats://0.0.0.0:4221",
  "nats://0.0.0.0:4222",
  "nats://0.0.0.0:4223",
];

export class NatsTransport {
  #config;
  #natsClient = null;
  #jetstream = null;
  #jetStreamManager = null;
  #connected = false;
  #statusCallbacks = [];
  #consumerMap = {};

  #orgId = null;
  #deviceId = null;
  #env = null;

  #logger = {
    error: (msg, err) => {
      if (this.#env === "test") {
        console.error(`[relay-device-sdk] ERROR: ${msg}`);
        if (err) console.error(err);
      }
    },
    warn: (msg) => {
      if (this.#env === "test") console.warn(`[relay-device-sdk] WARN: ${msg}`);
    },
    info: (msg) => {
      if (this.#env === "test") console.log(`[relay-device-sdk] INFO: ${msg}`);
    },
  };

  #streamName = null;
  #commandQueueStreamName = null;
  #offlineMessageBuffer = [];
  #schema = null;
  #reconnecting = false;

  constructor(config) {
    this.#config = config;
    this.#env = config.mode;
  }

  async connect() {
    if (this.#connected) {
      return false;
    }

    const credsFile = this.#buildCredsFile(
      this.#config.api_key,
      this.#config.secret,
    );
    const credsAuth = credsAuthenticator(new TextEncoder().encode(credsFile));

    const servers = NATS_SERVERS_PRODUCTION;

    try {
      this.#natsClient = await connect({
        servers,
        noEcho: true,
        reconnect: true,
        reconnectTimeWait: 500,
        maxPingOut: 2,
        pingInterval: 5000,
        authenticator: credsAuth,
        token: this.#config.api_key,
      });

      this.#jetstream = await jetstream(this.#natsClient);
      this.#jetStreamManager = await jetstreamManager(this.#natsClient);

      this.#decodeApiKey(this.#config.api_key);

      this.#startStatusIterator();

      this.#natsClient.closed().then(() => {
        this.#connected = false;
        this.#reconnecting = false;
        this._emitStatus({ type: TransportStatus.DISCONNECTED });
      });

      this.#connected = true;

      await this.#fetchSchema();

      this._emitStatus({ type: TransportStatus.CONNECTED });

      return true;
    } catch (err) {
      this._emitStatus({ type: TransportStatus.DISCONNECTED, error: err });

      return false;
    }
  }

  async disconnect() {
    if (!this.#connected) {
      return false;
    }

    await this.#deleteAllConsumers();

    this.#offlineMessageBuffer.length = 0;

    if (this.#natsClient) {
      await this.#natsClient.drain();
    }

    this.#connected = false;
    return true;
  }

  isConnected() {
    return this.#connected;
  }

  async subscribe(subject, callback) {
    if (!this.#connected) {
      throw new NotConnectedError();
    }

    if (typeof callback !== "function") {
      throw new ValidationError("callback must be a function");
    }

    const consumerName = `device_${crypto.randomUUID()}_consumer`;

    const opts = {
      name: consumerName,
      filter_subjects: subject,
      replay_policy: ReplayPolicy.Instant,
      opt_start_time: new Date(),
      ack_policy: AckPolicy.Explicit,
      delivery_policy: DeliverPolicy.New,
    };

    const consumer = await this.#jetstream.consumers.get(
      this.#commandQueueStreamName,
      opts,
    );

    this.#consumerMap[subject] = consumer;

    await consumer.consume({
      callback: async (msg) => {
        try {
          msg.working();
          const data = decode(msg.data);
          callback(data);
          msg.ack();
        } catch (err) {
          msg.nak(5000);
        }
      },
    });

    return { subject, consumer };
  }

  coreSubscribe(subject, callback) {
    if (!this.#connected) {
      throw new NotConnectedError();
    }

    if (typeof callback !== "function") {
      throw new ValidationError("callback must be a function");
    }

    const sub = this.#natsClient.subscribe(subject);

    (async () => {
      for await (const msg of sub) {
        try {
          const data = msg.json();
          callback(data, msg);
        } catch (_) {
          this.#logger.error("Failed to parse core message", _);
        }
      }
    })();

    return sub;
  }

  async unsubscribe(subscription) {
    if (!subscription) return;

    const { subject, consumer } = subscription;

    if (consumer) {
      try {
        await consumer.delete();
      } catch (_) {
        this.#logger.error("Failed to delete consumer", _);
      }
    }

    delete this.#consumerMap[subject];
  }

  async publish(subject, data) {
    if (!this.#connected) {
      this.#offlineMessageBuffer.push({ subject, data });
      return false;
    }

    const encoded = encode(data);
    try {
      const ack = await this.#jetstream.publish(subject, encoded);
      return ack != null;
    } catch (_) {
      this.#logger.error("Failed to publish", _);
      return false;
    }
  }

  async request(subject, data, opts) {
    if (!this.#connected) {
      throw new NotConnectedError();
    }

    const encoded = JSONCodec().encode(data);
    const timeout = opts?.timeout ?? 20_000;

    try {
      const response = await this.#natsClient.request(subject, encoded, {
        timeout,
      });
      return response.json();
    } catch (err) {
      if (err.code === "TIMEOUT" || err.message?.includes("TIMEOUT")) {
        throw new TimeoutError(subject);
      }
      throw err;
    }
  }

  onStatus(callback) {
    this.#statusCallbacks.push(callback);
  }

  getOrgId() {
    return this.#orgId;
  }

  getDeviceId() {
    return this.#deviceId;
  }

  getEnv() {
    return this.#env;
  }

  getSchema() {
    return this.#schema;
  }

  _emitStatus(event) {
    for (const cb of this.#statusCallbacks) {
      cb(event);
    }
  }

  async #fetchSchema() {
    const subject = SubjectBuilder.schemaGet(this.#orgId);
    try {
      const response = await this.request(subject, { id: this.#deviceId });
      this.#schema = response.data?.schema ?? null;
    } catch (_) {
      this.#logger.error("Failed to fetch schema", _);
      this.#schema = null;
    }
  }

  #decodeApiKey(apiKey) {
    const orgData = decodeJwt(apiKey);
    this.#orgId = orgData.nats.org_data.org_id;
    this.#deviceId = orgData.nats.org_data.api_key_id;
    this.#streamName = `${this.#orgId}_stream`;
    this.#commandQueueStreamName = `${this.#orgId}_command_queue`;
  }

  #startStatusIterator() {
    (async () => {
      for await (const s of this.#natsClient.status()) {
        switch (s.type) {
          case Events.Disconnect:
            this.#connected = false;
            break;
          case Events.Reconnect:
            this.#connected = true;
            this.#reconnecting = false;
            this.#flushOfflineBuffer();
            this._emitStatus({ type: TransportStatus.RECONNECTED });
            break;
          case DebugEvents.Reconnecting:
            this.#connected = false;
            if (!this.#reconnecting) {
              this.#reconnecting = true;
              this._emitStatus({ type: TransportStatus.RECONNECTING });
            }
            break;
          case Events.Error:
            if (s.data === "NATS_PROTOCOL_ERR") {
              this.#connected = false;
              this._emitStatus({
                type: TransportStatus.AUTH_FAILED,
                error: s.data,
              });
            }
            break;
        }
      }
    })();
  }

  async #flushOfflineBuffer() {
    const messages = this.#offlineMessageBuffer.splice(0);
    for (const { subject, data } of messages) {
      await this.publish(subject, data);
    }
  }

  async #deleteAllConsumers() {
    const subjects = Object.keys(this.#consumerMap);
    for (const subject of subjects) {
      const consumer = this.#consumerMap[subject];
      try {
        await consumer.delete();
      } catch (_) {
        this.#logger.error("Failed to delete consumer on cleanup", _);
      }
    }
    this.#consumerMap = {};
  }

  #buildCredsFile(jwt, secret) {
    return `
-----BEGIN NATS USER JWT-----
${jwt}
------END NATS USER JWT------

************************* IMPORTANT *************************
NKEY Seed printed below can be used to sign and prove identity.
NKEYs are sensitive and should be treated as secrets.

-----BEGIN USER NKEY SEED-----
${secret}
------END USER NKEY SEED------

*************************************************************`;
  }
}
