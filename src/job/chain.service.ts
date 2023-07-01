import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobEvent } from '../common/type';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { find, isEmpty } from 'lodash';
import { notifyError } from '../common/common.util';
import * as axios from 'axios';

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'monitor',
  })
  async monitorWorkers() {
    this.logger.debug('Checking chains are ready to monitor');
    const chains = await this.getChains();

    let newJobs = [];
    let deletedJobs = [];

    const currentJobs = [];
    for (const [name] of this.schedulerRegistry.getCronJobs()) {
      if (name !== 'monitor') {
        currentJobs.push(name);
      }
    }

    if (isEmpty(currentJobs) && !isEmpty(chains)) {
      newJobs = chains;
    }

    if (!isEmpty(currentJobs) && isEmpty(chains)) {
      deletedJobs = currentJobs;
    }

    if (!isEmpty(currentJobs) && !isEmpty(chains)) {
      deletedJobs = currentJobs.filter((e) => !find(chains, { chainId: e }));
      newJobs = chains.filter((c) => !currentJobs.includes(c.chainId));
    }

    newJobs.forEach((chain) => {
      this.eventEmitter.emit(JobEvent.CREATE, chain.chainId, chain.rpc);
    });

    deletedJobs.forEach((name) => {
      this.eventEmitter.emit(JobEvent.STOP, name);
    });
  }

  async getChains() {
    const chains = [];
    try {
      const rs = await axios.default.get(
        `${process.env.API_BASE_URL}/workers`,
        {
          maxRedirects: 3,
          timeout: 3000,
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
