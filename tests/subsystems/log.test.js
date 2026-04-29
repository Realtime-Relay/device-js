import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LogManager } from "../../src/subsystems/log.js";
import { ValidationError } from "../../src/utils/errors.js";
import { createMockTransport } from "../helpers/mock-transport.js";

function createMockTime(initial = 1_000_000) {
  let t = initial;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

describe("LogManager", () => {
  let transport;
  let time;
  let log;
  let consoleInfo;
  let consoleWarn;
  let consoleError;

  beforeEach(() => {
    transport = createMockTransport();
    time = createMockTime();
    log = new LogManager(transport, time);
    consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleInfo.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  describe("console forwarding", () => {
    it("info() forwards original args to console.info", () => {
      log.info("hello", { port: 8080 }, 42);
      expect(consoleInfo).toHaveBeenCalledTimes(1);
      expect(consoleInfo).toHaveBeenCalledWith("hello", { port: 8080 }, 42);
    });

    it("warn() forwards to console.warn", () => {
      log.warn("careful");
      expect(consoleWarn).toHaveBeenCalledWith("careful");
    });

    it("error() forwards to console.error", () => {
      const err = new Error("boom");
      log.error("fail", err);
      expect(consoleError).toHaveBeenCalledWith("fail", err);
    });

    it("does not call console for the wrong level", () => {
      log.info("a");
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("accepts string, number, boolean, null, undefined", () => {
      expect(() => log.info("s", 1, true, null, undefined)).not.toThrow();
    });

    it("accepts plain objects and arrays", () => {
      expect(() => log.info({ a: 1 }, [1, 2, 3])).not.toThrow();
    });

    it("accepts Date", () => {
      expect(() => log.info(new Date())).not.toThrow();
    });

    it("accepts Error", () => {
      expect(() => log.info(new Error("x"))).not.toThrow();
    });

    it("accepts Error subclasses", () => {
      class CustomError extends Error {}
      expect(() => log.info(new CustomError("x"))).not.toThrow();
    });

    it("rejects functions", () => {
      expect(() => log.info(() => {})).toThrow(ValidationError);
    });

    it("rejects symbols", () => {
      expect(() => log.info(Symbol("x"))).toThrow(ValidationError);
    });

    it("rejects bigint", () => {
      expect(() => log.info(10n)).toThrow(ValidationError);
    });

    it("rejects Map", () => {
      expect(() => log.info(new Map())).toThrow(ValidationError);
    });

    it("rejects Set", () => {
      expect(() => log.info(new Set())).toThrow(ValidationError);
    });

    it("rejects unrelated class instances", () => {
      class Foo {}
      expect(() => log.info(new Foo())).toThrow(ValidationError);
    });

    it("rejects when any arg is invalid (others valid)", () => {
      expect(() => log.info("ok", 1, () => {})).toThrow(ValidationError);
    });

    it("does not console-forward or buffer when validation throws", () => {
      expect(() => log.info(() => {})).toThrow(ValidationError);
      expect(consoleInfo).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()).toHaveLength(0);
    });

    it("allows zero args", () => {
      expect(() => log.info()).not.toThrow();
    });
  });

  describe("buffering", () => {
    it("does not publish on first call (waits for timer or threshold)", () => {
      log.info("a");
      expect(transport._getPublished()).toHaveLength(0);
    });

    it("flushes after 5s timer", async () => {
      log.info("a");
      vi.advanceTimersByTime(4999);
      expect(transport._getPublished()).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(transport._getPublished()).toHaveLength(1);
    });

    it("timer is debounced — only starts on first entry into empty buffer", () => {
      log.info("a"); // starts timer
      vi.advanceTimersByTime(2000);
      log.info("b"); // does NOT reset timer
      vi.advanceTimersByTime(3000); // total 5000 since first entry
      expect(transport._getPublished()).toHaveLength(2);
    });

    it("flushes immediately when buffer reaches 15 entries", () => {
      for (let i = 0; i < 15; i++) log.info(`m${i}`);
      expect(transport._getPublished()).toHaveLength(15);
    });

    it("size-15 flush clears the timer (no double-flush 5s later)", () => {
      for (let i = 0; i < 15; i++) log.info(`m${i}`);
      const before = transport._getPublished().length;
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()).toHaveLength(before);
    });

    it("after flush, next log starts a new 5s timer", async () => {
      log.info("a");
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()).toHaveLength(1);
      log.info("b");
      vi.advanceTimersByTime(4999);
      expect(transport._getPublished()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(transport._getPublished()).toHaveLength(2);
    });

    it("empty buffer at 5s does not publish anything", () => {
      vi.advanceTimersByTime(10_000);
      expect(transport._getPublished()).toHaveLength(0);
    });
  });

  describe("publish payload and subject", () => {
    it("publishes one message per entry", () => {
      log.info("a");
      log.warn("b");
      log.error("c");
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()).toHaveLength(3);
    });

    it("uses correct per-type subject", () => {
      log.info("i");
      log.warn("w");
      log.error("e");
      vi.advanceTimersByTime(5000);
      const subjects = transport._getPublished().map((p) => p.subject);
      expect(subjects).toContain("test-org.test.logs.test-device.info");
      expect(subjects).toContain("test-org.test.logs.test-device.warn");
      expect(subjects).toContain("test-org.test.logs.test-device.error");
    });

    it("payload contains type, timestamp, and formatted data string", () => {
      log.info("hello", 42);
      vi.advanceTimersByTime(5000);
      const [{ data }] = transport._getPublished();
      expect(data.type).toBe("info");
      expect(data.timestamp).toBe(1_000_000);
      expect(data.data).toBe("hello 42");
    });

    it("data field is a string for objects (JSON.stringify)", () => {
      log.info({ port: 8080 });
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.data).toBe('{"port":8080}');
    });

    it("formats Date as ISO string", () => {
      const d = new Date("2026-04-29T12:00:00.000Z");
      log.info(d);
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.data).toBe(
        "2026-04-29T12:00:00.000Z",
      );
    });

    it("formats Error with name, message, and stack", () => {
      const err = new Error("boom");
      err.stack = "Error: boom\n  at fake:1:1";
      log.error("fail", err);
      vi.advanceTimersByTime(5000);
      const data = transport._getPublished()[0].data.data;
      expect(data).toContain("Error: boom");
      expect(data).toContain("at fake:1:1");
    });

    it("formats null and undefined", () => {
      log.info(null, undefined);
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.data).toBe("null undefined");
    });

    it("handles circular refs as [Unserializable]", () => {
      const a = {};
      a.self = a;
      log.info(a);
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.data).toBe("[Unserializable]");
    });

    it("zero-arg call publishes empty data string", () => {
      log.info();
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.data).toBe("");
    });

    it("timestamp comes from time.now() at log time, not at flush time", () => {
      log.info("a");
      time.advance(1234);
      vi.advanceTimersByTime(5000);
      expect(transport._getPublished()[0].data.timestamp).toBe(1_000_000);
    });
  });

  describe("publish failure handling", () => {
    it("swallows publish errors and logs to console.warn", async () => {
      transport.publish = vi
        .fn()
        .mockRejectedValue(new Error("transport boom"));
      log.info("a");
      vi.advanceTimersByTime(5000);
      // allow the rejected promise to resolve
      await vi.runAllTimersAsync();
      expect(consoleWarn).toHaveBeenCalled();
      expect(consoleWarn.mock.calls[0][0]).toContain("publish failed");
    });
  });

  describe("shutdown()", () => {
    it("flushes pending entries", async () => {
      log.info("a");
      log.info("b");
      vi.useRealTimers();
      await log.shutdown();
      expect(transport._getPublished()).toHaveLength(2);
    });

    it("clears the timer (no flush on subsequent advance)", async () => {
      log.info("a");
      vi.useRealTimers();
      await log.shutdown();
      const before = transport._getPublished().length;
      vi.useFakeTimers();
      vi.advanceTimersByTime(10_000);
      expect(transport._getPublished()).toHaveLength(before);
    });

    it("is a no-op when buffer is empty", async () => {
      vi.useRealTimers();
      await expect(log.shutdown()).resolves.toBeUndefined();
      expect(transport._getPublished()).toHaveLength(0);
    });

    it("awaits in-flight publishes before resolving", async () => {
      let release;
      transport.publish = vi.fn(
        () => new Promise((r) => (release = () => r(true))),
      );
      log.info("a");
      vi.useRealTimers();
      const done = log.shutdown();
      let settled = false;
      done.then(() => (settled = true));
      // allow microtasks to run; should not be settled because publish is pending
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
      release();
      await done;
      expect(settled).toBe(true);
    });
  });
});
