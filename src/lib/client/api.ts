"use client";
import type {
  ApiErrorBody,
  CreatePostRequest,
  ExtractMode,
  ExtractResponse,
  ImageInput,
  PublicPost,
  SignalType,
  Stats,
} from "../types";
import { getClientId } from "./clientId";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-client-id", getClientId());
  if (init.body) headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "network", "You seem to be offline. Check your connection.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listPosts: () => request<{ posts: PublicPost[]; serverTime: string }>("/api/posts"),
  createPost: (body: CreatePostRequest) =>
    request<{ post: PublicPost }>("/api/posts", { method: "POST", body: JSON.stringify(body) }),
  signal: (id: string, type: SignalType) =>
    request<{ post: PublicPost }>(`/api/posts/${id}/signals`, { method: "POST", body: JSON.stringify({ type }) }),
  extract: (mode: ExtractMode, image: ImageInput) =>
    request<ExtractResponse>("/api/ai/extract", { method: "POST", body: JSON.stringify({ mode, image }) }),
  stats: () => request<Stats>("/api/stats"),
};
