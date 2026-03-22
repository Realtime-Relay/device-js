import { describe, it, expect, beforeEach } from 'vitest';
import { EventManager } from '../../src/subsystems/event.js';
import { createMockTransport } from '../helpers/mock-transport.js';

describe('EventManager', () => {
    let transport;
    let event;

    beforeEach(() => {
        transport = createMockTransport();
        event = new EventManager(transport);
    });

    describe('send()', () => {
        it('should publish to the correct subject', async () => {
            await event.send('boot', { reason: 'power_on' });
            const published = transport._getPublished();
            expect(published).toHaveLength(1);
            expect(published[0].subject).toBe('test-org.test.event.test-device.boot');
        });

        it('should pass data as payload', async () => {
            const data = { reason: 'power_on', timestamp: 123 };
            await event.send('boot', data);
            const published = transport._getPublished();
            expect(published[0].data).toEqual(data);
        });

        it('should handle string data', async () => {
            await event.send('log', 'something happened');
            expect(transport._getPublished()[0].data).toBe('something happened');
        });

        it('should handle numeric data', async () => {
            await event.send('counter', 42);
            expect(transport._getPublished()[0].data).toBe(42);
        });

        it('should handle null data', async () => {
            await event.send('ping', null);
            expect(transport._getPublished()[0].data).toBeNull();
        });

        it('should handle nested object data', async () => {
            const nested = { a: { b: { c: 'deep' } } };
            await event.send('test', nested);
            expect(transport._getPublished()[0].data).toEqual(nested);
        });

        it('should throw ValidationError on invalid event name', async () => {
            await expect(event.send('bad event', {}))
                .rejects.toThrow();
        });

        it('should throw ValidationError on empty event name', async () => {
            await expect(event.send('', {}))
                .rejects.toThrow();
        });

        it('should throw ValidationError on event name with dots', async () => {
            await expect(event.send('my.event', {}))
                .rejects.toThrow();
        });

        it('should throw ValidationError on event name with special chars', async () => {
            await expect(event.send('event!', {}))
                .rejects.toThrow();
        });

        it('should accept event names with underscores and hyphens', async () => {
            await event.send('device_started', {});
            await event.send('device-stopped', {});
            expect(transport._getPublished()).toHaveLength(2);
        });

        it('should return the result from transport.publish()', async () => {
            // mock transport returns connected state from publish
            const result = await event.send('test', {});
            expect(typeof result).toBe('boolean');
        });
    });
});
