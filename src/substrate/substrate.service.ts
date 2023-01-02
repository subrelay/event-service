import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChainEvent } from 'src/common/type';

@Injectable()
export class SubstrateService implements OnModuleInit {
  private readonly logger = new Logger(SubstrateService.name);
  constructor(
    @InjectQueue('block') private eventQueue: Queue,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {}

  async sendEvent(payload: any) {
    return this.eventQueue.add(payload);
  }

  async createAPI(rpc: string): Promise<ApiPromise> {
    const wsProvider = new WsProvider(rpc);
    return await ApiPromise.create({ provider: wsProvider });
  }

  async subscribeNewHeads(rpc: string, chainId: string, chainUuid: string) {
    const wsProvider = new WsProvider(rpc);
    const api = await ApiPromise.create({ provider: wsProvider });
    await api.rpc.chain.subscribeFinalizedHeads((lastHeader) => {
      this.eventEmitter.emit(
        ChainEvent.BLOCK_CREATED,
        rpc,
        lastHeader.hash as unknown as string,
        chainId,
        chainUuid,
      );
    });

    return true;
  }

  @OnEvent(ChainEvent.BLOCK_CREATED)
  async parseBlock(
    rpc: string,
    hash: string,
    chainId: string,
    chainUuid: string,
  ) {
    this.logger.debug(`[${chainId}] BLOCK.CREATED ${hash}`);

    const api = await this.createAPI(rpc);
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
        chainUuid,
        timestamp,
        hash,
        success,
        events: allRecords.map((record) => ({
          pallet: record.event.section,
          name: record.event.method,
          data: record.event.data,
          hash: record.event.hash,
        })),
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
        timeout: 5 * 60 * 1000, // 10 minutes
        jobId: `${chainUuid}_${hash}`,
      },
    );

    this.logger.debug(`[${chainId}] Sent block to block queue`);
  }
}
