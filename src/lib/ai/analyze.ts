import OpenAI from "openai";
import type {
  AudioAnalysisResult,
  ImageAnalysisResult,
  IntentType,
  MemoryAnalysisResult,
  MemoryEntities,
} from "@/types";

const emptyEntities = (): MemoryEntities => ({
  materials: [],
  people: [],
  companies: [],
  locations: [],
  concepts: [],
  projects: [],
});

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are an expert visual memory analyst for architects, interior designers, and built-environment professionals.
Extract precise, professional metadata from references (facades, materials, details, suppliers, site photos).
Always respond with valid JSON only. Prefer domain language (materials, systems, typology) over vague lifestyle tags.`;

/**
 * Analyze an image (vision + OCR-ish extraction via multimodal model).
 * Falls back to mock analysis when OPENAI_API_KEY is absent — app stays runnable offline.
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context?: { voiceTranscript?: string; projectHints?: string[] }
): Promise<ImageAnalysisResult> {
  const client = getClient();
  if (!client) {
    return mockImageAnalysis(context?.voiceTranscript);
  }

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Analyze this architecture/design reference.
${context?.voiceTranscript ? `Designer voice note: "${context.voiceTranscript}"` : ""}
${context?.projectHints?.length ? `Known projects: ${context.projectHints.join(", ")}` : ""}

Return JSON:
{
  "title": "short professional title",
  "description": "1-2 sentence visual description",
  "objects": ["detected objects"],
  "tags": ["architecture","facade","materials",...],
  "ocrText": "any visible text",
  "entities": {
    "materials": [],
    "people": [],
    "companies": [],
    "locations": [],
    "concepts": [],
    "projects": []
  },
  "projectSuggested": "project name if mentioned or null"
}`,
    },
    {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`,
        detail: "low",
      },
    },
  ];

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });

  const raw = res.choices[0]?.message?.content || "{}";
  return normalizeImageResult(JSON.parse(raw));
}

/**
 * Analyze voice transcript (native STT already produced the text client-side).
 */
export async function analyzeTranscript(
  transcript: string,
  projectHints?: string[]
): Promise<AudioAnalysisResult> {
  const client = getClient();
  if (!client) {
    return mockAudioAnalysis(transcript);
  }

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Parse this designer voice note into structured memory metadata.
Transcript: "${transcript}"
Known projects: ${(projectHints || []).join(", ") || "none"}

Return JSON:
{
  "transcript": "cleaned transcript",
  "intent": "remember|decision|supplier|reference|question|other",
  "summary": "one sentence",
  "entities": {
    "materials": [],
    "people": [],
    "companies": [],
    "locations": [],
    "concepts": [],
    "projects": []
  },
  "projectSuggested": "string or null"
}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = res.choices[0]?.message?.content || "{}";
  return normalizeAudioResult(JSON.parse(raw), transcript);
}

export async function mergeAnalyses(
  image: ImageAnalysisResult | null,
  audio: AudioAnalysisResult | null
): Promise<MemoryAnalysisResult> {
  const entities = mergeEntities(image?.entities, audio?.entities);
  const tags = unique([...(image?.tags || []), ...(audio?.entities.concepts || [])]);
  const objects = image?.objects || [];
  const title =
    image?.title ||
    (audio ? titleFromTranscript(audio.transcript) : "Untitled memory");
  const description = image?.description || audio?.summary || "";
  const aiSummary = [audio?.summary, image?.description].filter(Boolean).join(" — ");
  const projectSuggested = audio?.projectSuggested || image?.projectSuggested;
  const searchText = [
    title,
    description,
    aiSummary,
    image?.ocrText,
    audio?.transcript,
    ...tags,
    ...objects,
    ...Object.values(entities).flat(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    title,
    description,
    aiSummary,
    objects,
    tags,
    ocrText: image?.ocrText || "",
    transcript: audio?.transcript,
    intent: audio?.intent,
    entities,
    projectSuggested,
    searchText,
  };
}

export async function embedText(text: string): Promise<number[] | null> {
  const client = getClient();
  if (!client || !text.trim()) return mockEmbedding(text);

  const res = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return res.data[0]?.embedding ?? null;
}

// ——— helpers & mocks ———

function normalizeImageResult(data: Record<string, unknown>): ImageAnalysisResult {
  const entities = normalizeEntities(data.entities);
  return {
    title: String(data.title || "Visual reference"),
    description: String(data.description || ""),
    objects: asStringArray(data.objects),
    tags: asStringArray(data.tags),
    ocrText: String(data.ocrText || ""),
    entities,
    projectSuggested: data.projectSuggested ? String(data.projectSuggested) : undefined,
  };
}

function normalizeAudioResult(
  data: Record<string, unknown>,
  fallback: string
): AudioAnalysisResult {
  const intent = String(data.intent || "remember") as IntentType;
  return {
    transcript: String(data.transcript || fallback),
    intent: [
      "remember",
      "decision",
      "supplier",
      "reference",
      "question",
      "other",
    ].includes(intent)
      ? intent
      : "other",
    summary: String(data.summary || fallback.slice(0, 120)),
    entities: normalizeEntities(data.entities),
    projectSuggested: data.projectSuggested ? String(data.projectSuggested) : undefined,
  };
}

function normalizeEntities(raw: unknown): MemoryEntities {
  const base = emptyEntities();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof MemoryEntities)[]) {
    base[key] = asStringArray(obj[key]);
  }
  return base;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function mergeEntities(
  a?: MemoryEntities,
  b?: MemoryEntities
): MemoryEntities {
  const out = emptyEntities();
  for (const key of Object.keys(out) as (keyof MemoryEntities)[]) {
    out[key] = unique([...(a?.[key] || []), ...(b?.[key] || [])]);
  }
  return out;
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function titleFromTranscript(t: string): string {
  const clean = t.trim().replace(/\s+/g, " ");
  if (clean.length <= 60) return clean || "Voice memory";
  return clean.slice(0, 57) + "…";
}

function mockImageAnalysis(voice?: string): ImageAnalysisResult {
  const fromVoice = voice ? extractMockEntities(voice) : emptyEntities();
  return {
    title: voice
      ? titleFromTranscript(voice)
      : "Architectural detail reference",
    description:
      "Modern built-environment reference with material and spatial cues suitable for project boards.",
    objects: ["facade", "window", "frame"],
    tags: ["architecture", "reference", "materials", "facade", "interior-design"],
    ocrText: "",
    entities: {
      ...fromVoice,
      materials: unique([...fromVoice.materials, "aluminum", "glass"]),
      concepts: unique([...fromVoice.concepts, "contemporary", "detail"]),
    },
    projectSuggested: fromVoice.projects[0],
  };
}

function mockAudioAnalysis(transcript: string): AudioAnalysisResult {
  const entities = extractMockEntities(transcript);
  const lower = transcript.toLowerCase();
  let intent: IntentType = "remember";
  if (lower.includes("supplier") || lower.includes("fornitore")) intent = "supplier";
  else if (lower.includes("decide") || lower.includes("decision")) intent = "decision";
  else if (lower.includes("?")) intent = "question";
  else if (lower.includes("reference") || lower.includes("like")) intent = "reference";

  return {
    transcript,
    intent,
    summary: transcript.slice(0, 160),
    entities,
    projectSuggested: entities.projects[0],
  };
}

function extractMockEntities(text: string): MemoryEntities {
  const entities = emptyEntities();
  const lower = text.toLowerCase();

  const materialHints = [
    "aluminum",
    "aluminium",
    "alluminio",
    "glass",
    "vetro",
    "marble",
    "marmo",
    "wood",
    "legno",
    "concrete",
    "calcestruzzo",
    "steel",
    "acciaio",
    "brass",
    "ottone",
  ];
  for (const m of materialHints) {
    if (lower.includes(m)) entities.materials.push(m);
  }

  // Very light project heuristic: "... for the X project/hotel"
  const projectMatch = text.match(
    /(?:for the|per (?:il|la)|project|progetto)\s+([A-Z][\w\s]{2,40}?)(?:\.|,|$)/i
  );
  if (projectMatch?.[1]) {
    entities.projects.push(projectMatch[1].trim());
  }
  if (lower.includes("milan") || lower.includes("milano")) {
    entities.locations.push("Milan");
  }
  if (lower.includes("hotel")) entities.concepts.push("hotel");
  if (lower.includes("facade") || lower.includes("facciata")) {
    entities.concepts.push("facade");
  }

  return entities;
}

/** Deterministic pseudo-embedding so hybrid search works without API keys. */
function mockEmbedding(text: string): number[] {
  const dim = 64;
  const vec = new Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
    vec[h % dim] += 1;
    vec[(h * 7) % dim] += 0.5;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
