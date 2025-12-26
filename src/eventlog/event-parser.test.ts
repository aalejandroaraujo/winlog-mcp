/**
 * Unit tests for event parsing and normalization
 */

import { describe, it, expect } from 'vitest';
import type { EventRecord, EventLevel } from '../types.js';

// Test the level mapping logic (extracted for testing)
function mapLevel(level: number, displayName?: string): EventLevel {
  if (displayName) {
    const normalized = displayName.toLowerCase();
    if (normalized === 'critical') return 'Critical';
    if (normalized === 'error') return 'Error';
    if (normalized === 'warning') return 'Warning';
    if (normalized === 'information' || normalized === 'info') return 'Information';
    if (normalized === 'verbose') return 'Verbose';
  }

  switch (level) {
    case 1:
      return 'Critical';
    case 2:
      return 'Error';
    case 3:
      return 'Warning';
    case 4:
      return 'Information';
    case 5:
      return 'Verbose';
    default:
      return 'Information';
  }
}

describe('Event Level Mapping', () => {
  describe('by display name', () => {
    it('should map "Critical" to Critical', () => {
      expect(mapLevel(0, 'Critical')).toBe('Critical');
    });

    it('should map "Error" to Error', () => {
      expect(mapLevel(0, 'Error')).toBe('Error');
    });

    it('should map "Warning" to Warning', () => {
      expect(mapLevel(0, 'Warning')).toBe('Warning');
    });

    it('should map "Information" to Information', () => {
      expect(mapLevel(0, 'Information')).toBe('Information');
    });

    it('should map "Info" to Information', () => {
      expect(mapLevel(0, 'Info')).toBe('Information');
    });

    it('should map "Verbose" to Verbose', () => {
      expect(mapLevel(0, 'Verbose')).toBe('Verbose');
    });

    it('should be case-insensitive', () => {
      expect(mapLevel(0, 'ERROR')).toBe('Error');
      expect(mapLevel(0, 'warning')).toBe('Warning');
      expect(mapLevel(0, 'CRITICAL')).toBe('Critical');
    });
  });

  describe('by numeric level', () => {
    it('should map level 1 to Critical', () => {
      expect(mapLevel(1)).toBe('Critical');
    });

    it('should map level 2 to Error', () => {
      expect(mapLevel(2)).toBe('Error');
    });

    it('should map level 3 to Warning', () => {
      expect(mapLevel(3)).toBe('Warning');
    });

    it('should map level 4 to Information', () => {
      expect(mapLevel(4)).toBe('Information');
    });

    it('should map level 5 to Verbose', () => {
      expect(mapLevel(5)).toBe('Verbose');
    });

    it('should default unknown levels to Information', () => {
      expect(mapLevel(0)).toBe('Information');
      expect(mapLevel(6)).toBe('Information');
      expect(mapLevel(100)).toBe('Information');
    });
  });
});

describe('Event Record Schema', () => {
  it('should have all required fields', () => {
    const event: EventRecord = {
      recordId: 12345,
      eventId: 1000,
      level: 'Error',
      timeCreated: '2025-12-26T10:30:00.000Z',
      provider: 'Application Error',
      message: 'Test message',
      computer: 'TESTPC',
      channel: 'Application',
    };

    expect(event.recordId).toBe(12345);
    expect(event.eventId).toBe(1000);
    expect(event.level).toBe('Error');
    expect(event.timeCreated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(event.provider).toBe('Application Error');
    expect(event.message).toBe('Test message');
    expect(event.computer).toBe('TESTPC');
    expect(event.channel).toBe('Application');
  });

  it('should allow optional fields', () => {
    const event: EventRecord = {
      recordId: 12345,
      eventId: 1000,
      level: 'Error',
      timeCreated: '2025-12-26T10:30:00.000Z',
      provider: 'Application Error',
      message: 'Test message',
      computer: 'TESTPC',
      channel: 'Application',
      userId: 'S-1-5-21-123456789',
      task: 100,
      opcode: 0,
      keywords: 'Classic',
    };

    expect(event.userId).toBe('S-1-5-21-123456789');
    expect(event.task).toBe(100);
    expect(event.opcode).toBe(0);
    expect(event.keywords).toBe('Classic');
  });
});

describe('Crash Signal Patterns', () => {
  // These patterns are used by find_crash_signals
  const CRASH_PATTERNS = {
    ApplicationCrash: {
      providers: ['Application Error', 'Windows Error Reporting'],
      eventIds: [1000, 1001],
    },
    ApplicationHang: {
      providers: ['Application Hang'],
      eventIds: [1002],
    },
    SystemCrash: {
      providers: ['Microsoft-Windows-WER-SystemErrorReporting', 'BugCheck'],
      eventIds: [1001, 1],
    },
    ServiceFailure: {
      providers: ['Service Control Manager'],
      eventIds: [7031, 7034, 7024],
    },
    WHEA: {
      providers: ['Microsoft-Windows-WHEA-Logger'],
      eventIds: [17, 18, 19, 47],
    },
  };

  it('should detect Application Error events', () => {
    const event = { provider: 'Application Error', eventId: 1000 };
    const pattern = CRASH_PATTERNS.ApplicationCrash;
    const matches = pattern.providers.includes(event.provider) ||
                   pattern.eventIds.includes(event.eventId);
    expect(matches).toBe(true);
  });

  it('should detect Application Hang events', () => {
    const event = { provider: 'Application Hang', eventId: 1002 };
    const pattern = CRASH_PATTERNS.ApplicationHang;
    const matches = pattern.providers.includes(event.provider) ||
                   pattern.eventIds.includes(event.eventId);
    expect(matches).toBe(true);
  });

  it('should detect Service Control Manager failure events', () => {
    const event = { provider: 'Service Control Manager', eventId: 7034 };
    const pattern = CRASH_PATTERNS.ServiceFailure;
    const matches = pattern.providers.includes(event.provider) ||
                   pattern.eventIds.includes(event.eventId);
    expect(matches).toBe(true);
  });

  it('should detect WHEA hardware errors', () => {
    const event = { provider: 'Microsoft-Windows-WHEA-Logger', eventId: 17 };
    const pattern = CRASH_PATTERNS.WHEA;
    const matches = pattern.providers.includes(event.provider) ||
                   pattern.eventIds.includes(event.eventId);
    expect(matches).toBe(true);
  });

  it('should not match normal events', () => {
    const event = { provider: 'My Application', eventId: 100 };

    for (const pattern of Object.values(CRASH_PATTERNS)) {
      const providerMatch = pattern.providers.some(
        (p) => event.provider.toLowerCase().includes(p.toLowerCase())
      );
      const eventIdMatch = pattern.eventIds.includes(event.eventId);
      expect(providerMatch || eventIdMatch).toBe(false);
    }
  });
});

describe('Faulting Application Extraction', () => {
  it('should extract faulting application from message', () => {
    const message = `Faulting application name: notepad.exe, version: 10.0.22621.1
Faulting module name: ntdll.dll, version: 10.0.22621.1
Exception code: 0xc0000005`;

    const appMatch = message.match(/Faulting application name:\s*([^\r\n,]+)/i);
    expect(appMatch).not.toBeNull();
    expect(appMatch![1].trim()).toBe('notepad.exe');

    const moduleMatch = message.match(/Faulting module name:\s*([^\r\n,]+)/i);
    expect(moduleMatch).not.toBeNull();
    expect(moduleMatch![1].trim()).toBe('ntdll.dll');
  });

  it('should handle messages without faulting info', () => {
    const message = 'Service terminated unexpectedly.';

    const appMatch = message.match(/Faulting application name:\s*([^\r\n,]+)/i);
    expect(appMatch).toBeNull();
  });
});
