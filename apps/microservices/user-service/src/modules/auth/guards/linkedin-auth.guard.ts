import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Initiates the LinkedIn OAuth 2.0 redirect flow. */
@Injectable()
export class LinkedInAuthGuard extends AuthGuard('linkedin') {}
