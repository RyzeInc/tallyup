import fs from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const DEFAULT_DOC = "Inside the Mind of a Financial Coach_ A Comprehensive Personal Finance Blueprint.md";
const DOC_PATH = process.argv[2] || path.join(process.cwd(), DEFAULT_DOC);
const DOC_ID = process.env.COACH_KNOWLEDGE_DOC_ID || "financial-coach-blueprint";
const MAX_WORDS = Number.parseInt(process.env.COACH_KNOWLEDGE_CHUNK_WORDS || "900", 10);
const OVERLAP_WORDS = Number.parseInt(process.env.COACH_KNOWLEDGE_OVERLAP_WORDS || "120", 10);

const DIMENSIONS = 128;

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function embedText(text) {
  const vector = new Array(DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const idx = hashString(token) % DIMENSIONS;
    vector[idx] += 1;
  }

  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm) || 1;

  return vector.map((value) => value / norm);
}

function countWords(text) {
  return tokenize(text).length;
}

function getOverlapText(text, overlapWords) {
  const words = tokenize(text);
  if (words.length <= overlapWords) return text;
  return words.slice(-overlapWords).join(" ");
}

function chunkText(text, maxWords, overlapWords) {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = countWords(para);
    if (currentWords + paraWords > maxWords && currentWords > 0) {
      const chunkText = current.join("\n\n");
      chunks.push(chunkText);
      const overlapText = getOverlapText(chunkText, overlapWords);
      current = overlapText ? [overlapText] : [];
      currentWords = countWords(overlapText);
    }
    current.push(para);
    currentWords += paraWords;
  }

  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

async function main() {
  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL.");
  }

  const raw = await fs.readFile(DOC_PATH, "utf8");
  if (!raw.trim()) {
    throw new Error(`Document is empty: ${DOC_PATH}`);
  }

  const chunks = chunkText(raw, MAX_WORDS, OVERLAP_WORDS).map((content, index) => ({
    chunkIndex: index,
    content,
    embedding: embedText(content),
    tokenCount: countWords(content),
  }));

  const client = new ConvexHttpClient(convexUrl);
  const token = process.env.COACH_KNOWLEDGE_INGEST_TOKEN;

  const result = await client.action(api.coachKnowledge.ingestKnowledge, {
    token,
    docId: DOC_ID,
    chunks,
    replaceExisting: true,
  });

  console.log(`Ingested ${result.total} chunks (inserted ${result.inserted}, updated ${result.updated}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
