import { describe, it, expect } from "vitest";
import { SubjectBuilder } from "../../src/utils/subject-builder.js";
import { ValidationError } from "../../src/utils/errors.js";

describe("SubjectBuilder", () => {
  const orgId = "org-123";
  const env = "test";
  const deviceId = "device-456";

  describe("rpc()", () => {
    it("should build correct subject", () => {
      expect(SubjectBuilder.rpc(orgId, env, deviceId, "reboot")).toBe(
        "org-123.test.command.rpc.device-456.reboot",
      );
    });

    it("should accept alphanumeric names", () => {
      expect(SubjectBuilder.rpc(orgId, env, deviceId, "cmd123")).toBe(
        "org-123.test.command.rpc.device-456.cmd123",
      );
    });

    it("should accept underscores and hyphens", () => {
      expect(SubjectBuilder.rpc(orgId, env, deviceId, "my_cmd-v2")).toBe(
        "org-123.test.command.rpc.device-456.my_cmd-v2",
      );
    });

    it("should throw ValidationError on spaces", () => {
      expect(() =>
        SubjectBuilder.rpc(orgId, env, deviceId, "bad name"),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError on dots", () => {
      expect(() =>
        SubjectBuilder.rpc(orgId, env, deviceId, "bad.name"),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError on special chars", () => {
      expect(() =>
        SubjectBuilder.rpc(orgId, env, deviceId, "bad@name"),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError on empty string", () => {
      expect(() => SubjectBuilder.rpc(orgId, env, deviceId, "")).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError on slash", () => {
      expect(() =>
        SubjectBuilder.rpc(orgId, env, deviceId, "bad/name"),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError on asterisk (wildcard)", () => {
      expect(() => SubjectBuilder.rpc(orgId, env, deviceId, "bad*")).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError on >", () => {
      expect(() => SubjectBuilder.rpc(orgId, env, deviceId, ">")).toThrow(
        ValidationError,
      );
    });
  });

  describe("command()", () => {
    it("should build correct subject", () => {
      expect(SubjectBuilder.command(orgId, env, deviceId, "shutdown")).toBe(
        "org-123.test.command.queue.device-456.shutdown",
      );
    });

    it("should validate name", () => {
      expect(() =>
        SubjectBuilder.command(orgId, env, deviceId, "bad name"),
      ).toThrow(ValidationError);
    });

    it("should throw on empty name", () => {
      expect(() => SubjectBuilder.command(orgId, env, deviceId, "")).toThrow(
        ValidationError,
      );
    });
  });

  describe("telemetry()", () => {
    it("should build correct subject", () => {
      expect(
        SubjectBuilder.telemetry(orgId, env, deviceId, "temperature"),
      ).toBe("org-123.test.telemetry.device-456.temperature");
    });

    it("should accept hyphens and underscores in metric", () => {
      expect(
        SubjectBuilder.telemetry(orgId, env, deviceId, "cpu_temp-v2"),
      ).toBe("org-123.test.telemetry.device-456.cpu_temp-v2");
    });

    it("should throw ValidationError on invalid metric", () => {
      expect(() =>
        SubjectBuilder.telemetry(orgId, env, deviceId, "bad metric"),
      ).toThrow(ValidationError);
    });

    it("should throw on empty metric", () => {
      expect(() => SubjectBuilder.telemetry(orgId, env, deviceId, "")).toThrow(
        ValidationError,
      );
    });

    it("should throw on dots in metric", () => {
      expect(() =>
        SubjectBuilder.telemetry(orgId, env, deviceId, "cpu.temp"),
      ).toThrow(ValidationError);
    });
  });

  describe("configGet()", () => {
    it("should build correct subject", () => {
      expect(SubjectBuilder.configGet(orgId)).toBe(
        "api.iot.devices.org-123.sdk.config.get",
      );
    });

    it("should work with different orgIds", () => {
      expect(SubjectBuilder.configGet("abc")).toBe(
        "api.iot.devices.abc.sdk.config.get",
      );
    });
  });

  describe("configSet()", () => {
    it("should build correct subject", () => {
      expect(SubjectBuilder.configSet(orgId)).toBe(
        "api.iot.devices.org-123.sdk.config.update",
      );
    });
  });

  describe("event()", () => {
    it("should build correct subject", () => {
      expect(SubjectBuilder.event(orgId, env, deviceId, "boot")).toBe(
        "org-123.test.event.device-456.boot",
      );
    });

    it("should accept valid event names", () => {
      expect(SubjectBuilder.event(orgId, env, deviceId, "device_started")).toBe(
        "org-123.test.event.device-456.device_started",
      );
    });

    it("should throw ValidationError on invalid event name", () => {
      expect(() =>
        SubjectBuilder.event(orgId, env, deviceId, "bad event"),
      ).toThrow(ValidationError);
    });

    it("should throw on empty event name", () => {
      expect(() => SubjectBuilder.event(orgId, env, deviceId, "")).toThrow(
        ValidationError,
      );
    });

    it("should throw on special chars in event name", () => {
      expect(() =>
        SubjectBuilder.event(orgId, env, deviceId, "event!"),
      ).toThrow(ValidationError);
    });

    it("should throw on dots in event name", () => {
      expect(() =>
        SubjectBuilder.event(orgId, env, deviceId, "my.event"),
      ).toThrow(ValidationError);
    });
  });

  describe("environment variations", () => {
    it("should use production env in subject", () => {
      expect(SubjectBuilder.rpc(orgId, "production", deviceId, "reboot")).toBe(
        "org-123.production.command.rpc.device-456.reboot",
      );
    });

    it("should handle different orgId formats", () => {
      expect(SubjectBuilder.command("ORG_ABC", "test", "DEV_1", "cmd")).toBe(
        "ORG_ABC.test.command.queue.DEV_1.cmd",
      );
    });
  });
});
