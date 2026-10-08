import { env } from '../../config/env';

/**
 * Talks to fal.ai's queue API (https://fal.ai/docs → Model APIs → Queue):
 *   1. POST the request          → fal.ai answers with a request id and links to check it
 *   2. check the status link     → IN_QUEUE / IN_PROGRESS / COMPLETED
 *   3. GET the result link       → the generated image links
 */

const POLL_EVERY_MS = 2000;
/** Give up on one picture after 5 minutes. */
const MAX_WAIT_MS = 5 * 60 * 1000;

export class AiProviderError extends Error {
  constructor(
    /** Safe, friendly message shown to the user. */
    public readonly userMessage: string,
    /** Technical details, written to the server log only. */
    detail: string,
  ) {
    super(detail);
    this.name = 'AiProviderError';
  }
}

export interface FalImageInput {
  prompt: string;
  /** Links (or data: links) of the reference images. */
  imageUrls: string[];
}

export interface FalImageResult {
  requestId: string;
  imageUrl: string;
}

interface QueueSubmitResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface QueueStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  error?: string | null;
  error_type?: string | null;
}

interface NanoBananaResponse {
  images?: { url?: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isAiConfigured(): boolean {
  return env.FAL_KEY.length > 0;
}

/** Turns fal.ai's error responses into messages a user can understand. */
function friendlyError(status: number, body: string): AiProviderError {
  const detail = `fal.ai HTTP ${status}: ${body.slice(0, 500)}`;
  const text = body.toLowerCase();
  if (status === 401 || status === 403) {
    if (text.includes('balance') || text.includes('locked') || text.includes('credit')) {
      return new AiProviderError('The AI account has run out of credit. Please top up your fal.ai balance.', detail);
    }
    return new AiProviderError('The AI service rejected the API key. Please check FAL_KEY in server/.env.', detail);
  }
  if (status === 402) {
    return new AiProviderError('The AI account has run out of credit. Please top up your fal.ai balance.', detail);
  }
  if (status === 422 || status === 400) {
    if (text.includes('safety') || text.includes('content') || text.includes('nsfw') || text.includes('policy')) {
      return new AiProviderError('The AI declined to create this picture (content filter). Please try again.', detail);
    }
    return new AiProviderError('The AI could not use this sample photo. Please try again or use another sample.', detail);
  }
  if (status === 429) {
    return new AiProviderError('The AI service is busy right now. Please try again in a minute.', detail);
  }
  return new AiProviderError('The AI service had a problem creating this picture. Please try again.', detail);
}

async function falFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: { Authorization: `Key ${env.FAL_KEY}`, Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AiProviderError(
      'Could not reach the AI service. Please check the internet connection and try again.',
      `fal.ai network error for ${url}: ${message}`,
    );
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) throw friendlyError(response.status, body);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new AiProviderError('The AI service sent an unexpected answer. Please try again.', `Bad JSON: ${body.slice(0, 300)}`);
  }
}

/** Creates one picture and returns fal.ai's link to it (the link is temporary — download it soon). */
export async function generateImage({ prompt, imageUrls }: FalImageInput): Promise<FalImageResult> {
  if (!isAiConfigured()) {
    throw new AiProviderError('AI image generation is not set up yet (FAL_KEY is missing).', 'FAL_KEY is empty');
  }

  const submitUrl = `${env.FAL_QUEUE_URL.replace(/\/+$/, '')}/${env.FAL_MODEL}`;
  const submitted = await readJson<QueueSubmitResponse>(
    await falFetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_urls: imageUrls,
        num_images: 1,
        aspect_ratio: '4:3',
        output_format: 'jpeg',
      }),
    }),
  );
  if (!submitted.request_id || !submitted.status_url || !submitted.response_url) {
    throw new AiProviderError('The AI service sent an unexpected answer. Please try again.', `Bad submit response: ${JSON.stringify(submitted)}`);
  }

  // Wait until fal.ai has finished.
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      throw new AiProviderError('The AI took too long to create this picture. Please try again.', `Timed out: ${submitted.request_id}`);
    }
    await sleep(POLL_EVERY_MS);
    const status = await readJson<QueueStatusResponse>(await falFetch(submitted.status_url));
    if (status.status === 'COMPLETED') {
      if (status.error) throw friendlyError(422, `${status.error_type ?? ''} ${status.error}`);
      break;
    }
  }

  const result = await readJson<NanoBananaResponse>(await falFetch(submitted.response_url));
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) {
    throw new AiProviderError('The AI did not return a picture this time. Please try again.', `No image in result: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return { requestId: submitted.request_id, imageUrl };
}

/** Downloads a generated picture so it can be kept in our own storage. */
export async function downloadImage(url: string): Promise<{ buffer: Buffer; extension: string; contentType: string }> {
  let response: Response;
  try {
    response = url.startsWith('data:') ? await fetch(url) : await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AiProviderError('Could not download the finished picture. Please try again.', `Download failed ${url}: ${message}`);
  }
  if (!response.ok) {
    throw new AiProviderError('Could not download the finished picture. Please try again.', `Download HTTP ${response.status} ${url}`);
  }
  const contentType = (response.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim();
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  return { buffer: Buffer.from(await response.arrayBuffer()), extension, contentType };
}
