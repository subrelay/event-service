import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SubstrateService } from '../substrate/substrate.service';
import { JobService } from './job.service';
import { CronJob } from 'cron';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => {
    return () => {
      return undefined;
    };
  },
  CronExpression: {
    EVERY_10_SECONDS: '',
  },
  SchedulerRegistry: {
    deleteCronJob: jest.fn(),
    doesExist: jest.fn(),
    addCronJob: jest.fn(),
  },
}));

describe('JobService', () => {
  let jobService: JobService;
  let schedulerRegistry: SchedulerRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
            doesExist: jest.fn(),
          },
        },
        {
          provide: SubstrateService,
          useValue: {
            monitorChain: jest.fn(),
          },
        },
      ],
    }).compile();

    jobService = module.get<JobService>(JobService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  describe('createChainWatcher', () => {
    it('should create a watcher for a new chain', async () => {
      const name = 'chain1';
      const rpc = 'http://localhost:1234';
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);

      await jobService.createChainWatcher(name, rpc);

      expect(schedulerRegistry.doesExist).toHaveBeenCalledWith('cron', name);
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        name,
        expect.any(CronJob),
      );
    });

    it('should not create a watcher if a chain watcher already exists', async () => {
      const name = 'chain1';
      const rpc = 'http://localhost:1234';
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(true);

      await jobService.createChainWatcher(name, rpc);

      expect(schedulerRegistry.doesExist).toHaveBeenCalledWith('cron', name);
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('chainWatcherExists', () => {
    it('should return true if the watcher exists in the scheduler registry', () => {
      const name = 'watcher1';
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(true);

      const result = jobService.chainWatcherExists(name);

      expect(schedulerRegistry.doesExist).toHaveBeenCalledWith('cron', name);
      expect(result).toBe(true);
    });

    it('should return false if the watcher does not exist in the scheduler registry', () => {
      const name = 'watcher2';
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);

      const result = jobService.chainWatcherExists(name);

      expect(schedulerRegistry.doesExist).toHaveBeenCalledWith('cron', name);
      expect(result).toBe(false);
    });
  });

  describe('stopChainWatcher', () => {
    it('should delete a watcher for a chain', () => {
      const name = 'chain1';

      jobService.stopChainWatcher(name);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(name);
    });
  });
});
