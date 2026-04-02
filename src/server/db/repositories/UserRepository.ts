import type { DatabaseInstance } from '../database';

export interface UserRow {
  id: string;
  twitter_id: string | null;
  username: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  constructor(private db: DatabaseInstance) {}

  /**
   * Insert or update a user by Twitter ID.
   * Returns the user row.
   */
  upsertByTwitterId(params: {
    id: string;
    twitterId: string;
    username: string;
    displayName: string;
    profileImageUrl?: string;
    accessToken?: string;
    refreshToken?: string;
  }): UserRow {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, twitter_id, username, display_name, profile_image_url, access_token, refresh_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(twitter_id) DO UPDATE SET
        username = excluded.username,
        display_name = excluded.display_name,
        profile_image_url = excluded.profile_image_url,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        updated_at = excluded.updated_at
    `).run(
      params.id,
      params.twitterId,
      params.username,
      params.displayName,
      params.profileImageUrl ?? null,
      params.accessToken ?? null,
      params.refreshToken ?? null,
      now,
      now
    );

    return this.findByTwitterId(params.twitterId)!;
  }

  findById(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  findByTwitterId(twitterId: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE twitter_id = ?').get(twitterId) as UserRow | undefined;
  }
}
