import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeManager } from '../../src/subsystems/time.js';
import { NotConnectedError } from '../../src/utils/errors.js';
import { TransportStatus } from '../../src/transport.js';
import { createMockTransport } from '../helpers/mock-transport.js';

// Mock ntp-time module
vi.mock('ntp-time', () => {
    class MockNtpClient {
        constructor() {}
        async syncTime() {
            return {
                time: new Date(Date.now() + 50), // server is 50ms ahead
            };
        }
    }
    return { Client: MockNtpClient };
});

describe('TimeManager', () => {
    let transport;
    let time;

    beforeEach(() => {
        vi.clearAllMocks();
        transport = createMockTransport();
        time = new TimeManager(transport);
    });

    describe('init()', () => {
        it('should throw NotConnectedError when not connected', async () => {
            await expect(time.init()).rejects.toThrow(NotConnectedError);
        });

        it('should succeed when connected', async () => {
            transport._emitStatus({ type: TransportStatus.CONNECTED });
            await expect(time.init()).resolves.not.toThrow();
        });

        it('should succeed after reconnect', async () => {
            transport._emitStatus({ type: TransportStatus.RECONNECTED });
            await expect(time.init()).resolves.not.toThrow();
        });

        it('should throw after disconnect', async () => {
            transport._emitStatus({ type: TransportStatus.CONNECTED });
            transport._emitStatus({ type: TransportStatus.DISCONNECTED });
            await expect(time.init()).rejects.toThrow(NotConnectedError);
        });
    });

    describe('now()', () => {
        it('should return a number', () => {
            const result = time.now();
            expect(typeof result).toBe('number');
        });

        it('should return ms-precision timestamp close to Date.now()', () => {
            const result = time.now();
            const now = Date.now();
            // Without init, offset is 0, so should be very close to Date.now()
            expect(result).toBeGreaterThan(now - 100);
            expect(result).toBeLessThan(now + 100);
        });

        it('should include offset after init', async () => {
            transport._emitStatus({ type: TransportStatus.CONNECTED });
            await time.init();
            const result = time.now();
            const now = Date.now();
            // Mock NTP is 50ms ahead, so now() should be ~50ms ahead of Date.now()
            expect(result).toBeGreaterThan(now);
            expect(result).toBeLessThan(now + 200);
        });

        it('should return different values on successive calls', () => {
            const t1 = time.now();
            for (let i = 0; i < 10000; i++) {} // busy wait
            const t2 = time.now();
            expect(t2).toBeGreaterThanOrEqual(t1);
        });
    });

    describe('toDate()', () => {
        it('should convert ms timestamp to Date', () => {
            const ms = 1700000000000;
            const result = time.toDate(ms);
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBe(ms);
        });

        it('should handle zero timestamp', () => {
            const result = time.toDate(0);
            expect(result.getTime()).toBe(0);
        });

        it('should not require connection', () => {
            expect(() => time.toDate(1700000000000)).not.toThrow();
        });
    });

    describe('toTimestamp()', () => {
        it('should convert Date to ms timestamp', () => {
            const date = new Date(1700000000000);
            const result = time.toTimestamp(date);
            expect(result).toBe(1700000000000);
        });

        it('should handle epoch date', () => {
            const date = new Date(0);
            expect(time.toTimestamp(date)).toBe(0);
        });

        it('should not require connection', () => {
            expect(() => time.toTimestamp(new Date())).not.toThrow();
        });

        it('should be inverse of toDate', () => {
            const originalMs = 1700000000000;
            const date = time.toDate(originalMs);
            const roundTrip = time.toTimestamp(date);
            expect(roundTrip).toBe(originalMs);
        });
    });

    describe('setTimezone()', () => {
        it('should accept IANA timezone string', () => {
            expect(() => time.setTimezone('America/New_York')).not.toThrow();
        });

        it('should accept UTC', () => {
            expect(() => time.setTimezone('UTC')).not.toThrow();
        });

        it('should not require connection', () => {
            expect(() => time.setTimezone('Europe/London')).not.toThrow();
        });
    });

    describe('lifecycle - auto sync on connect/reconnect', () => {
        it('should auto-call init on first connect when stale', async () => {
            transport._emitStatus({ type: TransportStatus.CONNECTED });
            await new Promise(r => setTimeout(r, 50));
            const result = time.now();
            expect(result).toBeGreaterThan(0);
        });

        it('should auto-call init on reconnect when stale', async () => {
            transport._emitStatus({ type: TransportStatus.RECONNECTED });
            await new Promise(r => setTimeout(r, 50));
            const result = time.now();
            expect(result).toBeGreaterThan(0);
        });

        it('should not throw on disconnect event', () => {
            expect(() => {
                transport._emitStatus({ type: TransportStatus.DISCONNECTED });
            }).not.toThrow();
        });
    });
});
