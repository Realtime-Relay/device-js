import { ValidationError } from "./errors.js";

const TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

function validateToken(value, label) {
  if (!TOKEN_REGEX.test(value)) {
    throw new ValidationError(
      `${label} must contain only A-Z, a-z, 0-9, _ and -`,
    );
  }
}

export const SubjectBuilder = {
  rpc(orgId, env, deviceId, name) {
    validateToken(name, "name");
    return `${orgId}.${env}.command.rpc.${deviceId}.${name}`;
  },

  command(orgId, env, deviceId, name) {
    validateToken(name, "name");
    return `${orgId}.${env}.command.queue.${deviceId}.${name}`;
  },

  telemetry(orgId, env, deviceId, metric) {
    validateToken(metric, "metric");
    return `${orgId}.${env}.telemetry.${deviceId}.${metric}`;
  },

  configGet(orgId) {
    return `api.iot.devices.${orgId}.sdk.config.get`;
  },

  schemaGet(orgId) {
    return `api.iot.devices.${orgId}.sdk.schema.get`;
  },

  configSet(orgId) {
    return `api.iot.devices.${orgId}.sdk.config.update`;
  },

  event(orgId, env, deviceId, eventName) {
    validateToken(eventName, "eventName");
    return `${orgId}.${env}.events.${deviceId}.${eventName}`;
  },

  log(orgId, env, deviceId, type) {
    if (type !== "info" && type !== "warn" && type !== "error") {
      throw new ValidationError(
        `log type must be one of 'info', 'warn', 'error'`,
      );
    }
    return `${orgId}.${env}.logs.${deviceId}.${type}`;
  },
};
