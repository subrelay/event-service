import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChainEvent } from '../common/type';
import { SchedulerRegistry } from '@nestjs/schedule';

@Injectable()
export class SubstrateService {
  private readonly logger = new Logger(SubstrateService.name);
  private apiArray: { api: ApiPromise; name: string }[] = [];

  constructor(
    @InjectQueue('block') private eventQueue: Queue,
    private eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.apiArray = [];
  }

  async getApiByName(name: string, rpc: string) {
    let api = this.apiArray.find((api) => api.name === name)?.api;
    if (!api) {
      api = await this.createAPI(rpc);
      this.apiArray.push({ api, name });
    }

    return api;
  }

  removeApi(name: string) {
    this.apiArray = this.apiArray.filter((api) => api.name !== name);
  }

  async monitorChain(rpc: string, chainId: string) {
    const api = await this.getApiByName(chainId, rpc);
    const unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(
      async (lastHeader) => {
        if (this.schedulerRegistry.doesExist('cron', chainId)) {
          this.eventEmitter.emit(
            ChainEvent.BLOCK_CREATED,
            rpc,
            lastHeader.hash as unknown as string,
            chainId,
          );
        } else {
          unsubscribe();
          await api.disconnect();
          this.removeApi(chainId);
        }
      },
    );
  }

  async createAPI(rpc: string): Promise<ApiPromise> {
    const wsProvider = new WsProvider(rpc, 10, {}, 5000);
    return await ApiPromise.create({ provider: wsProvider });
  }

  @OnEvent(ChainEvent.BLOCK_CREATED)
  async parseBlock(rpc: string, hash: string, chainId: string) {
    const api = await this.getApiByName(chainId, rpc);
    const [signedBlock, apiAt] = await Promise.all([
      api.rpc.chain.getBlock(hash),
      api.at(hash),
    ]);

    const { extrinsics } = signedBlock.block || {};

    const allRecords =
      (await apiAt.query.system.events()) as unknown as EventRecord[];

    const timestampArgs = extrinsics
      .map((e) => e.method)
      .find((m) => m.section === 'timestamp' && m.method === 'set');
    const timestamp = Number(timestampArgs?.args[0].toString()) || Date.now();

    let success = true;
    extrinsics.forEach((_, index) => {
      allRecords
        .filter(
          ({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index),
        )
        .forEach(({ event }) => {
          success = api.events.system.ExtrinsicSuccess.is(event);
        });
    });

    await this.eventQueue.add(
      {
        chainId,
        timestamp,
        hash,
        success,
        events: allRecords.map((record) => ({
          name: `${record.event.section}.${record.event.method}`,
          data: record.event.data,
        })),
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
        timeout: 5 * 60 * 1000, // 10 minutes
        jobId: hash,
      },
    );

    this.logger.debug(`[${chainId}] Sent block to block queue.`);
  }
}
