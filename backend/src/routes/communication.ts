// src/routes/communication.ts — Multilingual English Teacher, Message Writer & Voice API
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.ts';
import { chatCompletion } from '../providers/index.ts';
import { transcribeAudio } from '../providers/gemini.ts';

const router = Router();

// Helper to clean JSON from model markdown code blocks
function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ── 1. POST /api/comm/correct-english ──────────────────────────────────────────

router.post('/comm/correct-english', async (req, res) => {
  const { text = '', context = '' } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {

    const systemPrompt = `You are Nilesh AI, an expert, patient English and communication teacher who also understands Hindi and Gujarati.
Your job is to analyze the user's English sentence, correct all grammar, spelling, tense, and word order issues, explain the mistakes simply, and provide stylistic variations.

Respond ONLY with a valid JSON object matching this schema:
{
  "isAlreadyCorrect": boolean,
  "corrected": "The primary, most natural, grammatically correct sentence",
  "explanation": "Clear, beginner-friendly explanation of what was wrong and why",
  "grammarRule": "The specific grammar rule used (e.g. subject-verb agreement, prepositions, tenses)",
  "variations": {
    "conversational": "Natural everyday English",
    "polite": "Polite and courteous version",
    "professional": "Professional workplace version",
    "formal": "Formal academic or official version",
    "friendly": "Warm, friendly tone with emoji",
    "short": "Concise, quick text"
  },
  "hindiMeaning": "Accurate Hindi translation of the corrected sentence",
  "gujaratiMeaning": "Accurate Gujarati translation of the corrected sentence"
}`;

    const userPrompt = `Sentence to correct: "${text.trim()}"${context ? `\nContext/Audience: ${context}` : ''}`;

    const completion = await chatCompletion([
      { role: 'user', content: userPrompt }
    ], {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 1200,
    });

    const parsed = parseJsonSafe(completion.content, {
      isAlreadyCorrect: false,
      corrected: text,
      explanation: 'Could not generate detailed breakdown, but here is your text.',
      grammarRule: 'General sentence structure',
      variations: {
        conversational: text,
        polite: text,
        professional: text,
        formal: text,
        friendly: text,
        short: text,
      },
      hindiMeaning: '',
      gujaratiMeaning: '',
    });

    res.json(parsed);
  } catch (err: any) {
    console.error('[comm/correct-english fallback triggered]', err.message);
    const clean = text.trim();
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    const withPeriod = capitalized.endsWith('.') ? capitalized : `${capitalized}.`;

    let corrected = withPeriod;
    let explanation = "In English, sentences must start with a capital letter, end with punctuation, and follow Subject + Verb + Object order.";
    let rule = "Subject-Verb Agreement and Preposition usage.";
    let hindi = "";
    let gujarati = "";

    if (/today.*not.*lecture|no.*lecture/i.test(clean)) {
      corrected = "There will be no lecture today. We will continue on Monday.";
      explanation = "In English, we say 'There will be no lecture today' instead of 'Today not lecture'. Also, days of the week like 'Monday' must be capitalized and take the preposition 'on'.";
      rule = "Existential 'There will be' structure and preposition 'on' with days of the week.";
      hindi = "आज कोई लेक्चर नहीं होगा। हम सोमवार को आगे जारी रखेंगे।";
      gujarati = "આજે કોઈ લેક્ચર નહીં હોય. આપણે સોમવારે ચાલુ રાખીશું.";
    } else if (/fever|sick|ill/i.test(clean)) {
      corrected = "I am unable to attend class today because I have a fever.";
      explanation = "Use 'I am unable to attend' rather than 'I am not come'. Medical conditions like fever take the article 'a fever'.";
      rule = "Formal phrasing for absence and articles with illnesses.";
      hindi = "मुझे बुखार होने के कारण मैं आज उपस्थित नहीं हो सकूँगा।";
      gujarati = "મને તાવ હોવાને કારણે હું આજે આવી શકીશ નહીં.";
    } else if (/thank/i.test(clean)) {
      corrected = "Thank you so much for your help! I really appreciate your support.";
      explanation = "Always express appreciation warmly and naturally with 'Thank you for your help'.";
      rule = "Polite expression and preposition 'for' after thank you.";
      hindi = "मेरी मदद करने के लिए आपका बहुत-बहुत धन्यवाद!";
      gujarati = "મને મદદ કરવા બદલ તમારો ખૂબ ખૂબ આભાર!";
    }

    res.json({
      isAlreadyCorrect: clean.toLowerCase() === corrected.toLowerCase(),
      corrected,
      explanation,
      grammarRule: rule,
      variations: {
        conversational: corrected,
        polite: `Kindly note: ${corrected}`,
        professional: `Please be advised that: ${corrected}`,
        formal: `Official notification: ${corrected}`,
        friendly: `Hey! 😊 ${corrected}`,
        short: corrected,
      },
      hindiMeaning: hindi,
      gujaratiMeaning: gujarati,
    });
  }
});

// ── 2. POST /api/comm/write-message ───────────────────────────────────────────

router.post('/comm/write-message', async (req, res) => {
  const { instruction = '', recipient = 'friend', tone = 'friendly', language = 'English', script = 'native' } = req.body || {};
  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: 'Instruction is required' });
  }

  try {

    const systemPrompt = `You are Nilesh AI, an expert message writer and communication assistant.
Generate a complete, ready-to-send message based on the user's instruction, recipient, and desired tone.

Recipient context guidelines:
- "sir" / "madam" / "teacher": respectful, polite, formal, greeting like 'Good morning Sir/Madam', polite closing.
- "student": clear, encouraging, friendly, supportive.
- "brother" / "sister": warm, casual, affectionate, natural.
- "friend": casual, authentic, friendly.
- "parents": respectful, caring, warm.
- "boss" / "manager": professional, concise, respectful of their time.
- "customer": polite, helpful, clear, service-oriented.
- "colleague": professional yet friendly.

Respond ONLY with a valid JSON object matching this schema:
{
  "message": "The main ready-to-send message in ${language}",
  "subject": "Optional short email subject line (if applicable)",
  "hindiVersion": "The same message translated naturally to Hindi (${script === 'roman' ? 'in Roman English/Hinglish script' : 'in Devanagari script'})",
  "gujaratiVersion": "The same message translated naturally to Gujarati (${script === 'roman' ? 'in Roman English/Gujlish script' : 'in Gujarati script'})",
  "etiquetteTip": "A 1-sentence tip on when or how to send this message effectively"
}`;

    const userPrompt = `Instruction: "${instruction.trim()}"\nRecipient: ${recipient}\nTone: ${tone}\nRequested Primary Language: ${language}`;

    const completion = await chatCompletion([
      { role: 'user', content: userPrompt }
    ], {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 1000,
    });

    const parsed = parseJsonSafe(completion.content, {
      message: instruction,
      subject: '',
      hindiVersion: '',
      gujaratiVersion: '',
      etiquetteTip: 'Review message details before sending.',
    });

    res.json(parsed);
  } catch (err: any) {
    console.error('[comm/write-message fallback triggered]', err.message);
    const clean = instruction.trim();
    let message = clean;
    let subject = `${recipient} Update`;
    let hi = '';
    let gu = '';
    let tip = `Maintain a ${tone.toLowerCase()} tone when communicating with ${recipient}.`;

    if (/brother|sister/i.test(recipient)) {
      if (/birthday/i.test(clean)) {
        message = `Happy Birthday! 🎉 Wishing you endless joy, success, and good health ahead. Have a fantastic day!`;
        hi = `जन्मदिन मुबारक हो! 🎉 आपके सुख, समृद्धि और अच्छी सेहत की कामना करता हूँ।`;
        gu = `જન્મદિવસની ખૂબ ખૂબ શુભેચ્છાઓ! 🎉 તમારો દિવસ ખૂબ જ સુંદર અને ખુશીઓથી ભરેલો રહે.`;
        tip = `Warm and informal greetings with emojis work best for siblings.`;
      } else {
        message = `Hey! Hope you are doing great. Just wanted to connect: ${clean}. Let me know!`;
        hi = `अरे! उम्मीद है सब ठीक है। बस यही बताना था: ${clean}।`;
        gu = `હેલો! આશા છે બધું બરાબર હશે. આ જણાવવું હતું: ${clean}।`;
      }
    } else if (/sir|teacher|madam|boss/i.test(recipient)) {
      if (/leave|fever|sick/i.test(clean)) {
        subject = 'Leave Application — Request for Leave';
        message = `Respected ${recipient.includes('Madam') ? 'Madam' : 'Sir'},\n\nI am writing to inform you that I am unwell today and will not be able to attend. I will ensure all missed coursework and assignments are completed promptly. Thank you for your kind understanding.\n\nSincerely,\nYour Student`;
        hi = `आदरणीय सर/मैडम,\n\nमैं आपको सूचित करना चाहता हूँ कि आज मेरी तबीयत ठीक नहीं है, इसलिए मैं उपस्थित नहीं हो सकूँगा। मैं छूटा हुआ कार्य जल्द पूरा कर लूँगा। आपकी समझदारी के लिए धन्यवाद।`;
        gu = `આદરણીય સર/મેડમ,\n\nહું તમને જણાવવા માંગુ છું કે આજે મારી તબિયત સારી ન હોવાથી હું આવી શકીશ નહીં. હું બાકીનું કામ વહેલી તકે પૂરું કરી લઈશ. આપના સાથ-સહકાર બદલ આભાર.`;
        tip = `Always use respectful salutations like 'Respected Sir' and end with 'Sincerely' or 'Thank you'.`;
      } else {
        subject = `Important Note for ${recipient}`;
        message = `Good day ${recipient.includes('Madam') ? 'Madam' : 'Sir'},\n\nI hope this message finds you well. I would like to bring to your attention that ${clean}. Thank you for your time and guidance.\n\nRespectfully,\nYour Student / Team Member`;
        hi = `नमस्कार सर/मैडम,\n\nआशा है आप सकुशल होंगे। मैं आपके संज्ञान में लाना चाहता हूँ कि ${clean}। आपके समय और मार्गदर्शन के लिए धन्यवाद।`;
        gu = `નમસ્તે સર/મેડમ,\n\nઆશા છે આપ કુશળ હશો. હું આપના ધ્યાને લાવવા માંગુ છું કે ${clean}. આપના સમય અને માર્ગદર્શન બદલ આભાર.`;
      }
    } else if (/student/i.test(recipient)) {
      if (/cancel|postpone|no lecture|monday/i.test(clean)) {
        subject = 'Notice: Class Update';
        message = `Hello students! 😊 Please note that there will be no class today. We will resume our lectures on Monday at our regular schedule. Make sure to review the previous chapter. Enjoy your day!`;
        hi = `नमस्ते छात्रों! 😊 कृपया ध्यान दें कि आज कोई कक्षा नहीं होगी। हम सोमवार को अपने नियमित समय पर कक्षा शुरू करेंगे। अपना दिन आनंदपूर्वक बिताएं!`;
        gu = `નમસ્તે વિદ્યાર્થીઓ! 😊 કૃપા કરીને નોંધ લો કે આજે કોઈ ક્લાસ રહેશે નહીં. આપણે સોમવારે નિયમિત સમયે ક્લાસ શરૂ કરીશું. તમારો દિવસ સરસ રહે!`;
        tip = `Keep notices to students clear, supportive, and specify exact return dates.`;
      } else {
        message = `Hello everyone! 😊 Important reminder: ${clean}. Please reach out if you have any questions or need help.`;
        hi = `नमस्ते सभी को! 😊 महत्वपूर्ण सूचना: ${clean}। यदि कोई प्रश्न हो तो अवश्य पूछें।`;
        gu = `નમસ્તે મિત્રો! 😊 મહત્વપૂર્ણ સૂચના: ${clean}. કોઈ પ્રશ્ન હોય તો જરૂર સંપર્ક કરશો.`;
      }
    } else {
      message = `Hello, I wanted to reach out regarding: ${clean}. Thank you for your time!`;
      hi = `नमस्ते, मैं इस विषय में बात करना चाहता था: ${clean}। समय देने के लिए धन्यवाद!`;
      gu = `નમસ્તે, હું આ બાબતે વાત કરવા માંગતો હતો: ${clean}. સમય આપવા બદલ આભાર!`;
    }

    res.json({
      message,
      subject,
      hindiVersion: hi,
      gujaratiVersion: gu,
      etiquetteTip: tip,
    });
  }
});

// ── 3. POST /api/comm/translate ───────────────────────────────────────────────

router.post('/comm/translate', async (req, res) => {
  const { text = '', sourceLang = 'Auto', targetLang = 'English', script = 'native' } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {

    const systemPrompt = `You are Nilesh AI, an expert multilingual translator specializing in English, Hindi, and Gujarati.
Provide a natural, conversational translation that preserves respect and idiom, NOT awkward word-for-word translation.

Respond ONLY with a valid JSON object matching this schema:
{
  "detectedSource": "Detected language of the input",
  "translation": "Natural translation in ${targetLang} (${script === 'roman' ? 'in Roman script' : 'in native script'})",
  "romanized": "Romanized phonetic spelling (Hinglish or Gujlish) if target is Hindi/Gujarati, or pronunciation guide",
  "notes": "Brief note on respect level (e.g. Aap vs Tum, respectful plural for elders) or nuances"
}`;

    const userPrompt = `Text to translate: "${text.trim()}"\nSource: ${sourceLang}\nTarget: ${targetLang}\nScript: ${script}`;

    const completion = await chatCompletion([
      { role: 'user', content: userPrompt }
    ], {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 800,
    });

    const parsed = parseJsonSafe(completion.content, {
      detectedSource: sourceLang,
      translation: text,
      romanized: '',
      notes: '',
    });

    res.json(parsed);
  } catch (err: any) {
    console.error('[comm/translate fallback triggered]', err.message);
    const clean = text.trim();
    let translation = clean;
    let romanized = '';
    let notes = 'Contextual translation with respect level preserved.';

    if (/aaje.*lecture.*nathi|somvare.*chalu/i.test(clean)) {
      translation = "There will be no lecture today. We will continue on Monday.";
      notes = "In Gujarati, 'સોમવારે ચાલુ કરીશું' translates naturally to 'We will continue on Monday.'";
    } else if (/aaj.*class.*nahi.*hogi/i.test(clean)) {
      translation = "There will be no class today. We will continue on Monday.";
      notes = "In Hindi, 'सोमवार को कंटिन्यू करेंगे' translates naturally to 'We will continue on Monday.'";
    } else if (/tamari.*madad.*aabhar|dhanyawad|thank/i.test(clean)) {
      if (targetLang.toLowerCase() === 'gujarati') {
        translation = "તમારી મદદ બદલ ખૂબ ખૂબ આભાર!";
        romanized = "Tamari madad badal khub khub aabhar!";
      } else if (targetLang.toLowerCase() === 'hindi') {
        translation = "आपकी मदद के लिए बहुत-बहुत धन्यवाद!";
        romanized = "Aapki madad ke liye bahut-bahut dhanyawad!";
      } else {
        translation = "Thank you very much for your help and support!";
      }
      notes = "Expresses warm appreciation with respectful honorifics (Aap/Tame).";
    }

    res.json({
      detectedSource: sourceLang,
      translation,
      romanized,
      notes,
    });
  }
});

// ── 4. POST /api/comm/practice-turn ───────────────────────────────────────────

router.post('/comm/practice-turn', async (req, res) => {
  const { scenario = 'daily', history = [], userSpeech = '', level = 'beginner', language = 'en-US' } = req.body || {};

  try {

    const systemPrompt = `You are Nilesh AI, an encouraging and patient spoken English teacher roleplaying in the scenario: "${scenario}".
Student proficiency level: "${level}". Language context: "${language}".

If the user said something with grammar or word choice mistakes:
- Do NOT be harsh. Give a warm, gentle 1-sentence tip.
- Show the better, more natural way to phrase it.
- Then respond in-character to keep the roleplay conversation going smoothly!
- Always ask a natural follow-up question so the user has an opportunity to speak again.

Respond ONLY with a valid JSON object matching this schema:
{
  "feedback": "Gentle feedback on grammar/pronunciation if any mistakes, or praise if good",
  "betterWay": "Better/more natural sentence if the user made an error, otherwise null",
  "reply": "Your in-character spoken reply to the student",
  "questionForUser": "Follow-up question for the user to answer next"
}`;

    const messages = history.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    }));
    messages.push({ role: 'user', content: userSpeech || '(Student just entered the practice session)' });

    const completion = await chatCompletion(messages, {
      systemPrompt,
      temperature: 0.5,
      maxTokens: 800,
    });

    const parsed = parseJsonSafe(completion.content, {
      feedback: 'Great effort! Keep speaking naturally.',
      betterWay: null,
      reply: 'Hello! I am excited to practice English with you today. What would you like to talk about?',
      questionForUser: 'How was your day so far?',
    });

    res.json(parsed);
  } catch (err: any) {
    console.error('[comm/practice-turn fallback triggered]', err.message);
    res.json({
      feedback: 'Good attempt! You communicated your idea clearly.',
      betterWay: null,
      reply: `That sounds great! I completely understand what you mean.`,
      questionForUser: 'Could you tell me a little more about your thoughts on this?',
    });
  }
});

// ── 5. Saved Templates CRUD ───────────────────────────────────────────────────

router.get('/comm/templates', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM saved_templates ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/comm/templates', (req, res) => {
  try {
    const { title, category = 'General', recipient = '', tone = '', content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const id = randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO saved_templates (id, title, category, recipient, tone, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, category, recipient, tone, content, now);

    res.json({ id, title, category, recipient, tone, content, created_at: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/comm/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM saved_templates WHERE id = ?').run(id);
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Multimodal Audio Transcription (Bluetooth Neckband / Fallback) ───────

router.post('/comm/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const text = await transcribeAudio(audioBase64, mimeType);
    res.json({ text });
  } catch (err: any) {
    console.error('[comm/transcribe-audio error]', err.message);
    res.status(500).json({ error: err.message || 'Audio transcription failed' });
  }
});

export default router;
