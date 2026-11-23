/**
 * Gemeinsames Event-Schema zwischen App und Server (Socket.io).
 *
 * Client -> Server
 *   "join"          { name }                 ack: { ok, history?: ChatMessage[], online?: string[], error? }
 *   "message:send"  { clientId, text }       ack: { ok, message?: ChatMessage, error? }
 *   "typing"        { isTyping }
 *
 * Server -> Client
 *   "message:new"   ChatMessage              an alle (inkl. Absender)
 *   "typing"        { name, isTyping }       an alle anderen
 *   "presence"      { online: string[] }     an alle, wenn jemand kommt/geht
 */

export type MessageStatus = 'pending' | 'sent' | 'failed';

export type ChatMessage = {
  id: string;
  /** Vom Client erzeugte ID, damit die optimistische Nachricht ersetzt werden kann. */
  clientId?: string;
  sender: string;
  text: string;
  /** ISO-Zeitstempel */
  createdAt: string;
  /** Nur lokal in der App verwendet. */
  status?: MessageStatus;
};

export type JoinAck = {
  ok: boolean;
  history?: ChatMessage[];
  online?: string[];
  error?: string;
};

export type SendAck = {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
};

export type TypingEvent = { name: string; isTyping: boolean };
export type PresenceEvent = { online: string[] };
