/**
 * Unit tests for Channel Guard
 */

import { describe, it, expect } from 'vitest';
import {
  validateChannel,
  isChannelAllowed,
  getAllowedChannels,
  ChannelNotAllowedError,
} from './channel-guard.js';

describe('Channel Guard', () => {
  describe('validateChannel', () => {
    it('should allow System channel', () => {
      expect(validateChannel('System')).toBe('System');
    });

    it('should allow Application channel', () => {
      expect(validateChannel('Application')).toBe('Application');
    });

    it('should block Security channel', () => {
      expect(() => validateChannel('Security')).toThrow(ChannelNotAllowedError);
    });

    it('should block Setup channel', () => {
      expect(() => validateChannel('Setup')).toThrow(ChannelNotAllowedError);
    });

    it('should block ForwardedEvents channel', () => {
      expect(() => validateChannel('ForwardedEvents')).toThrow(ChannelNotAllowedError);
    });

    it('should block empty string', () => {
      expect(() => validateChannel('')).toThrow(ChannelNotAllowedError);
    });

    it('should block null', () => {
      expect(() => validateChannel(null)).toThrow(ChannelNotAllowedError);
    });

    it('should block undefined', () => {
      expect(() => validateChannel(undefined)).toThrow(ChannelNotAllowedError);
    });

    // Case sensitivity tests - CRITICAL for security
    it('should block lowercase "system" (case-sensitive)', () => {
      expect(() => validateChannel('system')).toThrow(ChannelNotAllowedError);
    });

    it('should block uppercase "SYSTEM" (case-sensitive)', () => {
      expect(() => validateChannel('SYSTEM')).toThrow(ChannelNotAllowedError);
    });

    it('should block mixed case "SyStEm" (case-sensitive)', () => {
      expect(() => validateChannel('SyStEm')).toThrow(ChannelNotAllowedError);
    });

    it('should block lowercase "application" (case-sensitive)', () => {
      expect(() => validateChannel('application')).toThrow(ChannelNotAllowedError);
    });

    // Bypass attempt tests
    it('should block path traversal "../Security"', () => {
      expect(() => validateChannel('../Security')).toThrow(ChannelNotAllowedError);
    });

    it('should block path traversal "System/../Security"', () => {
      expect(() => validateChannel('System/../Security')).toThrow(ChannelNotAllowedError);
    });

    it('should block with leading whitespace " System"', () => {
      expect(() => validateChannel(' System')).toThrow(ChannelNotAllowedError);
    });

    it('should block with trailing whitespace "System "', () => {
      expect(() => validateChannel('System ')).toThrow(ChannelNotAllowedError);
    });

    it('should block with null byte "System\\x00"', () => {
      expect(() => validateChannel('System\x00')).toThrow(ChannelNotAllowedError);
    });

    it('should block with newline "System\\n"', () => {
      expect(() => validateChannel('System\n')).toThrow(ChannelNotAllowedError);
    });

    // Unicode bypass attempts
    it('should block fullwidth characters', () => {
      // Ｓystem (fullwidth S)
      expect(() => validateChannel('\uFF33ystem')).toThrow(ChannelNotAllowedError);
    });

    it('should block homoglyph characters', () => {
      // Using Cyrillic 'а' instead of Latin 'a'
      expect(() => validateChannel('Applic\u0430tion')).toThrow(ChannelNotAllowedError);
    });

    // Microsoft-Windows-* channels
    it('should block Microsoft-Windows-Security-Auditing', () => {
      expect(() => validateChannel('Microsoft-Windows-Security-Auditing')).toThrow(ChannelNotAllowedError);
    });

    it('should block Microsoft-Windows-PowerShell', () => {
      expect(() => validateChannel('Microsoft-Windows-PowerShell/Operational')).toThrow(ChannelNotAllowedError);
    });

    // Error properties
    it('should include error code in thrown error', () => {
      try {
        validateChannel('Security');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelNotAllowedError);
        expect((err as ChannelNotAllowedError).code).toBe('CHANNEL_NOT_ALLOWED');
      }
    });

    it('should include allowed channels in thrown error', () => {
      try {
        validateChannel('Security');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelNotAllowedError);
        expect((err as ChannelNotAllowedError).allowedChannels).toEqual(['System', 'Application']);
      }
    });
  });

  describe('isChannelAllowed', () => {
    it('should return true for System', () => {
      expect(isChannelAllowed('System')).toBe(true);
    });

    it('should return true for Application', () => {
      expect(isChannelAllowed('Application')).toBe(true);
    });

    it('should return false for Security', () => {
      expect(isChannelAllowed('Security')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isChannelAllowed(null)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isChannelAllowed(123)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isChannelAllowed({ name: 'System' })).toBe(false);
    });
  });

  describe('getAllowedChannels', () => {
    it('should return System and Application', () => {
      const allowed = getAllowedChannels();
      expect(allowed).toEqual(['System', 'Application']);
    });

    it('should return a copy (immutable)', () => {
      const allowed1 = getAllowedChannels();
      const allowed2 = getAllowedChannels();
      expect(allowed1).not.toBe(allowed2);
    });
  });
});
