import { Validators } from "./utils/validators.js";
import { NatsTransport } from "./transport.js";
import { RpcManager } from "./subsystems/rpc.js";
import { CommandManager } from "./subsystems/command.js";
import { TelemetryManager } from "./subsystems/telemetry.js";
import { ConfigManager } from "./subsystems/config.js";
import { EventManager } from "./subsystems/event.js";
import { TimeManager } from "./subsystems/time.js";

export class RelayDevice {
  static TEST_MODE = "test";
  static PRODUCTION_MODE = "production";

  #deviceConfig;
  #transport;

  constructor(config, _testTransport) {
    const validator = new Validators();
    validator.validateDeviceConfig(config);

    this.#deviceConfig = config;
    this.#transport = _testTransport ?? new NatsTransport(config);

    this.#initSubsystems();
  }

  #initSubsystems() {
    this.time = new TimeManager(this.#transport);
    this.rpc = new RpcManager(this.#transport);
    this.command = new CommandManager(this.#transport);
    this.telemetry = new TelemetryManager(this.#transport, this.time);
    this.config = new ConfigManager(this.#transport);
    this.event = new EventManager(this.#transport, this.time);
    this.connection = {
      listeners: (callback) => this.#transport.onStatus(callback),
    };
  }

  static _createForTest(config, transport) {
    return new RelayDevice(config, transport);
  }

  async connect() {
    return this.#transport.connect();
  }

  async disconnect() {
    return this.#transport.disconnect();
  }
}
