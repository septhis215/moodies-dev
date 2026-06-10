// src/auth/strategies/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Must be env-driven — a hardcoded localhost callback breaks (and is unsafe
      // to assume in) any non-local deployment.
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:4000/auth/google/callback',
      scope: [
        'openid',
        'profile',
        'email', 
      ],
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    const email =
      profile.emails?.[0]?.value || (profile as any)._json?.email;

    const user = {
      email,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      provider: 'google',
      googleId: profile.id,
      accessToken,
    };

    return done(null, user);
  }
}
