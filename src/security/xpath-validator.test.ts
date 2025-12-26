/**
 * Unit tests for XPath Validator
 */

import { describe, it, expect } from 'vitest';
import {
  validateXPath,
  buildTimeRangeXPath,
  XPathValidationError,
  XPathComplexityError,
} from './xpath-validator.js';
import { DEFAULT_CONFIG } from '../types.js';

describe('XPath Validator', () => {
  describe('validateXPath - allowed expressions', () => {
    it('should allow empty/null XPath (no filter)', () => {
      expect(validateXPath(null)).toBeUndefined();
      expect(validateXPath(undefined)).toBeUndefined();
      expect(validateXPath('')).toBeUndefined();
      expect(validateXPath('   ')).toBeUndefined();
    });

    it('should allow simple EventID filter', () => {
      const xpath = '*[System[EventID=1000]]';
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow Level filter', () => {
      const xpath = '*[System[Level=2]]';
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow TimeCreated filter', () => {
      const xpath = "*[System[TimeCreated[@SystemTime>='2025-01-01T00:00:00Z']]]";
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow Provider filter', () => {
      const xpath = "*[System[Provider[@Name='Application Error']]]";
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow AND expression', () => {
      const xpath = '*[System[EventID=1000 and Level=2]]';
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow OR expression', () => {
      const xpath = '*[System[EventID=1000 or EventID=1001]]';
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow complex valid filter', () => {
      const xpath = "*[System[(EventID=1000 or EventID=1001) and Level>=2 and Provider[@Name='MyApp']]]";
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should allow comparison operators', () => {
      expect(validateXPath('*[System[Level=2]]')).toBeDefined();
      expect(validateXPath('*[System[Level!=2]]')).toBeDefined();
      expect(validateXPath('*[System[Level>2]]')).toBeDefined();
      expect(validateXPath('*[System[Level<2]]')).toBeDefined();
      expect(validateXPath('*[System[Level>=2]]')).toBeDefined();
      expect(validateXPath('*[System[Level<=2]]')).toBeDefined();
    });
  });

  describe('validateXPath - blocked patterns', () => {
    it('should block document() function (XXE)', () => {
      expect(() => validateXPath("document('evil.xml')")).toThrow(XPathValidationError);
      expect(() => validateXPath("document ( 'evil.xml' )")).toThrow(XPathValidationError);
    });

    it('should block concat() function', () => {
      expect(() => validateXPath("concat('a', 'b')")).toThrow(XPathValidationError);
    });

    it('should block string() function', () => {
      expect(() => validateXPath("string(//node)")).toThrow(XPathValidationError);
    });

    it('should block substring() function', () => {
      expect(() => validateXPath("substring('test', 1, 2)")).toThrow(XPathValidationError);
    });

    it('should block contains() function', () => {
      expect(() => validateXPath("*[contains(Message, 'error')]")).toThrow(XPathValidationError);
    });

    it('should block starts-with() function', () => {
      expect(() => validateXPath("*[starts-with(Message, 'Error')]")).toThrow(XPathValidationError);
    });

    it('should block variable references', () => {
      expect(() => validateXPath('*[System[EventID=$var]]')).toThrow(XPathValidationError);
      expect(() => validateXPath('*[System[EventID=$eventId]]')).toThrow(XPathValidationError);
    });

    it('should block namespace axis', () => {
      expect(() => validateXPath('namespace::*')).toThrow(XPathValidationError);
    });

    it('should block parent axis (..)', () => {
      expect(() => validateXPath('../Security')).toThrow(XPathValidationError);
      expect(() => validateXPath('*[../System]')).toThrow(XPathValidationError);
    });

    it('should block preceding axis', () => {
      expect(() => validateXPath('preceding::node')).toThrow(XPathValidationError);
    });

    it('should block following axis', () => {
      expect(() => validateXPath('following::node')).toThrow(XPathValidationError);
    });

    it('should block ancestor axis', () => {
      expect(() => validateXPath('ancestor::node')).toThrow(XPathValidationError);
    });

    it('should block descendant axis', () => {
      expect(() => validateXPath('descendant::node')).toThrow(XPathValidationError);
    });

    it('should block comment() node test', () => {
      expect(() => validateXPath('comment()')).toThrow(XPathValidationError);
    });

    it('should block processing-instruction() node test', () => {
      expect(() => validateXPath('processing-instruction()')).toThrow(XPathValidationError);
    });

    it('should block text() node test', () => {
      expect(() => validateXPath('text()')).toThrow(XPathValidationError);
    });

    it('should block boolean functions', () => {
      expect(() => validateXPath('true()')).toThrow(XPathValidationError);
      expect(() => validateXPath('false()')).toThrow(XPathValidationError);
      expect(() => validateXPath('not(//node)')).toThrow(XPathValidationError);
      expect(() => validateXPath('boolean(1)')).toThrow(XPathValidationError);
    });

    it('should block number functions', () => {
      expect(() => validateXPath('number("123")')).toThrow(XPathValidationError);
      expect(() => validateXPath('floor(1.5)')).toThrow(XPathValidationError);
      expect(() => validateXPath('ceiling(1.5)')).toThrow(XPathValidationError);
      expect(() => validateXPath('round(1.5)')).toThrow(XPathValidationError);
      expect(() => validateXPath('sum(//value)')).toThrow(XPathValidationError);
    });

    it('should block count() function', () => {
      expect(() => validateXPath('count(//node)')).toThrow(XPathValidationError);
    });

    it('should block id() function', () => {
      expect(() => validateXPath("id('myid')")).toThrow(XPathValidationError);
    });

    it('should block name functions', () => {
      expect(() => validateXPath('name(//node)')).toThrow(XPathValidationError);
      expect(() => validateXPath('local-name(//node)')).toThrow(XPathValidationError);
      expect(() => validateXPath('namespace-uri(//node)')).toThrow(XPathValidationError);
    });
  });

  describe('validateXPath - complexity limits', () => {
    it('should reject XPath exceeding max length', () => {
      const longXPath = '*[System[EventID=' + '1'.repeat(600) + ']]';
      expect(() => validateXPath(longXPath)).toThrow(XPathComplexityError);
    });

    it('should reject XPath exceeding max nesting depth', () => {
      const deepXPath = '*[a[b[c[d[e[f[g]]]]]]]';  // 7 levels deep
      expect(() => validateXPath(deepXPath)).toThrow(XPathComplexityError);
    });

    it('should allow XPath at max nesting depth', () => {
      const xpath = '*[a[b[c[d[e]]]]]';  // 5 levels, should be allowed
      expect(validateXPath(xpath)).toBe(xpath);
    });

    it('should reject XPath with too many predicates', () => {
      const manyPredicates = '*[a][b][c][d][e][f][g][h][i][j][k][l]';  // 12 predicates
      expect(() => validateXPath(manyPredicates)).toThrow(XPathComplexityError);
    });

    it('should allow XPath at max predicate count', () => {
      const xpath = '*[a][b][c][d][e][f][g][h][i][j]';  // 10 predicates
      expect(validateXPath(xpath)).toBe(xpath);
    });
  });

  describe('validateXPath - structure validation', () => {
    it('should reject unbalanced brackets - missing close', () => {
      expect(() => validateXPath('*[System[EventID=1000]')).toThrow(XPathValidationError);
    });

    it('should reject unbalanced brackets - extra close', () => {
      expect(() => validateXPath('*[System[EventID=1000]]]')).toThrow(XPathValidationError);
    });

    it('should reject non-string input', () => {
      expect(() => validateXPath(123 as unknown as string)).toThrow(XPathValidationError);
      expect(() => validateXPath({ xpath: '*' } as unknown as string)).toThrow(XPathValidationError);
    });
  });

  describe('validateXPath - injection attempts', () => {
    it('should block predicate injection via quotes', () => {
      // Attempt: '][malicious][ injection
      expect(() => validateXPath("*[System[EventID='1000'][x='y']")).toThrow(XPathValidationError);
    });

    it('should block SQL-style comments', () => {
      expect(() => validateXPath('*[System[EventID=1000--comment]]')).toThrow(XPathValidationError);
    });

    it('should block C-style comments', () => {
      expect(() => validateXPath('*[System[EventID=1000/*comment*/]]')).toThrow(XPathValidationError);
    });
  });

  describe('validateXPath - error details', () => {
    it('should include error code', () => {
      try {
        validateXPath("document('evil.xml')");
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(XPathValidationError);
        expect((err as XPathValidationError).code).toBe('XPATH_INVALID');
      }
    });

    it('should include details for blocked patterns', () => {
      try {
        validateXPath("document('evil.xml')");
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(XPathValidationError);
        expect((err as XPathValidationError).details.length).toBeGreaterThan(0);
      }
    });

    it('should include complexity error code', () => {
      try {
        const longXPath = '*' + '[a'.repeat(100) + ']'.repeat(100);
        validateXPath(longXPath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(XPathComplexityError);
        expect((err as XPathComplexityError).code).toBe('XPATH_TOO_COMPLEX');
      }
    });
  });

  describe('buildTimeRangeXPath', () => {
    it('should return undefined for no time range', () => {
      expect(buildTimeRangeXPath()).toBeUndefined();
      expect(buildTimeRangeXPath(undefined, undefined)).toBeUndefined();
    });

    it('should build filter for startTime only', () => {
      const xpath = buildTimeRangeXPath('2025-01-01T00:00:00Z');
      expect(xpath).toContain("TimeCreated[@SystemTime>='2025-01-01T00:00:00Z']");
    });

    it('should build filter for endTime only', () => {
      const xpath = buildTimeRangeXPath(undefined, '2025-12-31T23:59:59Z');
      expect(xpath).toContain("TimeCreated[@SystemTime<='2025-12-31T23:59:59Z']");
    });

    it('should build filter for both times', () => {
      const xpath = buildTimeRangeXPath('2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z');
      expect(xpath).toContain('>');
      expect(xpath).toContain('<');
    });

    it('should reject invalid startTime format', () => {
      expect(() => buildTimeRangeXPath('invalid-date')).toThrow(XPathValidationError);
    });

    it('should reject invalid endTime format', () => {
      expect(() => buildTimeRangeXPath(undefined, 'invalid-date')).toThrow(XPathValidationError);
    });
  });
});
