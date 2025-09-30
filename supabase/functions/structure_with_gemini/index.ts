// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// --- Prompt pieces ---
const SYSTEM_PREFACE = `You are a strict financial transaction extractor. 
Input is OCR text from a single transaction, receipt line, or statement row. 
Output ONLY minified JSON matching the schema exactly. No extra text.
If a field is unknown, use null. Dates must be YYYY-MM-DD.
type is "in" (money received) or "out" (money spent).
category is one of: ["shopping","rent","utility","grocery","dining","transportation","entertainment","health","income","fees","transfers","education","other"].
sub_category is the merchant/vendor short name if available (e.g., "walmart","freshco","tim hortons"). Lowercase.
amount is a positive number (e.g., 12.34). If multiple amounts, choose the payable TOTAL; if a bank line, choose the transaction amount for that entry.
note is a short free-text note like "conversion fee", "foreign transaction", or null.

SCHEMA:
{"date":"YYYY-MM-DD|null","type":"in|out","category":"shopping|rent|utility|grocery|dining|transportation|entertainment|health|income|fees|transfers|education|other","sub_category":"string|null","amount":0.00,"note":"string|null"}`;

const FEW_SHOTS = `Example 1:
OCR_TEXT:
"2025-08-14 13:05 Walmart Supercenter #1234  Debit Card  $45.67  Subtotal 42.00  Tax 3.67  Thank you"
{"date":"2025-08-14","type":"out","category":"grocery","sub_category":"walmart","amount":45.67,"note":null}

Example 2:
OCR_TEXT:
"TIM HORTONS 09/02/2025 POS PURCHASE -$3.05"
{"date":"2025-09-02","type":"out","category":"dining","sub_category":"tim hortons","amount":3.05,"note":null}

Example 3:
OCR_TEXT:
"PAYROLL DEPOSIT 2025-09-15 +$2,450.00"
{"date":"2025-09-15","type":"in","category":"income","sub_category":null,"amount":2450.00,"note":null}

Example 4:
OCR_TEXT:
"VISA FX CONVERSION FEE 2025/09/10  $1.23"
{"date":"2025-09-10","type":"out","category":"fees","sub_category":null,"amount":1.23,"note":"conversion fee"}`;

function userPrompt(ocrText: string) {
  return `OCR_TEXT:
"""
${ocrText}
"""

Return ONLY valid JSON per schema.`;
}

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const body = {
    contents: [
      { role: "user", parts: [{ text: SYSTEM_PREFACE }] },
      { role: "user", parts: [{ text: FEW_SHOTS }] },
      { role: "user", parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 256
    }
  };

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errorText}`);
  }

  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim();
}

// Extract the first JSON object from a model response safely
function extractJson(s: string) {
  const m = s.match(/\{[\s\S]*\}$/); // greedy to last }
  if (!m) throw new Error("No JSON found in response");
  try { 
    return JSON.parse(m[0]); 
  } catch { 
    throw new Error("Invalid JSON in response"); 
  }
}

// Basic schema validation
function validate(rec: any) {
  const cats = ["shopping","rent","utility","grocery","dining","transportation","entertainment","health","income","fees","transfers","education","other"];
  
  if (!rec || typeof rec !== "object") throw new Error("Invalid record structure");
  if (!["in","out"].includes(rec.type)) throw new Error("Invalid type - must be 'in' or 'out'");
  if (!cats.includes(rec.category)) throw new Error("Invalid category");
  if (typeof rec.amount !== "number" || rec.amount < 0) throw new Error("Invalid amount - must be positive number");
  if (rec.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) throw new Error("Invalid date format - must be YYYY-MM-DD");
  if (rec.sub_category !== null && typeof rec.sub_category !== "string") throw new Error("Invalid sub_category");
  if (rec.note !== null && typeof rec.note !== "string") throw new Error("Invalid note");
  
  // normalize sub_category to lowercase short token
  if (typeof rec.sub_category === "string") {
    rec.sub_category = rec.sub_category.toLowerCase().slice(0, 60);
  }
  
  return rec;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response('Missing Authorization header', { status: 401, headers: corsHeaders });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON in request body" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    const { ocrText } = requestBody;
    if (!ocrText || typeof ocrText !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "ocrText required as string" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    console.log('Processing OCR text with Gemini:', ocrText.substring(0, 100) + '...');

    const resp = await callGemini(userPrompt(ocrText));
    console.log('Gemini response:', resp);

    const json = validate(extractJson(resp));
    console.log('Validated record:', json);

    return new Response(
      JSON.stringify({ ok: true, record: json }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );

  } catch (error) {
    console.error('Structure extraction error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
});