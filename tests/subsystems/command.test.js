import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandManager } from "../../src/subsystems/command.js";
import {
  DuplicateListenerError,
  ValidationError,
} from "../../src/utils/errors.js";
import { createMockTransport } from "../helpers/mock-transport.js";

describe("CommandManager", () => {
  let transport;
  let command;

  beforeEach(() => {
    transport = createMockTransport();
    command = new CommandManager(transport);
  });

  describe("listen()", () => {
    it("should throw ValidationError if callback is not a function", async () => {
      await expect(command.listen("test", "string")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError if callback is null", async () => {
      await expect(command.listen("test", null)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError if callback is undefined", async () => {
      await expect(command.listen("test", undefined)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError if callback is a number", async () => {
      await expect(command.listen("test", 123)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should subscribe to the correct NATS subject", async () => {
      await command.listen("shutdown", () => {});
      const subs = transport._getSubscriptions();
      const expected = "test-org.test.command.queue.test-device.shutdown";
      expect(subs[expected]).toBeDefined();
    });

    it("should throw DuplicateListenerError on duplicate name", async () => {
      await command.listen("shutdown", () => {});
      await expect(command.listen("shutdown", () => {})).rejects.toThrow(
        DuplicateListenerError,
      );
    });

    it("should allow different names", async () => {
      await command.listen("shutdown", () => {});
      await expect(command.listen("restart", () => {})).resolves.not.toThrow();
    });

    it("should pass CommandMessage with payload to callback", async () => {
      const received = [];
      await command.listen("test", (msg) => received.push(msg));

      const subject = "test-org.test.command.queue.test-device.test";
      transport._simulateMessage(subject, { action: "do-thing" });

      expect(received).toHaveLength(1);
      expect(received[0].payload).toEqual({ action: "do-thing" });
    });

    it("should not expose ack/nack on CommandMessage", async () => {
      let capturedMsg;
      await command.listen("test", (msg) => {
        capturedMsg = msg;
      });

      const subject = "test-org.test.command.queue.test-device.test";
      transport._simulateMessage(subject, {});

      expect(capturedMsg.ack).toBeUndefined();
      expect(capturedMsg.nack).toBeUndefined();
    });

    it("should throw ValidationError on invalid name characters", async () => {
      await expect(command.listen("bad name", () => {})).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError on empty name", async () => {
      await expect(command.listen("", () => {})).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe("off()", () => {
    it("should return false for non-existent listener", async () => {
      expect(await command.off("nope")).toBe(false);
    });

    it("should return true when removing existing listener", async () => {
      await command.listen("shutdown", () => {});
      expect(await command.off("shutdown")).toBe(true);
    });

    it("should unsubscribe from transport", async () => {
      await command.listen("shutdown", () => {});
      await command.off("shutdown");
      const subs = transport._getSubscriptions();
      expect(
        subs["test-org.test.command.queue.test-device.shutdown"],
      ).toBeUndefined();
    });

    it("should allow re-registration after off", async () => {
      await command.listen("shutdown", () => {});
      await command.off("shutdown");
      await expect(command.listen("shutdown", () => {})).resolves.not.toThrow();
    });

    it("should be idempotent", async () => {
      await command.listen("shutdown", () => {});
      expect(await command.off("shutdown")).toBe(true);
      expect(await command.off("shutdown")).toBe(false);
    });
  });
});
