import { describe, it, expect } from "vitest";
import {
  ValidationError,
  DuplicateListenerError,
  NotConnectedError,
  TimeoutError,
} from "../../src/utils/errors.js";

describe("ValidationError", () => {
  it("should be an instance of Error", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name "ValidationError"', () => {
    const err = new ValidationError("bad input");
    expect(err.name).toBe("ValidationError");
  });

  it("should store the message", () => {
    const err = new ValidationError("field is required");
    expect(err.message).toBe("field is required");
  });

  it("should have a stack trace", () => {
    const err = new ValidationError("test");
    expect(err.stack).toBeDefined();
  });
});

describe("DuplicateListenerError", () => {
  it("should be an instance of Error", () => {
    const err = new DuplicateListenerError("myListener");
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name "DuplicateListenerError"', () => {
    const err = new DuplicateListenerError("myListener");
    expect(err.name).toBe("DuplicateListenerError");
  });

  it("should include the listener name in the message", () => {
    const err = new DuplicateListenerError("reboot");
    expect(err.message).toContain("reboot");
  });

  it("should format message correctly", () => {
    const err = new DuplicateListenerError("update");
    expect(err.message).toBe('Listener "update" is already registered');
  });
});

describe("NotConnectedError", () => {
  it("should be an instance of Error", () => {
    const err = new NotConnectedError();
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name "NotConnectedError"', () => {
    const err = new NotConnectedError();
    expect(err.name).toBe("NotConnectedError");
  });

  it("should have a default message", () => {
    const err = new NotConnectedError();
    expect(err.message).toBe("Not connected to the server");
  });
});

describe("TimeoutError", () => {
  it("should be an instance of Error", () => {
    const err = new TimeoutError("some.subject");
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name "TimeoutError"', () => {
    const err = new TimeoutError("some.subject");
    expect(err.name).toBe("TimeoutError");
  });

  it("should include subject in message when provided", () => {
    const err = new TimeoutError("config.get");
    expect(err.message).toContain("config.get");
  });

  it("should handle missing subject gracefully", () => {
    const err = new TimeoutError();
    expect(err.message).toBe("Request timed out");
  });

  it("should handle null subject", () => {
    const err = new TimeoutError(null);
    expect(err.message).toBe("Request timed out");
  });

  it("should handle empty string subject", () => {
    const err = new TimeoutError("");
    expect(err.message).toBe("Request timed out");
  });
});
