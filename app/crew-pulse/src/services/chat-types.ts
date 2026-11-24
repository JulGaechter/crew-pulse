/**
 * Gemeinsames Schema zwischen App und Server.
 *
 * REST (alles ausser /users und /auth/* braucht Authorization: Bearer <token>)
 *   POST  /users                { name }              -> { user, token }   (ohne Login, nur dieses Gerät)
 *   POST  /auth/apple|google    { idToken, name? }    -> { user, token, outcome }
 *   POST  /auth/logout                                -> 204
 *   GET   /users/me                                   -> { user }
 *   PATCH /users/me             { name }              -> { user }
 *
 *   GET   /crews                                      -> { crews: CrewSummary[] }
 *   POST  /crews                { name }              -> { crew }
 *   POST  /crews/join           { code }              -> { crew, joined }
 *   GET   /crews/:id                                  -> { crew: CrewDetail }
 *   PATCH /crews/:id            { name }   (Ersteller) -> { crew }
 *   POST  /crews/:id/invite-code           (Ersteller) -> { crew }   neuer Code
 *   POST  /crews/:id/leave                            -> 204
 *   PATCH /crews/:id/notifications  { muted }         -> { crew }
 *   POST  /crews/:id/images     { data: base64, width, height } -> { image }
 *   GET   /crews/:id/messages?before=<id>          -> { messages, hasMore }
 *   GET   /media/:id            (Bild, nur für Mitglieder)
 *   POST  /crews/:id/audio      { data: base64, durationMs } -> { audio }
 *   GET   /audio/:id            (Sprachnachricht, nur für Mitglieder)
 *   POST  /push-tokens          { token, platform }   -> 204
 *   DELETE /push-tokens         { token }             -> 204
 *
 * Socket.io (Verbindung nur mit auth: { token }; man ist automatisch in allen eigenen Crews)
 * Client -> Server
 *   "join"          { crewId }                    ack: { ok, history, online }
 *   "message:send"  { crewId, clientId, text }    ack: { ok, message?, error? }
 *   "typing"        { crewId, isTyping }
 *   "crew:read"     { crewId }
 *   "reaction:toggle" { messageId, emoji }        ack: { ok, reactions }
 *   "message:edit"  { messageId, text }           ack: { ok, message }   (nur eigene)
 *   "message:delete" { messageId }                ack: { ok, message }   (nur eigene)
 *   "message:send" zusätzlich: imageId, audioId, replyToId
 *   "view"          { crewId | null }             welche Crew ist offen (kein Push dafür)
 *
 * Server -> Client
 *   "message:new"   ChatMessage (mit crewId)      an alle Mitglieder der Crew
 *   "typing"        { crewId, userId, name, isTyping }
 *   "presence"      { crewId, online: ChatUser[] }
 *   "reaction:updated" { crewId, messageId, reactions }
 *   "message:updated" ChatMessage                 bearbeitet oder gelöscht
 *   "read:updated"  { crewId, userId, lastReadAt } jemand hat gelesen
 *   "user:updated"  ChatUser                      jemand hat den Namen geändert
 *   "crews:changed" { crewId }                    Mitglieder/Name/Code geändert -> Liste neu laden
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
  /** Crew, zu der die Nachricht gehört */
  crewId?: string;
  /** Anzeigename des Absenders */
  sender: string;
  /** Kann leer sein, wenn die Nachricht nur ein Bild ist */
  text: string;
  image?: MessageImage;
  audio?: MessageAudio;
  reactions?: Reaction[];
  /** Zitat der Nachricht, auf die geantwortet wird */
  replyTo?: ReplyPreview;
  /** Text wurde nachträglich geändert */
  edited?: boolean;
  /** Nachricht wurde vom Absender gelöscht (Inhalt ist leer) */
  deleted?: boolean;
  /** ISO-Zeitstempel */
  createdAt: string;
  /** Nur lokal in der App verwendet. */
  status?: MessageStatus;
};

export type MessageImage = {
  /** Bild-ID auf dem Server (leer, solange es noch hochgeladen wird) */
  id: string;
  width: number;
  height: number;
  /** Nur lokal: Datei auf dem Gerät, damit das eigene Bild sofort sichtbar ist */
  localUri?: string;
};

export type MessageAudio = {
  /** Audio-ID auf dem Server (leer, solange sie noch hochgeladen wird) */
  id: string;
  durationMs: number;
  /** Nur lokal: Aufnahme auf dem Gerät */
  localUri?: string;
};

export type ReplyPreview = {
  id: string;
  senderId?: string;
  sender: string;
  text: string;
  hasImage: boolean;
  hasAudio: boolean;
  deleted: boolean;
};

/** Bis wann ein Mitglied gelesen hat (für "Gesehen von …") */
export type ReadState = { userId: string; name: string; lastReadAt: string };

/** Alle, die mit diesem Emoji reagiert haben */
export type Reaction = { emoji: string; userIds: string[] };

/** Auswahl in der Reaktionsleiste – muss zur Liste im Backend passen */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;

export type CrewRole = 'owner' | 'member';

export type CrewSummary = {
  id: string;
  name: string;
  inviteCode: string;
  role: CrewRole;
  memberCount: number;
  unreadCount: number;
  /** Benachrichtigungen für diese Crew ausgeschaltet */
  muted: boolean;
  lastMessage?: {
    id?: string;
    text: string;
    sender: string;
    senderId?: string;
    hasImage?: boolean;
    hasAudio?: boolean;
    deleted?: boolean;
    createdAt: string;
  };
};

export type CrewMember = { id: string; name: string; role: CrewRole };

export type CrewDetail = CrewSummary & { members: CrewMember[] };

export type JoinAck = {
  ok: boolean;
  history?: ChatMessage[];
  /** Gibt es ältere Nachrichten zum Nachladen? */
  hasMore?: boolean;
  online?: ChatUser[];
  readStates?: ReadState[];
  error?: string;
};

export type SendAck = {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
};

export type ReadEvent = { crewId: string; userId: string; lastReadAt: string };
export type ReactionEvent = { crewId: string; messageId: string; reactions: Reaction[] };
export type TypingEvent = { crewId: string; userId: string; name: string; isTyping: boolean };
export type PresenceEvent = { crewId: string; online: ChatUser[] };
