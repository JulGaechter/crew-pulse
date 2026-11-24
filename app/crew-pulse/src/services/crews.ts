import type { CrewDetail, CrewSummary } from '@/services/chat-types';
import { request, type Session } from '@/services/session';

export async function listCrews(session: Session): Promise<CrewSummary[]> {
  const data = await request<{ crews: CrewSummary[] }>('/crews', { token: session.token });
  return data.crews;
}

export async function createCrew(session: Session, name: string): Promise<CrewSummary> {
  const data = await request<{ crew: CrewSummary }>('/crews', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ name }),
  });
  return data.crew;
}

export async function joinCrew(
  session: Session,
  code: string,
): Promise<{ crew: CrewSummary; joined: boolean }> {
  return request('/crews/join', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ code }),
  });
}

export async function getCrew(session: Session, crewId: string): Promise<CrewDetail> {
  const data = await request<{ crew: CrewDetail }>(`/crews/${crewId}`, { token: session.token });
  return data.crew;
}

export async function renameCrew(session: Session, crewId: string, name: string): Promise<CrewDetail> {
  const data = await request<{ crew: CrewDetail }>(`/crews/${crewId}`, {
    method: 'PATCH',
    token: session.token,
    body: JSON.stringify({ name }),
  });
  return data.crew;
}

export async function regenerateInviteCode(session: Session, crewId: string): Promise<CrewDetail> {
  const data = await request<{ crew: CrewDetail }>(`/crews/${crewId}/invite-code`, {
    method: 'POST',
    token: session.token,
  });
  return data.crew;
}

export async function setCrewMuted(session: Session, crewId: string, muted: boolean): Promise<CrewSummary> {
  const data = await request<{ crew: CrewSummary }>(`/crews/${crewId}/notifications`, {
    method: 'PATCH',
    token: session.token,
    body: JSON.stringify({ muted }),
  });
  return data.crew;
}

export async function leaveCrew(session: Session, crewId: string): Promise<void> {
  await request(`/crews/${crewId}/leave`, { method: 'POST', token: session.token });
}

/** "K7MX4P" -> "K7M-X4P" (nur Anzeige) */
export function formatInviteCode(code: string) {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}
