import { Queue } from 'bullmq';
import { redis } from './redis';

const globalForAutomation = globalThis as unknown as {
  automationQueue: Queue | undefined;
};

export const automationQueue =
  globalForAutomation.automationQueue ??
  new Queue('automation', {
    connection: redis,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForAutomation.automationQueue = automationQueue;
}
