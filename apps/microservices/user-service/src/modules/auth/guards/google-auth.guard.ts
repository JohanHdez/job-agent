import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Initiates the Google OAuth 2.0 redirect flow. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
