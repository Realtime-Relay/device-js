import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RpcManager } from '../../src/subsystems/rpc.js';
import { DuplicateListenerError, ValidationError } from '../../src/utils/errors.js';
import { createMockTransport } from '../helpers/mock-transport.js';
import { JSONCodec } from 'nats';

describe('RpcManager', () => {
    let transport;
    let rpc;

    beforeEach(() => {
        transport = createMockTransport();
        rpc = new RpcManager(transport);
    });

    describe('listen()', () => {
        it('should throw ValidationError if callback is not a function', async () => {
            await expect(rpc.listen('test', 'not a function'))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if callback is null', async () => {
            await expect(rpc.listen('test', null))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if callback is undefined', async () => {
            await expect(rpc.listen('test', undefined))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if callback is a number', async () => {
            await expect(rpc.listen('test', 42))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if callback is an object', async () => {
            await expect(rpc.listen('test', {}))
                .rejects.toThrow(ValidationError);
        });

        it('should subscribe to the correct NATS subject', async () => {
            await rpc.listen('reboot', () => {});
            const subs = transport._getSubscriptions();
            const expectedSubject = 'test-org.test.command.rpc.test-device.reboot';
            expect(subs[expectedSubject]).toBeDefined();
        });

        it('should throw DuplicateListenerError on second listen for same name', async () => {
            await rpc.listen('reboot', () => {});
            await expect(rpc.listen('reboot', () => {}))
                .rejects.toThrow(DuplicateListenerError);
        });

        it('should allow different names', async () => {
            await rpc.listen('reboot', () => {});
            await expect(rpc.listen('update', () => {})).resolves.not.toThrow();
        });

        it('should pass RpcRequest object to callback with payload', async () => {
            const received = [];
            await rpc.listen('test', (req) => received.push(req));

            const subject = 'test-org.test.command.rpc.test-device.test';
            const mockMsg = { respond: vi.fn() };
            transport._simulateMessage(subject, { foo: 'bar' }, mockMsg);

            expect(received).toHaveLength(1);
            expect(received[0].payload).toEqual({ foo: 'bar' });
        });

        it('should provide respond() method on RpcRequest', async () => {
            let capturedReq;
            await rpc.listen('test', (req) => { capturedReq = req; });

            const subject = 'test-org.test.command.rpc.test-device.test';
            const mockMsg = { respond: vi.fn() };
            transport._simulateMessage(subject, { data: 1 }, mockMsg);

            expect(capturedReq.respond).toBeInstanceOf(Function);
        });

        it('should provide error() method on RpcRequest', async () => {
            let capturedReq;
            await rpc.listen('test', (req) => { capturedReq = req; });

            const subject = 'test-org.test.command.rpc.test-device.test';
            const mockMsg = { respond: vi.fn() };
            transport._simulateMessage(subject, { data: 1 }, mockMsg);

            expect(capturedReq.error).toBeInstanceOf(Function);
        });

        it('respond() should call msg.respond with encoded success envelope', async () => {
            let capturedReq;
            await rpc.listen('test', (req) => { capturedReq = req; });

            const subject = 'test-org.test.command.rpc.test-device.test';
            const mockMsg = { respond: vi.fn() };
            transport._simulateMessage(subject, {}, mockMsg);

            capturedReq.respond({ result: 42 });

            expect(mockMsg.respond).toHaveBeenCalledOnce();
            const encoded = mockMsg.respond.mock.calls[0][0];
            expect(encoded).toEqual(JSONCodec().encode({ status: 'ok', data: { result: 42 } }));
        });

        it('error() should call msg.respond with encoded error envelope', async () => {
            let capturedReq;
            await rpc.listen('test', (req) => { capturedReq = req; });

            const subject = 'test-org.test.command.rpc.test-device.test';
            const mockMsg = { respond: vi.fn() };
            transport._simulateMessage(subject, {}, mockMsg);

            capturedReq.error({ code: 'FAIL', message: 'oops' });

            expect(mockMsg.respond).toHaveBeenCalledOnce();
            const encoded = mockMsg.respond.mock.calls[0][0];
            expect(encoded).toEqual(JSONCodec().encode({ status: 'error', data: { code: 'FAIL', message: 'oops' } }));
        });

        it('should throw ValidationError on invalid name characters', async () => {
            await expect(rpc.listen('bad name', () => {}))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError on empty name', async () => {
            await expect(rpc.listen('', () => {}))
                .rejects.toThrow(ValidationError);
        });
    });

    describe('off()', () => {
        it('should return false when removing non-existent listener', async () => {
            expect(await rpc.off('nonexistent')).toBe(false);
        });

        it('should return true when removing existing listener', async () => {
            await rpc.listen('reboot', () => {});
            expect(await rpc.off('reboot')).toBe(true);
        });

        it('should unsubscribe from transport', async () => {
            await rpc.listen('reboot', () => {});
            const subject = 'test-org.test.command.rpc.test-device.reboot';
            expect(transport._getSubscriptions()[subject]).toBeDefined();

            await rpc.off('reboot');
            expect(transport._getSubscriptions()[subject]).toBeUndefined();
        });

        it('should allow re-registration after off', async () => {
            await rpc.listen('reboot', () => {});
            await rpc.off('reboot');
            await expect(rpc.listen('reboot', () => {})).resolves.not.toThrow();
        });

        it('should be safe to call off multiple times', async () => {
            await rpc.listen('reboot', () => {});
            expect(await rpc.off('reboot')).toBe(true);
            expect(await rpc.off('reboot')).toBe(false);
        });

        it('should only remove the specified listener', async () => {
            await rpc.listen('reboot', () => {});
            await rpc.listen('update', () => {});
            await rpc.off('reboot');

            const subs = transport._getSubscriptions();
            expect(subs['test-org.test.command.rpc.test-device.reboot']).toBeUndefined();
            expect(subs['test-org.test.command.rpc.test-device.update']).toBeDefined();
        });
    });
});
