import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: ConfigService, useValue: { get: () => 'test' } },
        { provide: PrismaService, useValue: { $queryRaw: async () => [1] } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok when the database is reachable', async () => {
      const health = await appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.dependencies.database).toBe('up');
    });
  });
});
