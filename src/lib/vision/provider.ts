/**
 * Vision Provider Factory — Nirikshak AI
 *
 * Factory for creating Vision AI providers based on configuration.
 * Supports modular provider switching via environment variables.
 */

import type { VisionProvider } from './types';

/**
 * Get the configured Vision AI provider
 *
 * Reads VISION_PROVIDER and VISION_MODEL from server-side environment.
 * Returns null if Vision AI is not configured (graceful fallback to OCR-only mode).
 */
export function getVisionProvider(): VisionProvider | null {
  // This is imported server-side only, environment variables are safe here
  const provider = process.env.VISION_PROVIDER;
  const model = process.env.VISION_MODEL;
  const apiKey = process.env.VISION_API_KEY;

  // If no provider configured, return null (Vision AI disabled)
  if (!provider || !apiKey) {
    return null;
  }

  // Load the appropriate provider
  switch (provider.toLowerCase()) {
    case 'gemini':
      // Lazy load to avoid bundling unused providers
      const { GeminiVisionProvider } = require('./gemini');
      return new GeminiVisionProvider(apiKey, model);

    default:
      console.warn(`[Vision Provider] Unknown provider: ${provider}. Vision AI disabled.`);
      return null;
  }
}

/**
 * Check if Vision AI is available
 */
export function isVisionAIAvailable(): boolean {
  return !!(process.env.VISION_PROVIDER && process.env.VISION_API_KEY);
}
