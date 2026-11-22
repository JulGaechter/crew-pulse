import { io, Socket } from "socket.io-client";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://crewpulse.gaechterkind.ch";

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export const socket: Socket = io(API_URL, {
  transports: ["websocket"],
  autoConnect: false,
});