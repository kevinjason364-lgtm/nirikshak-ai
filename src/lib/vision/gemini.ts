/**
 * Gemini Vision Provider — Nirikshak AI
 *
 * Implementation using Google Gemini API (gemini-1.5-flash or gemini-2.0-flash-exp).
 * Uses native fetch to avoid dependencies.
 * Free tier: 15 RPM, 1 million TPM, 1500 RPD for gemini-1.5-flash.
 */

import type { VisionProvider, VisionImageInput, VisionProviderResponse, VisionExtractionCandidate } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Extraction prompt for Gemini — strict factual extraction only
 */
const EXTRACTION_PROMPT = `You are an expert OCR and label information extraction assistant for Indian Legal Metrology (LMPC) compliance inspection.

**YOUR TASK:**
Extract ONLY factual visible text and information from the product label images provided (Front, Back, Side). You MUST:
1. Read ALL text visible on the label regardless of orientation, rotation, sideways panels, or vertical printing
2. Extract structured fields listed below from anywhere they appear across all provided images
3. Return ONLY factual information you can directly see — never guess, infer, or hallucinate
4. If a field is not visible or unreadable, leave it empty or null
5. Do NOT make legal determinations or compliance assessments

**CRITICAL EXTRACTION RULES:**
- Product Name: Extract from the largest/most prominent product title text on the front label (e.g., "GREEN TEA LEMON")
- Brand / Marketer Name: Extract the brand name (e.g., "Flipkart Supermart")
- Common / Generic Name: Extract if declared (e.g., "Flavoured Tea", "Green Tea")
- MRP: Extract the numerical MRP value as a number (e.g., 149.00 -> 149). Do not include currency symbols.
- Tax Inclusion: Set mrpInclusiveTaxes to true if phrases like "INCL. OF ALL TAXES", "INCLUSIVE OF TAXES", or "(INCL. TAX)" are present
- Net Quantity: Extract the numerical quantity (e.g., for "25 N Tea Bags" or "25 Tea Bags", netQuantity: 25, unit: "Tea Bags")
- Net Contents / Weight: If weight or count is present, normalize standard units (g, kg, ml, l, pcs, Tea Bags)
- Manufacturer: Extract the full company name (e.g., "ADITYA BIRLA GLOBAL TRADING (INDIA) PVT. LTD.") and full address as printed
- Importer / Marketer: Extract company name (e.g., "FLIPKART INDIA PRIVATE LIMITED") and full address
- Consumer Care Phone: Extract customer care telephone/helpline (e.g., "044-45614700" or toll free)
- Consumer Care Email: Extract customer care email address (e.g., "supermart-feedback@flipkart.com")
- Dates: Extract manufacture/packaging date and expiry/best before date (Month MM and Year YYYY)
- FSSAI License: Extract the 14-digit FSSAI license number(s) (e.g. starting with "100...")
- Batch / Lot / Barcode: Extract batch/lot number and barcode digits if visible

**OUTPUT FORMAT:**
Return a single valid JSON object with these fields (all optional, omit or set to null if not visible):
{
  "productName": "string",
  "commonGenericName": "string",
  "brand": "string",
  "mrp": number,
  "mrpInclusiveTaxes": boolean,
  "netQuantity": number,
  "unit": "string",
  "manufacturerName": "string",
  "manufacturerAddress": "string",
  "importerName": "string",
  "importerAddress": "string",
  "countryOfOrigin": "string",
  "manufactureMonth": "string (MM)",
  "manufactureYear": "string (YYYY)",
  "bestBeforeMonth": "string (MM)",
  "bestBeforeYear": "string (YYYY)",
  "consumerCareName": "string",
  "consumerCareAddress": "string",
  "consumerCarePhone": "string",
  "consumerCareEmail": "string",
  "batchLot": "string",
  "barcode": "string",
  "fssaiLicense": "string"
}

Now extract from the provided label images:`;

export class GeminiVisionProvider implements VisionProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    // Default to gemini-3.1-flash-lite (best balance of speed/accuracy/free-tier)
    // gemini-1.5-flash is no longer supported on v1beta
    this.model = model || 'gemini-3.1-flash-lite';
  }

  async extract(images: VisionImageInput[]): Promise<VisionProviderResponse> {
    try {
      console.log('[Gemini Vision] Starting extraction...');
      console.log('[Gemini Vision] Model:', this.model);
      console.log('[Gemini Vision] Images:', images.length);

      // Build request payload
      const parts: any[] = [
        { text: EXTRACTION_PROMPT }
      ];

      // Add images
      for (const img of images) {
        // Extract base64 data and mime type
        const matches = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn('[Gemini Vision] Invalid data URL format for:', img.label);
          continue;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        parts.push({
          text: `\n\n=== ${img.label.toUpperCase()} LABEL ===`
        });

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      // Call Gemini API (with retry for 503)
      const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      };

      let response: Response | null = null;
      let retries = 0;
      const MAX_RETRIES = 1;

      while (retries <= MAX_RETRIES) {
        console.log(`[Gemini Vision] Calling API (attempt ${retries + 1})...`);
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(25000),
        });

        if (response.ok) break;

        // Don't retry on 429 (Rate Limit) or 400 (Bad Request)
        if (response.status === 429 || response.status === 400 || response.status !== 503) break;
        if (retries === MAX_RETRIES) break;

        retries++;
        console.warn(`[Gemini Vision] API 503, retrying in 1000ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'No response received';
        const status = response ? response.status : 500;
        console.error('[Gemini Vision] API error:', status, errorText);

        // Check for specific api errors
        let errorMsg = `Gemini API error ${status}`;
        if (status === 429 || errorText.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = 'Vision AI rate limit reached. Please try again in a moment or use OCR fallback.';
        } else if (status === 503) {
          errorMsg = 'Vision AI service is temporarily overloaded. Falling back to OCR.';
        } else {
          errorMsg = `Gemini API error: ${status} ${errorText.substring(0, 100)}`;
        }

        return {
          success: false,
          candidate: {},
          confidence: {},
          error: errorMsg,
          isRateLimit: status === 429,
        };
      }

      const data = await response.json();
      console.log('[Gemini Vision] API response received');

      // Extract text from response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('No content parts in Gemini response');
      }

      const textResponse = content.parts[0].text;
      console.log('[Gemini Vision] Raw response:', textResponse.substring(0, 200));

      // Parse JSON response
      let parsed: VisionExtractionCandidate;
      try {
        let cleaned = textResponse;

        // 1. Try to find JSON inside markdown blocks
        const jsonBlockMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonBlockMatch) {
            cleaned = jsonBlockMatch[1];
        } else {
            // 2. Try to find curly braces
            const braceMatch = textResponse.match(/\{[\s\S]*\}/);
            if (braceMatch) {
                cleaned = braceMatch[0];
            }
        }

        // Cleanup trailing commas which break JSON.parse
        cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1').trim();

        parsed = JSON.parse(cleaned);
      } catch (parseError: any) {
        console.error('[Gemini Vision] JSON parse error:', parseError, 'Raw response string snippet:', textResponse.substring(0, 150));

        return {
          success: false,
          candidate: {},
          confidence: {},
          error: `Failed to parse Vision AI JSON: ${parseError.message}`,
        };
      }

      console.log('[Gemini Vision] Extracted fields:', Object.keys(parsed).filter(k => parsed[k as keyof VisionExtractionCandidate]));

      // Calculate confidence scores (Gemini doesn't provide per-field confidence, use heuristics)
      const confidence: Record<string, number> = {};
      for (const key of Object.keys(parsed) as Array<keyof VisionExtractionCandidate>) {
        const value = parsed[key];
        if (value !== null && value !== undefined && value !== '') {
          // Base confidence on field type and completeness
          if (typeof value === 'number') {
            confidence[key] = 85; // Numbers are usually reliable
          } else if (typeof value === 'boolean') {
            confidence[key] = 80; // Booleans from detection
          } else if (typeof value === 'string') {
            const len = value.length;
            // Longer strings with multiple words are more reliable
            if (len > 20 && value.includes(' ')) {
              confidence[key] = 82;
            } else if (len > 10) {
              confidence[key] = 78;
            } else {
              confidence[key] = 75;
            }
          }
        }
      }

      return {
        success: true,
        candidate: parsed,
        confidence,
        rawResponse: data,
      };

    } catch (error: any) {
      console.error('[Gemini Vision] Extraction failed:', error);
      return {
        success: false,
        candidate: {},
        confidence: {},
        error: error?.message || String(error),
      };
    }
  }
}
