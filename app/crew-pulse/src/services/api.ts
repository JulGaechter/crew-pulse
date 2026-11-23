import { io, Socket } from "socket.io-client";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://crewpulse.gaechterkind.ch";

export interface HealthResponse {
  status: string;
  service: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Health-Check fehlgeschlagen: HTTP ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export const socket: Socket = io(API_URL, {
  transports: ["websocket"],
  autoConnect: false,
});