/**
 * Gemeinsames Schema zwischen App und Server.
 *
 * REST
 *   POST  /users                { name }                     -> { user, token }   (ohne Login, nur dieses Gerät)
 *   POST  /auth/apple|google    { idToken, name? }  [Bearer] -> { user, token, outcome }
 *   POST  /auth/logout          Bearer                       -> 204
 *   GET   /users/me             Bearer                       -> { user }
 *   PATCH /users/me             Bearer  { name }             -> { user }
 *
 * Socket.io (Verbindung nur mit auth: { token })
 * Client -> Server
 *   "join"          {}                       ack: { ok, user, history, online }
 *   "message:send"  { clientId, text }       ack: { ok, message?, error? }
 *   "typing"        { isTyping }
 *
 * Server -> Client
 *   "message:new"   ChatMessage              an alle (inkl. Absender)
 *   "typing"        { userId, name, isTyping }   an alle anderen
 *   "presence"      { online: ChatUser[] }   an alle, wenn jemand kommt/geht
 *   "user:updated"  ChatUser                 wenn jemand den Namen ändert
 */

export type ChatUser = {
  id: string;
  name: string;
  /** Verknüpfte Logins, z. B. ["apple", "google"]. Nur beim eigenen Profil gesetzt. */
  providers?: string[];
};

export type MessageStatus = 'pending' | 'sent' | 'failed';

export type ChatMessage = {
  id: string;
  /** Vom Client erzeugte ID, damit die optimistische Nachricht ersetzt werden kann. */
  clientId?: string;
  /** Benutzer-ID des Absenders (fehlt bei alten Nachrichten von vor den Benutzerkonten). */
  senderId?: string;
  /** Anzeigename des Absenders */
  sender: string;
  text: string;
  /** ISO-Zeitstempel */
  createdAt: string;
  /** Nur lokal in der App verwendet. */
  status?: MessageStatus;
};

export type JoinAck = {
  ok: boolean;
  user?: ChatUser;
  history?: ChatMessage[];
  online?: ChatUser[];
  error?: string;
};

export type SendAck = {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
};

export type TypingEvent = { userId: string; name: string; isTyping: boolean };
export type PresenceEvent = { online: ChatUser[] };
