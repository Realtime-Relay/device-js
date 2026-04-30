import { SubjectBuilder } from "../utils/subject-builder.js";
import { ValidationError } from "../utils/errors.js";

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 15;

function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function describeType(arg) {
  if (arg === null) return "null";
  const t = typeof arg;
  if (t !== "object") return t;
  return arg.constructor?.name ?? "object";
}

function validateArg(arg) {
  if (arg === null || arg === undefined) return;
  const t = typeof arg;
  if (t === "string" || t === "number" || t === "boolean") return;
  if (arg instanceof Date || arg instanceof Error) return;
  if (Array.isArray(arg) || isPlainObject(arg)) return;
  throw new ValidationError(
    `device.log: unsupported argument type '${describeType(arg)}'`,
  );
}

function formatArg(a) {
  if (a === null) return "null";
  if (a === undefined) return "undefined";
  const t = typeof a;
  if (t === "string") return a;
  if (t === "number" || t === "boolean") return String(a);
  if (a instanceof Date) return a.toISOString();
  if (a instanceof Error) {
    return `${a.name}: ${a.message}${a.stack ? "\n" + a.stack : ""}`;
  }
  try {
    return JSON.stringify(a);
  } catch {
    return "[Unserializable]";
  }
}

function formatArgs(args) {
  return args.map(formatArg).join(" ");
}

export class LogManager {
  #transport;
  #time;
  #buffer = [];
  #timer = null;
  #inFlight = new Set();
  #lastTimestamp = 0;

  constructor(transport, time) {
    this.#transport = transport;
    this.#time = time;
  }

  info(...args) {
    this.#log("info", args);
  }

  warn(...args) {
    this.#log("warn", args);
  }

  error(...args) {
    this.#log("error", args);
  }

  #log(type, args) {
    for (const a of args) validateArg(a);

    if (type === "info") console.info(...args);
    else if (type === "warn") console.warn(...args);
    else console.error(...args);

    // Monotonic ms timestamp — Influx upserts on (measurement, tags, _field, _time),
    // so back-to-back logs in the same ms would overwrite each other. Force strictly
    // increasing timestamps within the device.
    const now = this.#time.now();
    const ts = now > this.#lastTimestamp ? now : this.#lastTimestamp + 1;
    this.#lastTimestamp = ts;

    this.#buffer.push({
      type,
      timestamp: ts,
      data: formatArgs(args),
    });

    if (this.#buffer.length >= FLUSH_THRESHOLD) {
      this.#flush();
    } else if (this.#timer === null) {
      this.#timer = setTimeout(() => this.#flush(), FLUSH_INTERVAL_MS);
    }
  }

  #flush() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#buffer.length === 0) return;

    const entries = this.#buffer;
    this.#buffer = [];

    const orgId = this.#transport.getOrgId();
    const env = this.#transport.getEnv();
    const deviceId = this.#transport.getDeviceId();

    for (const entry of entries) {
      const subject = SubjectBuilder.log(orgId, env, deviceId, entry.type);
      const promise = (async () => {
        try {
          var ack = await this.#transport.publish(subject, entry);
        } catch (err) {
          console.warn(`[device.log] publish failed: ${err?.message ?? err}`);
        }
      })();
      this.#inFlight.add(promise);
      promise.finally(() => this.#inFlight.delete(promise));
    }
  }

  async shutdown() {
    this.#flush();
    await Promise.allSettled([...this.#inFlight]);
  }
}
