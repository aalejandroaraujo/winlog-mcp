/**
 * Channel Guard - Enforces channel allowlist
 *
 * Security-critical: This module prevents access to unauthorized event log channels.
 * The allowlist is hardcoded and cannot be modified at runtime.
 */

import { ALLOWED_CHANNELS, type AllowedChannel } from '../types.js';

/** Error thrown when accessing a blocked channel */
export class ChannelNotAllowedError extends Error {
  public readonly code = 'CHANNEL_NOT_ALLOWED';
  public readonly allowedChannels = [...ALLOWED_CHANNELS];

  constructor(channel: string) {
    super(`Channel '${channel}' is not in the allowed list. Allowed: ${ALLOWED_CHANNELS.join(', ')}`);
    this.name = 'ChannelNotAllowedError';
  }
}

/**
 * Validates that a channel name is in the allowlist.
 *
 * Security properties:
 * - Case-sensitive exact match
 * - No normalization or trimming (to prevent bypass)
 * - Rejects null, undefined, and empty strings
 *
 * @param channel - The channel name to validate
 * @returns The validated channel name (type-narrowed to AllowedChannel)
 * @throws ChannelNotAllowedError if the channel is not allowed
 */
export function validateChannel(channel: unknown): AllowedChannel {
  // Reject non-string inputs
  if (typeof channel !== 'string') {
    throw new ChannelNotAllowedError(String(channel));
  }

  // Reject empty strings
  if (channel.length === 0) {
    throw new ChannelNotAllowedError('(empty)');
  }

  // Exact match against allowlist - no normalization to prevent bypass
  if (!ALLOWED_CHANNELS.includes(channel as AllowedChannel)) {
    throw new ChannelNotAllowedError(channel);
  }

  return channel as AllowedChannel;
}

/**
 * Checks if a channel is allowed without throwing.
 *
 * @param channel - The channel name to check
 * @returns true if allowed, false otherwise
 */
export function isChannelAllowed(channel: unknown): channel is AllowedChannel {
  return typeof channel === 'string' && ALLOWED_CHANNELS.includes(channel as AllowedChannel);
}

/**
 * Returns a copy of the allowed channels list.
 */
export function getAllowedChannels(): readonly string[] {
  return [...ALLOWED_CHANNELS];
}
