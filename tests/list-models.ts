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

async function check() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log('Available models for generateContent:');
    data.models
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .forEach((m: any) => console.log(`- ${m.name} (${m.displayName})`));
  } else {
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
