import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service.js';
import { User } from './schemas/user.schema.js';

/**
 * UsersService unit test stubs — Phase 2, Wave 0.
 * All it.todo() tests will be implemented in Plan 03 (Users extensions).
 */
describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  // Implement in Plan 03 (Users extensions)
  it.todo('AUTH-04: updateProfile updates name/email/language and returns updated document');

  // Implement in Plan 03 (Users extensions)
  it.todo('SRCH-01: createPreset stores all AppConfig fields and returns the preset');

  // Implement in Plan 03 (Users extensions)
  it.todo('SRCH-02: createPreset throws ConflictException when user already has 5 presets');

  // Implement in Plan 03 (Users extensions)
  it.todo('SRCH-02: setActivePreset updates activePresetId on User document');
});
