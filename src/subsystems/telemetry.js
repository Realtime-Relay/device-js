import { SubjectBuilder } from "../utils/subject-builder.js";
import { ValidationError } from "../utils/errors.js";

const VALID_TYPES = new Set(['number', 'string', 'json', 'boolean']);

function getReadingType(value) {
    if (value === null || value === undefined) return null;
    const t = typeof value;
    if (t === 'number') return 'number';
    if (t === 'string') return 'string';
    if (t === 'boolean') return 'boolean';
    if (t === 'object') return 'json';
    return null;
}

export class TelemetryManager {

    #transport;
    #time;

    constructor(transport, time) {
        this.#transport = transport;
        this.#time = time;
    }

    async publish(metric, reading) {
        const schema = this.#transport.getSchema();

        if (schema) {
            if (!(metric in schema)) {
                throw new ValidationError(`metric '${metric}' is not defined in the device schema`);
            }

            const expectedType = schema[metric]?.type;
            const actualType = getReadingType(reading);

            if (actualType !== null && actualType !== expectedType) {
                throw new ValidationError(
                    `metric '${metric}' expects type '${expectedType}', got '${actualType}'`
                );
            }
        }

        const subject = SubjectBuilder.telemetry(
            this.#transport.getOrgId(),
            this.#transport.getEnv(),
            this.#transport.getDeviceId(),
            metric,
        );

        const payload = {
            value: reading,
            timestamp: this.#time.now(),
        };

        return this.#transport.publish(subject, payload);
    }
}
