"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/client-api";

export type ProfileRecord = {
  fullName: string;
  phoneNumber: string | null;
  phoneCountry: string | null;
  phoneCountryCode: string | null;
  gender: "male" | "female" | "other" | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  organization: string | null;
  currentPosition: string | null;
  location: string | null;
  createdAt: string;
};

export type ProfileResponse = {
  profile: ProfileRecord | null;
  avatar: string | null;
  role: string;
  status: string;
};

export const profileQueryKey = (userId: string) => ["profile", userId] as const;

export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? "signed-out"),
    queryFn: () => requestJson<ProfileResponse>("/api/profile", { cache: "no-store" }),
    enabled: Boolean(userId),
    staleTime: 2 * 60_000,
  });
}

export function useSaveProfileMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: {
      fullName: string;
      phoneNumber: string;
      phoneCountry: string;
      countryCode: string;
      city: string;
      region: string;
      gender: string;
      organization: string;
      currentPosition: string;
    }) => requestJson<{ success: true }>("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

export function useAvatarMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: string | null) => requestJson<{ image: string | null }>("/api/profile/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    }),
    onSuccess: (result) => {
      const key = profileQueryKey(userId);
      if (!queryClient.getQueryData<ProfileResponse>(key)) {
        return queryClient.invalidateQueries({ queryKey: key });
      }
      queryClient.setQueryData<ProfileResponse>(key, (current) =>
        current ? { ...current, avatar: result.image } : current,
      );
    },
  });
}

export function useAccountDataQuery<T>(userId: string | undefined, route: "/api/downloads/history" | "/api/billing/payment-methods") {
  return useQuery({
    queryKey: ["account-data", route, userId ?? "signed-out"],
    queryFn: () => requestJson<T>(route, { cache: "no-store" }),
    enabled: Boolean(userId),
  });
}
