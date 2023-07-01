import * as Bull from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApiPromise } from '@polkadot/api';
import { SubstrateService } from './substrate.service';

jest.mock('@nestjs/schedule', () => ({
  SchedulerRegistry: {
    doesExist: jest.fn(),
  },
}));
jest.mock('@nestjs/event-emitter', () => ({
  EventEmitter2: {
    emit: jest.fn(),
  },
  OnEvent: () => {
    return () => {
      return undefined;
    };
  },
}));

describe('SubstrateService', () => {
  let substrateService: SubstrateService;
  let schedulerRegistry: SchedulerRegistry;
  let api;
  const blockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    getJobCounts: jest.fn(),
    addBulk: jest.fn(),
  };
  const events = [
    {
      phase: {
        applyExtrinsic: 0,
        isApplyExtrinsic: false,
        asApplyExtrinsic: {
          eq: jest.fn().mockReturnValue(false),
        },
      },
      event: {
        index: '0x0000',
        data: [
          {
            weight: {
              refTime: 245267000,
              proofSize: 1493,
            },
            class: 'Mandatory',
            paysFee: 'Yes',
          },
        ],
      },
      topics: [],
    },
    {
      phase: {
        applyExtrinsic: 1,
        isApplyExtrinsic: true,
        asApplyExtrinsic: {
          eq: jest.fn().mockReturnValue(true),
        },
      },
      event: {
        index: '0x3501',
        data: [
          {
            descriptor: {},
            commitmentsHash:
              '0xfc75f21d3409b3b47dea6772b21086a5a72e17cd0622acd8f2ece1fed80d29d5',
          },
          '0x56617fc5c8b0422961e7b8619ddf720fa0163486c66f16d5bbad54a866ddef4beee4ee004a81377636e84a06c1dae2a04a15b6d11ce35c98470efa9cb880e91d15aba97e7aa05f88908f809a2e02408dd025345dc51c6d68ed89520d08c96d149f1d7791080661757261202aa362080000000005617572610101fee8fe85b8bb38f71a3f91e26e11cb484bc106aa86e9ac4ccea61f14b6b082348e489e3e38513d625649b9383ec592fa40469a6b1469508e8775519312c37d8d',
          3,
          31,
        ],
      },
      topics: [],
    },
  ];
  jest.mock('@polkadot/api', () => ({
    WsProvider: jest.fn(),
    ApiPromise: {
      create: jest.fn().mockImplementation(() => ({
        disconnect: jest.fn(),
        rpc: {
          chain: {
            getBlock: jest.fn().mockResolvedValue({
              block: {
                header: {
                  hash: '0x123123',
                },
              },
              extrinsics: [
                {
                  method: 'timestamp',
                  section: 'set',
                  args: [
                    {
                      toString: () => 121231231231,
                    },
                  ],
                },
              ],
            }),
          },
        },
        events: {
          system: {
            ExtrinsicSuccess: jest.fn().mockReturnValue(true),
          },
        },
        at: jest.fn().mockResolvedValue({
          events,
        }),
        query: {
          system: {
            events: jest.fn().mockResolvedValue(events),
          },
        },
      })),
    },
  }));
  const rpcUrl = 'wss://rpc.polkadot.io';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubstrateService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            doesExist: jest.fn(),
          },
        },
        { provide: Bull.getQueueToken('block'), useValue: blockQueue },
      ],
    }).compile();

    substrateService = module.get<SubstrateService>(SubstrateService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('createAPI', () => {
    it('should create an instance of ApiPromise', async () => {
      const apiPromise = await substrateService.createAPI(rpcUrl);
      expect(apiPromise).not.toBeUndefined();
      api = apiPromise;
    });
  });

  describe('getApiByName', () => {
    it('should return an existing API if found', async () => {
      const apiName = 'example';
      const existingApi = { api, name: apiName };
      substrateService['apiArray'] = [existingApi];

      const result = await substrateService.getApiByName(apiName, 'rpc');

      expect(result).toEqual(existingApi.api);
    });

    it('should create a new API if not found', async () => {
      const apiName = 'example';
      const rpc = 'rpc';
      substrateService['apiArray'] = [];
      jest.spyOn(substrateService, 'createAPI').mockResolvedValue(api);

      const result = await substrateService.getApiByName(apiName, rpc);

      expect(substrateService['apiArray']).toEqual([
        {
          api: result,
          name: apiName,
        },
      ]);
      expect(substrateService.createAPI).toHaveBeenCalledWith(rpc);
    });
  });

  describe('removeApi', () => {
    it('should remove the API with the specified name', () => {
      const apiName = 'example';
      const existingApi = { api: {} as any as ApiPromise, name: apiName };
      substrateService['apiArray'] = [existingApi];

      substrateService.removeApi(apiName);

      expect(substrateService['apiArray']).not.toContain(existingApi);
    });
  });

  describe('monitorChain', () => {
    const mockApi = {
      disconnect: jest.fn(),
      rpc: {
        chain: {
          subscribeFinalizedHeads: jest.fn().mockReturnThis(),
        },
      },
    } as any as ApiPromise;

    it('should emit ChainEvent.BLOCK_CREATED when the scheduler exists', async () => {
      const rpc = 'rpc';
      const chainId = 'example';
      jest
        .spyOn(substrateService, 'getApiByName')
        .mockResolvedValueOnce(mockApi);
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(true);

      await substrateService.monitorChain(rpc, chainId);

      expect(mockApi.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalled();
    });

    it('should disconnect from the API and remove it when the scheduler does not exist', async () => {
      const rpc = 'rpc';
      const chainId = 'example';
      jest.spyOn(substrateService, 'getApiByName').mockResolvedValue(mockApi);
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);

      await substrateService.monitorChain(rpc, chainId);

      expect(mockApi.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalled();
    });
  });

  describe('parseBlock', () => {
    it('should add the block to the event queue', async () => {
      const hash =
        '0xd31ce440eeaa6069bbfcf02ff9a84473014958958b46fa78a5b3301804a1186e';
      const chainId = 'polkadot';
      jest.spyOn(substrateService, 'getApiByName').mockResolvedValueOnce(api);
      jest.spyOn(blockQueue, 'add').mockResolvedValueOnce(undefined);

      await substrateService.parseBlock(rpcUrl, hash, chainId);

      expect(substrateService.getApiByName).toHaveBeenCalledWith(
        chainId,
        rpcUrl,
      );
      expect(blockQueue.add).toHaveBeenCalledWith(
        {
          chainId,
          timestamp: expect.any(Number),
          hash,
          success: expect.any(Boolean),
          events: expect.arrayContaining([
            {
              name: expect.any(String),
              data: expect.any(Array),
            },
          ]),
        },
        {
          removeOnComplete: true,
          removeOnFail: true,
          timeout: 5 * 60 * 1000,
          jobId: hash,
        },
      );
    });
  });
});
