import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../../src/subsystems/config.js';
import { createMockTransport } from '../helpers/mock-transport.js';

describe('ConfigManager', () => {
    let transport;
    let config;

    beforeEach(() => {
        transport = createMockTransport();
        config = new ConfigManager(transport);
    });

    describe('get()', () => {
        it('should request from the correct subject', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_FETCH_SUCCESS', data: {} }),
            });
            config = new ConfigManager(transport);

            await config.get();
            const requests = transport._getRequests();
            expect(requests).toHaveLength(1);
            expect(requests[0].subject).toBe('api.iot.devices.test-org.sdk.config.get');
        });

        it('should send device_id in request payload', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_FETCH_SUCCESS', data: {} }),
            });
            config = new ConfigManager(transport);

            await config.get();
            const requests = transport._getRequests();
            expect(requests[0].data).toEqual({ id: 'test-device' });
        });

        it('should return data on DEVICE_CONFIG_FETCH_SUCCESS', async () => {
            const configData = { name: 'my-device', interval: 5000 };
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_FETCH_SUCCESS', data: { config: configData } }),
            });
            config = new ConfigManager(transport);

            const result = await config.get();
            expect(result).toEqual(configData);
        });

        it('should return null on non-success status', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_FETCH_FAILED', data: null }),
            });
            config = new ConfigManager(transport);

            const result = await config.get();
            expect(result).toBeNull();
        });

        it('should return null on unknown status', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'SOMETHING_ELSE' }),
            });
            config = new ConfigManager(transport);

            const result = await config.get();
            expect(result).toBeNull();
        });

        it('should return null on empty status', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: '' }),
            });
            config = new ConfigManager(transport);

            const result = await config.get();
            expect(result).toBeNull();
        });

        it('should propagate transport errors (e.g. TimeoutError)', async () => {
            transport = createMockTransport({
                requestHandler: () => { throw new Error('TIMEOUT'); },
            });
            config = new ConfigManager(transport);

            await expect(config.get()).rejects.toThrow('TIMEOUT');
        });
    });

    describe('set()', () => {
        it('should request to the correct subject', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_SUCCESS' }),
            });
            config = new ConfigManager(transport);

            await config.set({ interval: 10000 });
            const requests = transport._getRequests();
            expect(requests[0].subject).toBe('api.iot.devices.test-org.sdk.config.update');
        });

        it('should send device_id and config in payload', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_SUCCESS' }),
            });
            config = new ConfigManager(transport);

            const newConfig = { interval: 10000, name: 'updated' };
            await config.set(newConfig);
            const requests = transport._getRequests();
            expect(requests[0].data).toEqual({
                id: 'test-device',
                config: newConfig,
            });
        });

        it('should return true on DEVICE_CONFIG_UPDATE_SUCCESS', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_SUCCESS' }),
            });
            config = new ConfigManager(transport);

            const result = await config.set({ interval: 5000 });
            expect(result).toBe(true);
        });

        it('should return false on non-success status', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_FAILED' }),
            });
            config = new ConfigManager(transport);

            const result = await config.set({ interval: 5000 });
            expect(result).toBe(false);
        });

        it('should return false on unknown status', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'NOPE' }),
            });
            config = new ConfigManager(transport);

            const result = await config.set({});
            expect(result).toBe(false);
        });

        it('should propagate transport errors', async () => {
            transport = createMockTransport({
                requestHandler: () => { throw new Error('connection lost'); },
            });
            config = new ConfigManager(transport);

            await expect(config.set({})).rejects.toThrow('connection lost');
        });

        it('should handle empty config object', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_SUCCESS' }),
            });
            config = new ConfigManager(transport);

            const result = await config.set({});
            expect(result).toBe(true);
        });

        it('should handle nested config data', async () => {
            transport = createMockTransport({
                requestHandler: () => ({ status: 'DEVICE_CONFIG_UPDATE_SUCCESS' }),
            });
            config = new ConfigManager(transport);

            const nested = { network: { wifi: { ssid: 'test', password: 'secret' } } };
            await config.set(nested);
            expect(transport._getRequests()[0].data.config).toEqual(nested);
        });
    });
});
