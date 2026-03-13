import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module.js';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema.js';
import { ProfilesService } from './profiles.service.js';
import { ProfilesController } from './profiles.controller.js';

/**
 * ProfilesModule wires the UserProfile Mongoose model, ProfilesService,
 * and ProfilesController together.
 *
 * Imports UsersModule so ProfilesController can call UsersService.findById
 * to retrieve the encrypted LinkedIn access token before import.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    UsersModule,
  ],
  providers: [ProfilesService],
  controllers: [ProfilesController],
})
export class ProfilesModule {}
