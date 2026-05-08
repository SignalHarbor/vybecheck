import type { WebSocket } from 'ws';

export interface Participant {
  id: string;                    // e.g., "123Abc"
  username: string | null;       // null for anonymous, later tied to Twitter
  connection: WebSocket | null;  // null for async participants
  isOwner: boolean;              // true if this participant created the quiz
  joinedAt: Date;
  lastActiveAt: Date;
  isActive: boolean;             // currently connected
  profileImageUrl: string | null; // Twitter profile picture, null for guests
}
