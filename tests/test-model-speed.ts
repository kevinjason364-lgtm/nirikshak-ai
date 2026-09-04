import fs from 'fs';
import path from 'path';

// Load .env.local
const envLocalPath = path.resolve(__dirname, '../.env.local');
let apiKey = '';
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'VISION_API_KEY') {
        apiKey = val;
      }
    }
  }
}

const modelsToTest = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3.5-flash'];

async function testModel(model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with a simple json: {"status": "ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const elapsed = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Model ${model}: Success (${elapsed}ms) -> ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
    } else {
      const err = await res.text();
      console.log(`✗ Model ${model}: HTTP ${res.status} (${elapsed}ms) -> ${err.substring(0, 150)}`);
    }
  } catch (e: any) {
    console.log(`✗ Model ${model}: Error -> ${e.message}`);
  }
}

async function main() {
  for (const m of modelsToTest) {
    await testModel(m);
  }
}

main().catch(console.error);
