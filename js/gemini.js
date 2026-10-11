// GEMINI ENTEGRASYONU (isteğe bağlı)
// Ayarlar menüsüne Gemini API anahtarı girilirse botlar raund planını ve sohbet mesajlarını
// Gemini'ye sorar. Anahtar yoksa botlar yerleşik yapay zekâyla oynar.
import { game } from './game.js';

async function callGemini(prompt, json) {
  const key = game.settings.geminiKey;
  if (!key) return null;
  const model = game.settings.geminiModel || 'gemini-2.5-flash';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn('Gemini hata', res.status);
      return null;
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || null;
  } catch (err) {
    console.warn('Gemini ulaşılamadı', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Saldıran botların raund planı
export async function askStrategy(ctx) {
  const prompt = `Sen taktiksel bir FPS oyununda (Valorant benzeri) saldıran takımın kaptanısın.
Haritada A ve B olmak üzere iki bomba bölgesi var. Durum: ${JSON.stringify(ctx)}.
Bu raund için kısa bir plan seç. SADECE şu JSON'u döndür:
{"site":"A" ya da "B","plan":"rush" ya da "default","chat":"takıma Türkçe, en fazla 12 kelimelik kısa bir mesaj"}`;
  const text = await callGemini(prompt, true);
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// Bot sohbet mesajı
export async function askChat(event) {
  const text = await callGemini(`Bir FPS oyununda botsun. ${event} Sohbete Türkçe, en fazla 8 kelimelik, eğlenceli ama kaba olmayan tek bir cümle yaz. Sadece cümleyi yaz.`, false);
  return text ? text.trim().replace(/^"|"$/g, '') : null;
}

// Ayarlar ekranındaki "Test et" butonu için
export async function testKey() {
  const text = await callGemini('Sadece "tamam" yaz.', false);
  return !!text;
}
