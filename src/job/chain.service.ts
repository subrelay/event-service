import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobEvent } from '../common/type';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { find } from 'lodash';
import { notifyError } from '../common/common.util';
import * as axios from 'axios';

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'monitor',
  })
  async monitorWorkers() {
    this.logger.debug('Checking chains are ready to monitor');
    const chains = await this.getChains();

    const jobNames = [];

    for (const [name] of this.schedulerRegistry.getCronJobs()) {
      console.log({ name });

      if (name !== 'monitor') {
        const chain = find(chains, { chainId: name });
        if (!chain) {
          this.eventEmitter.emit(JobEvent.STOP, name);
        } else {
          jobNames.push(name);
        }
      }
    }

    chains.forEach((chain) => {
      if (!jobNames.includes(chain.chainId)) {
        this.eventEmitter.emit(JobEvent.CREATE, chain.chainId, chain.rpc);
      }
    });
  }

  async getChains() {
    const chains = [];
    try {
      const rs = await axios.default.get(
        `${process.env.API_BASE_URL}/workers`,
        {
          maxRedirects: 3,
          timeout: 2000,
        },
      );

      chains.push(...rs.data);
    } catch (error) {
      this.logger.debug('Can not to connect to API', error);
      await notifyError(error as Error);
    }

    return chains;
  }
}
