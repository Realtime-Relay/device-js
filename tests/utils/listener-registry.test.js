import { describe, it, expect, beforeEach } from 'vitest';
import { ListenerRegistry } from '../../src/utils/listener-registry.js';

describe('ListenerRegistry', () => {
    let registry;
    const cb = () => {};

    beforeEach(() => {
        registry = new ListenerRegistry();
    });

    describe('register()', () => {
        it('should return true when registering a new listener', () => {
            expect(registry.register('foo', cb)).toBe(true);
        });

        it('should return false when registering a duplicate', () => {
            registry.register('foo', cb);
            expect(registry.register('foo', cb)).toBe(false);
        });

        it('should allow different names', () => {
            expect(registry.register('foo', cb)).toBe(true);
            expect(registry.register('bar', cb)).toBe(true);
        });

        it('should store the callback', () => {
            const myCb = () => 'hello';
            registry.register('test', myCb);
            expect(registry.get('test').callback).toBe(myCb);
        });

        it('should initialize subscription as null', () => {
            registry.register('test', cb);
            expect(registry.get('test').subscription).toBeNull();
        });
    });

    describe('unregister()', () => {
        it('should return true when removing an existing listener', () => {
            registry.register('foo', cb);
            expect(registry.unregister('foo')).toBe(true);
        });

        it('should return false when removing a non-existent listener', () => {
            expect(registry.unregister('foo')).toBe(false);
        });

        it('should actually remove the entry', () => {
            registry.register('foo', cb);
            registry.unregister('foo');
            expect(registry.has('foo')).toBe(false);
        });

        it('should allow re-registration after unregister', () => {
            registry.register('foo', cb);
            registry.unregister('foo');
            expect(registry.register('foo', cb)).toBe(true);
        });
    });

    describe('has()', () => {
        it('should return false for unregistered name', () => {
            expect(registry.has('nope')).toBe(false);
        });

        it('should return true for registered name', () => {
            registry.register('yes', cb);
            expect(registry.has('yes')).toBe(true);
        });

        it('should return false after unregister', () => {
            registry.register('temp', cb);
            registry.unregister('temp');
            expect(registry.has('temp')).toBe(false);
        });
    });

    describe('get()', () => {
        it('should return undefined for non-existent name', () => {
            expect(registry.get('nope')).toBeUndefined();
        });

        it('should return the entry with callback and subscription', () => {
            registry.register('test', cb);
            const entry = registry.get('test');
            expect(entry).toHaveProperty('callback', cb);
            expect(entry).toHaveProperty('subscription', null);
        });
    });

    describe('setSubscription()', () => {
        it('should set subscription on existing entry', () => {
            registry.register('test', cb);
            const sub = { id: 'sub-1' };
            registry.setSubscription('test', sub);
            expect(registry.get('test').subscription).toBe(sub);
        });

        it('should do nothing for non-existent entry', () => {
            // should not throw
            registry.setSubscription('nope', { id: 'sub-1' });
            expect(registry.has('nope')).toBe(false);
        });

        it('should overwrite previous subscription', () => {
            registry.register('test', cb);
            registry.setSubscription('test', { id: 'sub-1' });
            registry.setSubscription('test', { id: 'sub-2' });
            expect(registry.get('test').subscription.id).toBe('sub-2');
        });
    });

    describe('entries()', () => {
        it('should return empty iterator when no listeners', () => {
            const entries = [...registry.entries()];
            expect(entries).toHaveLength(0);
        });

        it('should return all registered entries', () => {
            registry.register('a', cb);
            registry.register('b', cb);
            registry.register('c', cb);
            const entries = [...registry.entries()];
            expect(entries).toHaveLength(3);
        });

        it('should yield [name, entry] pairs', () => {
            const myCb = () => {};
            registry.register('test', myCb);
            const [[name, entry]] = [...registry.entries()];
            expect(name).toBe('test');
            expect(entry.callback).toBe(myCb);
        });
    });
});
