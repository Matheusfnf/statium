import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = (context: string) => `
Você é um assistente especializado em análise de dados agrícolas/experimentais. 
Analise a tabela de dados abaixo e retorne um JSON estruturado.

Contexto: ${context}

RETORNE SOMENTE o JSON, sem texto adicional, sem blocos markdown:

{
  "isFatorial": boolean,
  "qualiFactorName": "nome do fator qualitativo (ou null)",
  "responseName": "nome da variável resposta",
  "rows": [
    {
      "dose": "valor numérico",
      "level": "nome do nível qualitativo (ou null)",
      "reps": ["valor1", "valor2", "valor3", "valor4"]
    }
  ]
}

REGRAS:
- Cada combinação dose+nível = uma linha em "rows".
- "level" = null e "isFatorial" = false se não houver fator qualitativo.
- "reps" = APENAS valores numéricos da variável resposta (não inclua colunas de bloco/índice).
- Se cada linha da planilha for uma observação individual, agrupe por dose+nível e coloque como reps.
- Decimais com ponto (não vírgula).
`;

async function tryGemini(apiKey: string, csvText: string, context: string) {
  const models = ['gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-1.5-pro-latest'];
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT(context)}\n\nDADOS:\n\`\`\`\n${csvText}\n\`\`\`` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (res.status === 404 || res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`Gemini ${model}: ${res.status}`);
    
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) continue;
    return { text, model: `gemini/${model}` };
  }
  return null;
}

async function tryGroq(apiKey: string, csvText: string, context: string) {
  const models = ['llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'];

  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(context) },
          { role: 'user', content: `Analise estes dados e retorne o JSON:\n\`\`\`\n${csvText}\n\`\`\`` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
    
    if (res.status === 404 || res.status === 429) continue;
    if (!res.ok) throw new Error(`Groq ${model}: ${res.status}`);
    
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) continue;
    return { text, model: `groq/${model}` };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    return NextResponse.json({ 
      error: 'Nenhuma chave de IA configurada. Configure GEMINI_API_KEY ou GROQ_API_KEY no .env.local' 
    }, { status: 500 });
  }

  const { csvText, context } = await req.json();
  if (!csvText) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });

  let result: { text: string; model: string } | null = null;
  const errors: string[] = [];

  // Try Gemini first
  if (geminiKey) {
    try {
      result = await tryGemini(geminiKey, csvText, context || 'Experimento agrícola com regressão polinomial');
    } catch (e: any) {
      errors.push(`Gemini: ${e.message}`);
    }
  }

  // Fall back to Groq
  if (!result && groqKey) {
    try {
      result = await tryGroq(groqKey, csvText, context || 'Experimento agrícola com regressão polinomial');
    } catch (e: any) {
      errors.push(`Groq: ${e.message}`);
    }
  }

  if (!result) {
    return NextResponse.json({
      error: `Falha em todos os provedores de IA.\n\nSoluções:\n1. Gere uma chave Gemini GRATUITA em: https://aistudio.google.com/app/apikey\n2. OU gere uma chave Groq GRATUITA em: https://console.groq.com\n\nErros técnicos: ${errors.join('; ')}`,
    }, { status: 503 });
  }

  const cleaned = result.text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ ...parsed, _model: result.model });
  } catch {
    return NextResponse.json({ error: 'Falha ao interpretar resposta da IA', raw: cleaned }, { status: 500 });
  }
}
