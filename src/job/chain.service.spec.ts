import { Test, TestingModule } from '@nestjs/testing';
import { ChainService } from './chain.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as Axios from 'axios';
import { JobEvent } from '../common/type';
import * as CommonUtil from '../common/common.util';

jest.mock('../common/common.util');
jest.mock('@nestjs/event-emitter');
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));
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
    getCronJobs: jest.fn(),
  },
}));

describe('ChainService', () => {
  let chainService: ChainService;
  let eventEmitter: EventEmitter2;
  let schedulerRegistry: SchedulerRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        SchedulerRegistry,
        {
          provide: SchedulerRegistry,
          useValue: {
            getCronJobs: jest.fn(),
          },
        },
      ],
    }).compile();

    chainService = module.get<ChainService>(ChainService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should emit JobEvent.CREATE for new jobs', async () => {
    const chains = [
      { chainId: 'chain1', rpc: 'rpc1' },
      { chainId: 'chain2', rpc: 'rpc2' },
    ];
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    jest.spyOn(chainService, 'getChains').mockResolvedValue(chains);
    jest
      .spyOn(schedulerRegistry, 'getCronJobs')
      .mockReturnValue([['chain2']] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).toHaveBeenCalledWith(JobEvent.CREATE, 'chain1', 'rpc1');
    expect(emitSpy).not.toHaveBeenCalledWith(
      JobEvent.STOP,
      expect.anything(),
      expect.anything(),
    );
  });

  it('should emit JobEvent.STOP for deleted jobs', async () => {
    const chains = [{ chainId: 'chain1', rpc: 'rpc1' }];
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    jest.spyOn(chainService, 'getChains').mockResolvedValue(chains);
    jest
      .spyOn(schedulerRegistry, 'getCronJobs')
      .mockReturnValue([['chain2'], ['chain1']] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).toHaveBeenCalledWith(JobEvent.STOP, 'chain2');
  });

  it('should emit JobEvent.STOP when there are no chains', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    jest.spyOn(chainService, 'getChains').mockResolvedValue([]);
    jest
      .spyOn(schedulerRegistry, 'getCronJobs')
      .mockReturnValue([['chain2']] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).toHaveBeenCalledWith(JobEvent.STOP, 'chain2');
  });

  it('should emit JobEvent.CREATE when there are no current jobs', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    jest
      .spyOn(chainService, 'getChains')
      .mockResolvedValue([{ chainId: 'chain1', rpc: 'rpc1' }]);
    jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue([[]] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).toHaveBeenCalledWith(JobEvent.CREATE, 'chain1', 'rpc1');
  });

  it('should not delete monitor job', async () => {
    const chains = [{ chainId: 'chain1', rpc: 'rpc1' }];
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    jest.spyOn(chainService, 'getChains').mockResolvedValue(chains);
    jest
      .spyOn(schedulerRegistry, 'getCronJobs')
      .mockReturnValue([['chain1'], ['monitor']] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).not.toHaveBeenCalledWith(JobEvent.STOP, 'monitor');
  });

  it('should not not create or delete existing job', async () => {
    const chains = [{ chainId: 'chain1', rpc: 'rpc1' }];
    const emitSpy = jest.spyOn(eventEmitter, 'emit');
    jest.spyOn(chainService, 'getChains').mockResolvedValue(chains);
    jest
      .spyOn(schedulerRegistry, 'getCronJobs')
      .mockReturnValue([['chain1']] as any);

    await chainService.monitorWorkers();

    expect(emitSpy).not.toHaveBeenCalledWith(JobEvent.STOP, 'chain1');
    expect(emitSpy).not.toHaveBeenCalledWith(
      JobEvent.CREATE,
      'chain1',
      expect.anything(),
    );
  });

  it('should return chains', async () => {
    const expectedChains = [{ chainId: 'chain1', rpc: 'rpc1' }];
    jest
      .spyOn(Axios.default, 'get')
      .mockResolvedValue({ data: expectedChains });

    const chains = await chainService.getChains();

    expect(chains).toEqual(expectedChains);
  });

  it('should handle error when unable to connect to API', async () => {
    const error = new Error('Network error');
    jest.spyOn(Axios.default, 'get').mockRejectedValue(error);
    const notifyErrorSpy = jest.spyOn(CommonUtil, 'notifyError');

    await chainService.getChains();

    expect(notifyErrorSpy).toHaveBeenCalledWith(error);
  });
});
