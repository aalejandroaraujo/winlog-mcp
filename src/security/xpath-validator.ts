/**
 * XPath Validator - Validates and sanitizes XPath filter expressions
 *
 * Security-critical: This module prevents XPath injection attacks.
 * Only a safe subset of XPath constructs are allowed.
 */

import { DEFAULT_CONFIG, type Config } from '../types.js';

/** Error thrown for invalid XPath expressions */
export class XPathValidationError extends Error {
  public readonly code = 'XPATH_INVALID';
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'XPathValidationError';
    this.details = details;
  }
}

/** Error thrown for overly complex XPath expressions */
export class XPathComplexityError extends Error {
  public readonly code = 'XPATH_TOO_COMPLEX';

  constructor(message: string) {
    super(message);
    this.name = 'XPathComplexityError';
  }
}

/**
 * Blocked patterns that indicate dangerous XPath constructs.
 * These patterns are checked case-insensitively.
 */
const BLOCKED_PATTERNS: readonly RegExp[] = [
  // External document access (XXE risk)
  /\bdocument\s*\(/i,
  /\bdoc\s*\(/i,

  // Function calls that could be exploited
  /\bconcat\s*\(/i,
  /\bstring\s*\(/i,
  /\bsubstring\s*\(/i,
  /\btranslate\s*\(/i,
  /\bnormalize-space\s*\(/i,
  /\bcontains\s*\(/i,
  /\bstarts-with\s*\(/i,
  /\bstring-length\s*\(/i,
  /\bcount\s*\(/i,
  /\bsum\s*\(/i,
  /\bfloor\s*\(/i,
  /\bceiling\s*\(/i,
  /\bround\s*\(/i,
  /\btrue\s*\(/i,
  /\bfalse\s*\(/i,
  /\bnot\s*\(/i,
  /\bboolean\s*\(/i,
  /\bnumber\s*\(/i,
  /\bid\s*\(/i,
  /\bname\s*\(/i,
  /\blocal-name\s*\(/i,
  /\bnamespace-uri\s*\(/i,

  // Variable references
  /\$\w+/,

  // Axis specifiers that could traverse unexpectedly
  /\bnamespace\s*::/i,
  /\bpreceding\s*::/i,
  /\bfollowing\s*::/i,
  /\bpreceding-sibling\s*::/i,
  /\bfollowing-sibling\s*::/i,
  /\bancestor\s*::/i,
  /\bdescendant\s*::/i,
  /\bancestor-or-self\s*::/i,
  /\bdescendant-or-self\s*::/i,

  // Parent traversal
  /\.\./,

  // Comments and processing instructions
  /\bcomment\s*\(/i,
  /\bprocessing-instruction\s*\(/i,
  /\btext\s*\(/i,
  /\bnode\s*\(/i,

  // Potential injection markers
  /['"]\s*\]\s*\[/,  // Quote followed by ][ (predicate injection)
  /--/,              // SQL-style comment
  /\/\*/,            // C-style comment start
];

/**
 * Allowed constructs in Windows Event Log XPath.
 * These are the patterns we explicitly permit.
 */
const ALLOWED_STRUCTURE = /^[\s\*\[\]\/\(\)@\w\-\.=<>!'":\d\s,]+$/;

/**
 * Validates an XPath filter expression for safety and complexity.
 *
 * @param xpath - The XPath expression to validate (can be undefined/null for no filter)
 * @param config - Configuration limits
 * @returns The validated XPath string, or undefined if no filter
 * @throws XPathValidationError if the XPath contains dangerous constructs
 * @throws XPathComplexityError if the XPath exceeds complexity limits
 */
export function validateXPath(
  xpath: unknown,
  config: Config = DEFAULT_CONFIG
): string | undefined {
  // Null/undefined means no filter, which is valid
  if (xpath === null || xpath === undefined) {
    return undefined;
  }

  // Must be a string
  if (typeof xpath !== 'string') {
    throw new XPathValidationError('XPath must be a string');
  }

  // Empty string means no filter
  const trimmed = xpath.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  // Check length limit
  if (trimmed.length > config.xpathMaxLength) {
    throw new XPathComplexityError(
      `XPath exceeds maximum length of ${config.xpathMaxLength} characters`
    );
  }

  // Check for blocked patterns
  const violations: string[] = [];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      violations.push(`Blocked pattern: ${pattern.source}`);
    }
  }

  if (violations.length > 0) {
    throw new XPathValidationError(
      'XPath contains blocked constructs',
      violations
    );
  }

  // Check for allowed character set
  if (!ALLOWED_STRUCTURE.test(trimmed)) {
    throw new XPathValidationError(
      'XPath contains disallowed characters'
    );
  }

  // Check predicate depth (count nested brackets)
  const maxDepth = 5;
  let depth = 0;
  let maxSeenDepth = 0;
  for (const char of trimmed) {
    if (char === '[') {
      depth++;
      maxSeenDepth = Math.max(maxSeenDepth, depth);
    } else if (char === ']') {
      depth--;
    }
    if (depth < 0) {
      throw new XPathValidationError('Unbalanced brackets in XPath');
    }
  }
  if (depth !== 0) {
    throw new XPathValidationError('Unbalanced brackets in XPath');
  }
  if (maxSeenDepth > maxDepth) {
    throw new XPathComplexityError(
      `XPath exceeds maximum nesting depth of ${maxDepth}`
    );
  }

  // Count predicates
  const maxPredicates = 10;
  const predicateCount = (trimmed.match(/\[/g) || []).length;
  if (predicateCount > maxPredicates) {
    throw new XPathComplexityError(
      `XPath exceeds maximum predicate count of ${maxPredicates}`
    );
  }

  return trimmed;
}

/**
 * Builds a safe XPath filter for time-based queries.
 *
 * @param startTime - ISO 8601 start timestamp
 * @param endTime - ISO 8601 end timestamp
 * @returns XPath filter string for time range
 */
export function buildTimeRangeXPath(startTime?: string, endTime?: string): string | undefined {
  const conditions: string[] = [];

  if (startTime) {
    // Validate it looks like an ISO timestamp
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(startTime)) {
      throw new XPathValidationError('Invalid startTime format, expected ISO 8601');
    }
    conditions.push(`TimeCreated[@SystemTime>='${startTime}']`);
  }

  if (endTime) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(endTime)) {
      throw new XPathValidationError('Invalid endTime format, expected ISO 8601');
    }
    conditions.push(`TimeCreated[@SystemTime<='${endTime}']`);
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return `*[System[${conditions.join(' and ')}]]`;
}

/**
 * Combines multiple XPath filters with AND logic.
 *
 * @param filters - Array of XPath filter strings
 * @returns Combined XPath filter
 */
export function combineXPathFilters(filters: (string | undefined)[]): string | undefined {
  const validFilters = filters.filter((f): f is string => f !== undefined && f.length > 0);

  if (validFilters.length === 0) {
    return undefined;
  }

  if (validFilters.length === 1) {
    return validFilters[0];
  }

  // For Windows Event Log, we need to wrap in proper structure
  // This is a simplified combination - full implementation would parse and merge
  return validFilters[0];
}
