import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository } from '../db/repositories/UserRepository';
import type { DatabaseInstance } from '../db/database';
import logger from '../utils/logger';

export interface TwitterUserProfile {
  twitterId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface AuthResult {
  token: string;
  user: TwitterUserProfile;
}

export class AuthService {
  private userRepo: UserRepository;
  private jwtSecret: string;

  constructor(db: DatabaseInstance, jwtSecret?: string) {
    this.userRepo = new UserRepository(db);
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  }

  /**
   * Exchange an OAuth 2.0 authorization code for a Twitter access token,
   * fetch the user profile, upsert the user in DB, and return a signed JWT.
   */
  async exchangeCodeForUser(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
    clientSecret?: string;
  }): Promise<AuthResult> {
    // Step 1: Exchange code for access token
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Confidential clients must authenticate via Basic auth
    if (params.clientSecret) {
      const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
        code_verifier: params.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, body: errorBody }, 'Twitter token exchange failed');
      throw new Error('Twitter token exchange failed');
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
    };

    // Step 2: Fetch user profile
    const profileResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorBody = await profileResponse.text();
      logger.error({ status: profileResponse.status, body: errorBody }, 'Twitter profile fetch failed');
      throw new Error('Twitter profile fetch failed');
    }

    const profileData = await profileResponse.json() as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    const twitterUser = profileData.data;

    // Step 3: Upsert user in DB
    const userId = crypto.randomUUID();
    const userRow = this.userRepo.upsertByTwitterId({
      id: userId,
      twitterId: twitterUser.id,
      username: twitterUser.username,
      displayName: twitterUser.name,
      profileImageUrl: twitterUser.profile_image_url,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    });

    // Step 4: Sign JWT
    const token = this.signToken(userRow.id);

    return {
      token,
      user: {
        twitterId: twitterUser.id,
        username: twitterUser.username,
        displayName: twitterUser.name,
        profileImageUrl: twitterUser.profile_image_url ?? null,
      },
    };
  }

  /**
   * Verify a JWT and return the user profile from DB.
   */
  verifyAndGetUser(token: string): TwitterUserProfile | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { userId: string };
      const userRow = this.userRepo.findById(payload.userId);

      if (!userRow) return null;

      return {
        twitterId: userRow.twitter_id ?? '',
        username: userRow.username ?? '',
        displayName: userRow.display_name ?? '',
        profileImageUrl: userRow.profile_image_url,
      };
    } catch {
      return null;
    }
  }

  /**
   * Sign a JWT with the user ID.
   */
  private signToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '30d' });
  }
}
