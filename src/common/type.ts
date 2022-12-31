export enum ChainEvent {
  BLOCK_CREATED = 'chain.block_created',
}

export enum JobEvent {
  CREATE = 'job.create',
  DELETE_OUTDATED = 'job.deleteOutdated',
  READ_ALL = 'job.readAllJobs',
  DELETE_ALL = 'job.deleteAllJobs',
}

export enum JobName {
  WORKFLOW_MONITOR = 'workflow.monitor',
}
