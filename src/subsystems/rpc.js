import { ListenerRegistry } from "../utils/listener-registry.js";
import { DuplicateListenerError, ValidationError } from "../utils/errors.js";
import { SubjectBuilder } from "../utils/subject-builder.js";
import { encode } from "@msgpack/msgpack";
import { JSONCodec } from "nats";

export class RpcManager {
  #transport;
  #registry = new ListenerRegistry();

  constructor(transport) {
    this.#transport = transport;
  }

  async listen(name, callback) {
    if (typeof callback !== "function") {
      throw new ValidationError("callback must be a function");
    }

    if (this.#registry.has(name)) {
      throw new DuplicateListenerError(name);
    }

    const subject = SubjectBuilder.rpc(
      this.#transport.getOrgId(),
      this.#transport.getEnv(),
      this.#transport.getDeviceId(),
      name,
    );

    const subscription = this.#transport.coreSubscribe(subject, (data, msg) => {
      const request = {
        payload: data,
        respond: (responseData) => {
          msg.respond(JSONCodec().encode({ status: "ok", data: responseData }));
        },
        error: (errorData) => {
          msg.respond(JSONCodec().encode({ status: "error", data: errorData }));
        },
      };
      callback(request);
    });

    this.#registry.register(name, callback);
    this.#registry.setSubscription(name, subscription);
  }

  async off(name) {
    const entry = this.#registry.get(name);
    if (!entry) {
      return false;
    }

    if (entry.subscription) {
      entry.subscription.unsubscribe();
    }

    this.#registry.unregister(name);
    return true;
  }
}
