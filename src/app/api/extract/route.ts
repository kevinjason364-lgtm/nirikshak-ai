/**
 * Vision AI Extraction API Route — Nirikshak AI
 *
 * POST /api/extract
 *
 * Handles server-side Vision AI extraction with secure API key management.
 * Receives base64 images from client, sends to Vision AI, returns structured extraction.
 *
 * Request body: { images: Array<{dataUrl: string, label: 'front'|'back'|'side'}> }
 * Response: { success: boolean, extraction?: VisionExtractionResult, error?: string, fallback?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVisionProvider, isVisionAIAvailable } from '@/lib/vision/provider';
import type { VisionImageInput } from '@/lib/vision/types';

export const runtime = 'nodejs'; // Use Node.js runtime for fetch support

/**
 * Validate request payload
 */
function validateRequest(body: any): { valid: boolean; error?: string; images?: VisionImageInput[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be JSON object' };
  }

  if (!Array.isArray(body.images)) {
    return { valid: false, error: 'Missing images array' };
  }

  if (body.images.length === 0) {
    return { valid: false, error: 'At least one image required' };
  }

  if (body.images.length > 10) {
    return { valid: false, error: 'Maximum 10 images allowed' };
  }

  const images: VisionImageInput[] = [];

  for (const img of body.images) {
    if (!img.dataUrl || typeof img.dataUrl !== 'string') {
      return { valid: false, error: 'Each image must have dataUrl' };
    }

    if (!img.dataUrl.startsWith('data:image/')) {
      return { valid: false, error: 'Invalid image dataUrl format' };
    }

    // Rough size check (base64 typically ~33% larger than original)
    const estimatedSize = img.dataUrl.length * 0.75;
    const maxSize = 5 * 1024 * 1024; // 5 MB max per image
    if (estimatedSize > maxSize) {
      return { valid: false, error: `Image too large: ${(estimatedSize / 1024 / 1024).toFixed(1)} MB (max 5 MB)` };
    }

    images.push({
      dataUrl: img.dataUrl,
      label: typeof img.label === 'string' ? img.label : undefined,
    });
  }

  return { valid: true, images };
}

export async function POST(request: NextRequest) {
  try {
    // Check if Vision AI is configured
    if (!isVisionAIAvailable()) {
      console.log('[Extract API] Vision AI not configured - environment variables missing');
      console.log('[Extract API] Expected: VISION_PROVIDER, VISION_API_KEY');
      console.log('[Extract API] Falling back to OCR-only mode');
      return NextResponse.json(
        {
          success: false,
          extraction: null,
          error: 'Vision AI is not configured. Please set VISION_PROVIDER and VISION_API_KEY environment variables.',
          fallback: true, // Signal client to use OCR-only
        },
        { status: 503 } // Service unavailable
      );
    }

    // Parse request
    const body = await request.json();
    console.log('[Extract API] Request received with', body.images?.length || 0, 'images');

    // Log image metadata (safe for diagnostics)
    if (body.images && Array.isArray(body.images)) {
      body.images.forEach((img: any, idx: number) => {
        const sizeKB = img.dataUrl ? Math.round(img.dataUrl.length * 0.75 / 1024) : 0;
        const mimeMatch = img.dataUrl?.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
        console.log(`[Extract API] Image ${idx + 1}: label=${img.label}, mime=${mimeType}, size=${sizeKB}KB`);
      });
    }

    // Validate
    const validation = validateRequest(body);
    if (!validation.valid) {
      console.warn('[Extract API] Validation error:', validation.error);
      return NextResponse.json(
        {
          success: false,
          extraction: null,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Get Vision AI provider
    const provider = getVisionProvider();
    if (!provider) {
      console.warn('[Extract API] Failed to load Vision AI provider');
      return NextResponse.json(
        {
          success: false,
          extraction: null,
          error: 'Failed to initialize Vision AI provider',
          fallback: true,
        },
        { status: 503 }
      );
    }

    // Run extraction
    console.log('[Extract API] Running Vision AI extraction...');
    const result = await provider.extract(validation.images!);

    if (!result.success) {
      console.warn('[Extract API] Extraction result indicates failure:', result.error);

      const isRateLimit = result.error?.includes('rate limit') || result.error?.includes('429');
      const statusCode = isRateLimit ? 429 : 500;

      return NextResponse.json(
        {
          success: false,
          extraction: null,
          error: result.error || 'Vision AI extraction failed',
          fallback: true,
          rawResponse: result.rawResponse,
          isRateLimit,
        },
        { status: statusCode }
      );
    }

    const extractedFields = Object.keys(result.candidate).filter(k => {
      const val = result.candidate[k as keyof typeof result.candidate];
      return val !== null && val !== undefined && val !== '';
    });

    console.log('[Extract API] Extraction successful');
    console.log('[Extract API] Fields extracted:', extractedFields.length, '→', extractedFields.join(', '));
    console.log('[Extract API] Candidate summary:', JSON.stringify(result.candidate).substring(0, 200));

    return NextResponse.json(
      {
        success: true,
        extraction: {
          candidate: result.candidate,
          confidence: result.confidence,
          rawResponse: result.rawResponse, // Include for development diagnostics
        },
        error: null,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Extract API] Unexpected error:', error);

    // Check for rate limit or quota errors
    const isRateLimit = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    const statusCode = isRateLimit ? 429 : 500;

    return NextResponse.json(
      {
        success: false,
        extraction: null,
        error: error?.message || 'Internal server error',
        fallback: true, // Always allow fallback on error
        isRateLimit, // Signal rate limiting to client
      },
      { status: statusCode }
    );
  }
}

export async function GET() {
  const available = isVisionAIAvailable();
  return NextResponse.json(
    {
      available,
      provider: available ? (process.env.VISION_PROVIDER || 'gemini') : null,
    },
    { status: 200 }
  );
}
