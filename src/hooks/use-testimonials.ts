"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/client-api";

export type PublicTestimonial = {
  id: string;
  name: string;
  avatar: string | null;
  designation: string | null;
  title: string;
  message: string;
  rating: number;
  submittedAt: string;
};

export type PublicTestimonialsResponse = {
  reviews: PublicTestimonial[];
  summary: { count: number; average: number };
};

export type UserTestimonial = {
  id: string;
  rating: number;
  title: string;
  quote: string;
  designation: string | null;
  status: "pending" | "approved" | "rejected";
};

type UserTestimonialResponse = { testimonial: UserTestimonial | null };

export const publicTestimonialsQueryKey = ["testimonials", "approved"] as const;
export const myTestimonialQueryKey = (userId: string) => ["testimonials", "mine", userId] as const;

function isPublicTestimonial(value: unknown): value is PublicTestimonial {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.name === "string" &&
    (typeof record.avatar === "string" || record.avatar === null) &&
    (typeof record.designation === "string" || record.designation === null) &&
    typeof record.title === "string" &&
    typeof record.message === "string" &&
    typeof record.rating === "number" && Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5 &&
    typeof record.submittedAt === "string";
}

async function getPublicTestimonials(signal: AbortSignal): Promise<PublicTestimonialsResponse> {
  const result = await requestJson<unknown>("/api/testimonials", { signal });
  if (typeof result !== "object" || result === null || !("reviews" in result) ||
      !Array.isArray(result.reviews) || !result.reviews.every(isPublicTestimonial) ||
      !("summary" in result) || typeof result.summary !== "object" || result.summary === null ||
      !("count" in result.summary) || !Number.isInteger(result.summary.count) ||
      !("average" in result.summary) || typeof result.summary.average !== "number") {
    throw new Error("The testimonial response was invalid. Please try again.");
  }
  return result as PublicTestimonialsResponse;
}

export function usePublicTestimonialsQuery() {
  return useQuery({
    queryKey: publicTestimonialsQueryKey,
    queryFn: ({ signal }) => getPublicTestimonials(signal),
    staleTime: 5 * 60_000,
  });
}

export function useMyTestimonialQuery(userId: string | undefined) {
  return useQuery({
    queryKey: myTestimonialQueryKey(userId ?? "signed-out"),
    queryFn: () => requestJson<UserTestimonialResponse>("/api/testimonials/mine", { cache: "no-store" }),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

export function useSaveTestimonialMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; title: string; message: string; designation: string }) =>
      requestJson<{ testimonial?: UserTestimonial }>("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: myTestimonialQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: publicTestimonialsQueryKey }),
    ]),
  });
}

export function useUpdateTestimonialMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { rating: number; title: string; message: string; designation: string };
    }) => requestJson<{ testimonial?: UserTestimonial }>(`/api/testimonials/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: myTestimonialQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: publicTestimonialsQueryKey }),
    ]),
  });
}

export function useDeleteTestimonialMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestJson<{ success: true }>(`/api/testimonials/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: myTestimonialQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: publicTestimonialsQueryKey }),
    ]),
  });
}
