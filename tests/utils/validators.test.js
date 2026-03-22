import { describe, it, expect } from 'vitest';
import { Validators } from '../../src/utils/validators.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('Validators', () => {
    const validator = new Validators();

    const validConfig = {
        api_key: 'some-jwt-key',
        secret: 'some-nkey-seed',
        mode: 'test',
    };

    describe('validateDeviceConfig - valid configs', () => {
        it('should accept valid test mode config', () => {
            expect(() => validator.validateDeviceConfig(validConfig)).not.toThrow();
        });

        it('should accept valid production mode config', () => {
            expect(() => validator.validateDeviceConfig({
                ...validConfig,
                mode: 'production',
            })).not.toThrow();
        });
    });

    describe('validateDeviceConfig - null/undefined/non-object config', () => {
        it('should throw on null config', () => {
            expect(() => validator.validateDeviceConfig(null))
                .toThrow(ValidationError);
        });

        it('should throw on undefined config', () => {
            expect(() => validator.validateDeviceConfig(undefined))
                .toThrow(ValidationError);
        });

        it('should throw on string config', () => {
            expect(() => validator.validateDeviceConfig('not an object'))
                .toThrow(ValidationError);
        });

        it('should throw on number config', () => {
            expect(() => validator.validateDeviceConfig(42))
                .toThrow(ValidationError);
        });

        it('should throw on boolean config', () => {
            expect(() => validator.validateDeviceConfig(true))
                .toThrow(ValidationError);
        });

        it('should throw on empty object (missing all fields)', () => {
            expect(() => validator.validateDeviceConfig({}))
                .toThrow(ValidationError);
        });
    });

    describe('validateDeviceConfig - api_key validation', () => {
        it('should throw when api_key is null', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, api_key: null }))
                .toThrow(/api_key/);
        });

        it('should throw when api_key is undefined', () => {
            const config = { secret: 'x', mode: 'test' };
            expect(() => validator.validateDeviceConfig(config))
                .toThrow(/api_key/);
        });

        it('should throw when api_key is empty string', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, api_key: '' }))
                .toThrow(/api_key/);
        });
    });

    describe('validateDeviceConfig - secret validation', () => {
        it('should throw when secret is null', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, secret: null }))
                .toThrow(/secret/);
        });

        it('should throw when secret is undefined', () => {
            const config = { api_key: 'x', mode: 'test' };
            expect(() => validator.validateDeviceConfig(config))
                .toThrow(/secret/);
        });

        it('should throw when secret is empty string', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, secret: '' }))
                .toThrow(/secret/);
        });
    });

    describe('validateDeviceConfig - mode validation', () => {
        it('should throw when mode is null', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, mode: null }))
                .toThrow(/mode/);
        });

        it('should throw when mode is undefined', () => {
            const config = { api_key: 'x', secret: 'y' };
            expect(() => validator.validateDeviceConfig(config))
                .toThrow(/mode/);
        });

        it('should throw when mode is empty string', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, mode: '' }))
                .toThrow(/mode/);
        });

        it('should throw when mode is invalid string', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, mode: 'staging' }))
                .toThrow(/mode must be one of/);
        });

        it('should throw when mode is "Test" (case sensitive)', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, mode: 'Test' }))
                .toThrow(/mode must be one of/);
        });

        it('should throw when mode is "PRODUCTION" (case sensitive)', () => {
            expect(() => validator.validateDeviceConfig({ ...validConfig, mode: 'PRODUCTION' }))
                .toThrow(/mode must be one of/);
        });
    });

    describe('error type', () => {
        it('should always throw ValidationError', () => {
            try {
                validator.validateDeviceConfig(null);
            } catch (err) {
                expect(err).toBeInstanceOf(ValidationError);
                expect(err.name).toBe('ValidationError');
            }
        });
    });
});
