import { TransportStatus } from '../../src/transport.js';

export function createMockTransport(overrides = {}) {
    const statusCallbacks = [];
    const subscriptions = {};
    const published = [];
    const requests = [];
    let connected = false;
    let orgId = overrides.orgId ?? 'test-org';
    let deviceId = overrides.deviceId ?? 'test-device';
    let env = overrides.env ?? 'test';
    let schema = overrides.schema ?? null;

    const transport = {
        // Connection
        async connect() {
            if (connected) return false;
            connected = true;
            transport._emitStatus({ type: TransportStatus.CONNECTED });
            return true;
        },
        async disconnect() {
            if (!connected) return false;
            connected = false;
            transport._emitStatus({ type: TransportStatus.DISCONNECTED });
            return true;
        },
        isConnected: () => connected,

        // Core Subscribe (natsClient.subscribe — used by RPC)
        coreSubscribe(subject, callback) {
            const sub = {
                subject,
                callback,
                unsubscribe: () => { delete subscriptions[subject]; },
            };
            subscriptions[subject] = sub;
            return sub;
        },

        // JetStream Subscribe (used by Command)
        async subscribe(subject, callback) {
            const sub = { subject, callback, consumer: { delete: async () => {} } };
            subscriptions[subject] = sub;
            return sub;
        },
        async unsubscribe(subscription) {
            if (subscription) {
                delete subscriptions[subscription.subject];
            }
        },

        // Publish
        async publish(subject, data) {
            published.push({ subject, data });
            return connected;
        },

        // Request
        async request(subject, data, opts) {
            requests.push({ subject, data, opts });
            if (overrides.requestHandler) {
                return overrides.requestHandler(subject, data, opts);
            }
            return { status: 'OK', data: {} };
        },

        // Status
        onStatus(callback) {
            statusCallbacks.push(callback);
        },

        // Getters
        getOrgId: () => orgId,
        getDeviceId: () => deviceId,
        getEnv: () => env,
        getSchema: () => schema,

        // Test helpers
        _emitStatus(event) {
            for (const cb of statusCallbacks) {
                cb(event);
            }
        },
        _getSubscriptions: () => subscriptions,
        _getPublished: () => published,
        _getRequests: () => requests,
        _getStatusCallbacks: () => statusCallbacks,
        _simulateMessage(subject, data, msg) {
            const sub = subscriptions[subject];
            if (sub) {
                sub.callback(data, msg);
            }
        },
    };

    return transport;
}
