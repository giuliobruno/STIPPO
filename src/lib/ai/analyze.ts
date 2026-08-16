import OpenAI from "openai";
import type {
  AudioAnalysisResult,
  DocumentAnalysisResult,
  ImageAnalysisResult,
  IntentType,
  LinkAnalysisResult,
  MemoryAnalysisResult,
  MemoryEntities,
} from "@/types";
import type { PageContext } from "@/lib/ai/link-fetch";
import { hostnameFromUrl } from "@/lib/media/url";
import { fileExtension } from "@/lib/media/files";

const emptyEntities = (): MemoryEntities => ({
  materials: [],
  people: [],
  companies: [],
  locations: [],
  concepts: [],
  projects: [],
});

function getClient(): OpenAI | null {
  // Prefer OpenRouter (multi-model gateway). Falls back to OpenAI direct.
  // Request zero data retention where the provider supports it.
  const retentionHeaders: Record<string, string> = {};
  if (process.env.AI_ZERO_RETENTION !== "false") {
    // OpenRouter / compatible gateways
    retentionHeaders["X-Title"] = "Stippo";
    // OpenAI ZDR org header (no-op if org isn't enrolled)
    retentionHeaders["OpenAI-Data-Minimization"] = "true";
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    return new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "Stippo",
        ...retentionHeaders,
      },
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      defaultHeaders: retentionHeaders,
    });
  }
  return null;
}

function visionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL ||
    process.env.OPENAI_VISION_MODEL ||
    (process.env.OPENROUTER_API_KEY ? "openai/gpt-4o-mini" : "gpt-4o-mini")
  );
}

function embeddingModel(): string {
  return (
    process.env.OPENROUTER_EMBEDDING_MODEL ||
    process.env.OPENAI_EMBEDDING_MODEL ||
    (process.env.OPENROUTER_API_KEY
      ? "openai/text-embedding-3-small"
      : "text-embedding-3-small")
  );
}

const SYSTEM_PROMPT = `You are an expert visual memory analyst for architects, interior designers, and built-environment professionals.
Extract precise, professional metadata from references (facades, materials, details, suppliers, site photos).
Always respond with valid JSON only. Prefer domain language (materials, systems, typology) over vague lifestyle tags.`;

/**
 * Analyze an image (vision + OCR-ish extraction via multimodal model).
 * Falls back to mock analysis when no API key is set — app stays runnable offline.
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
    model: visionModel(),
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
 * Analyze a web link from fetched page metadata (+ optional voice note).
 */
export async function analyzeLink(
  page: PageContext,
  context?: { voiceTranscript?: string; projectHints?: string[] }
): Promise<LinkAnalysisResult> {
  const client = getClient();
  if (!client) {
    return mockLinkAnalysis(page, context?.voiceTranscript);
  }

  const res = await client.chat.completions.create({
    model: visionModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this architecture/design web reference (bookmark).
URL: ${page.url}
Site: ${page.siteName || "unknown"}
Page title: ${page.title || "(none)"}
Page description: ${page.description || "(none)"}
Page text snippet: ${page.textSnippet || "(none)"}
${context?.voiceTranscript ? `Designer voice note: "${context.voiceTranscript}"` : ""}
${context?.projectHints?.length ? `Known projects: ${context.projectHints.join(", ")}` : ""}

Return JSON:
{
  "title": "short professional title (prefer page title if useful)",
  "description": "1-2 sentence summary of why this link is a useful design reference",
  "objects": ["notable subjects on the page"],
  "tags": ["materials","facade","suppliers",...],
  "ocrText": "",
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
    ],
    temperature: 0.2,
  });

  const raw = res.choices[0]?.message?.content || "{}";
  return normalizeImageResult(JSON.parse(raw));
}

export type DocumentContext = {
  fileName: string;
  mimeType: string;
  extractedText?: string;
};

/**
 * Analyze a work file (PDF / doc / other) — user note is the primary signal;
 * filename + optional light PDF text are secondary.
 */
export async function analyzeDocument(
  doc: DocumentContext,
  context?: { voiceTranscript?: string; projectHints?: string[] }
): Promise<DocumentAnalysisResult> {
  const client = getClient();
  if (!client) {
    return mockDocumentAnalysis(doc, context?.voiceTranscript);
  }

  const res = await client.chat.completions.create({
    model: visionModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this architecture/design work file for a searchable vault memory.
The designer's spoken/typed note is the PRIMARY signal (why they saved it).
File name and any extracted text are secondary context only.

File name: ${doc.fileName || "(unknown)"}
MIME type: ${doc.mimeType || "application/octet-stream"}
Extracted text (may be empty for scans/binaries):
${(doc.extractedText || "").slice(0, 3500) || "(none)"}
${context?.voiceTranscript ? `Designer note: "${context.voiceTranscript}"` : "Designer note: (none)"}
${context?.projectHints?.length ? `Known projects: ${context.projectHints.join(", ")}` : ""}

Return JSON:
{
  "title": "short professional title",
  "description": "1-2 sentence summary of what this file is for as a design reference",
  "objects": [],
  "tags": ["document","pdf","specification",...],
  "ocrText": "useful excerpt from extracted text or empty",
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
    model: visionModel(),
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
  audio: AudioAnalysisResult | null,
  link?: LinkAnalysisResult | null,
  document?: DocumentAnalysisResult | null
): Promise<MemoryAnalysisResult> {
  const visual = image || link || document || null;
  const entities = mergeEntities(visual?.entities, audio?.entities);
  const tags = unique([
    ...(visual?.tags || []),
    ...(audio?.entities.concepts || []),
  ]);
  const objects = visual?.objects || [];
  const title =
    visual?.title ||
    (audio ? titleFromTranscript(audio.transcript) : "Untitled memory");
  const description = visual?.description || audio?.summary || "";
  const aiSummary = [audio?.summary, visual?.description]
    .filter(Boolean)
    .join(" — ");
  const projectSuggested = audio?.projectSuggested || visual?.projectSuggested;
  const searchText = [
    title,
    description,
    aiSummary,
    visual?.ocrText,
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
    ocrText: visual?.ocrText || "",
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
    model: embeddingModel(),
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

function mockDocumentAnalysis(
  doc: DocumentContext,
  voice?: string
): DocumentAnalysisResult {
  const fromVoice = voice ? extractMockEntities(voice) : emptyEntities();
  const ext = fileExtension(doc.fileName) || "file";
  const baseName = doc.fileName.replace(/\.[^.]+$/, "") || doc.fileName || "Document";
  const title = voice ? titleFromTranscript(voice) : baseName;
  const excerpt = (doc.extractedText || "").slice(0, 160);
  const description =
    voice?.slice(0, 220) ||
    excerpt ||
    `Work file (${ext}) saved to the vault for later reference.`;
  return {
    title: title.slice(0, 120),
    description: description.slice(0, 400),
    objects: [],
    tags: unique(["document", "file", ext, "reference"]),
    ocrText: (doc.extractedText || "").slice(0, 800),
    entities: {
      ...fromVoice,
      concepts: unique([...fromVoice.concepts, "document-reference"]),
    },
    projectSuggested: fromVoice.projects[0],
  };
}

function mockLinkAnalysis(
  page: PageContext,
  voice?: string
): LinkAnalysisResult {
  const fromVoice = voice ? extractMockEntities(voice) : emptyEntities();
  const host = hostnameFromUrl(page.url) || page.siteName || "web";
  const title =
    page.title ||
    (voice ? titleFromTranscript(voice) : `Reference · ${host}`);
  const description =
    page.description ||
    `Web reference from ${host}${voice ? ` — ${voice.slice(0, 100)}` : ""}.`;
  const topicTags = unique([
    ...fromVoice.concepts,
    ...fromVoice.materials,
    ...(page.siteName && page.siteName.toLowerCase() !== host.toLowerCase()
      ? [page.siteName]
      : []),
  ]).filter(
    (t) =>
      !["link", "bookmark", "reference", "web-reference", "architecture"].includes(
        t.toLowerCase()
      )
  );
  return {
    title: title.slice(0, 120),
    description: description.slice(0, 400),
    objects: [],
    tags: topicTags.slice(0, 6),
    ocrText: "",
    entities: {
      ...fromVoice,
      companies: unique([...fromVoice.companies, host]),
      concepts: fromVoice.concepts,
    },
    projectSuggested: fromVoice.projects[0],
  };
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
