import { EventHubProducerClient, EventData } from "@azure/event-hubs";
import { DefaultAzureCredential } from "@azure/identity";
import { v4 as uuidv4 } from 'uuid';

function getTimestamp(): string {
    return new Date().toISOString();
}

export interface EventHubConfig {
  name: string;
  fullyQualifiedNamespace: string;
}

interface PublishOptions {
  partitionKey?: string;
}

interface CustomEventData {
  body: any;
  properties: {
    id: string;
    timestamp: string;
  };
  partitionKey?: string;
}

interface HealthCheckResult {
  isHealthy: boolean;
  lastError: string | null;
  isConnected: boolean;
  totalEventsPublished: number;
  lastClientCreation: string | null;
}

interface PublishResult {
  success: boolean;
  error?: string;
  reason?: string;
}

export class EventHubManager {
  private client: EventHubProducerClient | null = null;
  private readonly credential: DefaultAzureCredential;
  private lastError: Error | null = null;
  private lastClientCreation: Date | null = null;
  private totalEventsPublished: number = 0;
  private isConnected: boolean = false;
  private readonly maxMessages: number;

  constructor() {
    this.credential = new DefaultAzureCredential();
    this.maxMessages = parseInt(process.env.MAX_MESSAGES || '30', 10);
  }

  private async createClient(config: EventHubConfig): Promise<EventHubProducerClient> {
    console.log(`[${getTimestamp()}] Creating new Event Hub client for ${config.fullyQualifiedNamespace}/${config.name}`);
    
    try {
      const client = new EventHubProducerClient(
        config.fullyQualifiedNamespace,
        config.name,
        this.credential
      );

      // Test the connection
      await client.getEventHubProperties();
      
      this.lastClientCreation = new Date();
      this.isConnected = true;
      this.lastError = null;
      return client;
    } catch (err) {
      this.isConnected = false;
      this.lastError = err instanceof Error ? err : new Error('Unknown error occurred');
      throw this.lastError;
    }
  }

  private async getClient(config: EventHubConfig): Promise<EventHubProducerClient> {
    if (!this.client || !this.isConnected) {
      if (this.client) {
        try {
          await this.client.close();
        } catch (err) {
          console.warn(`[${getTimestamp()}] Error closing stale client:`, err);
        }
      }
      this.client = await this.createClient(config);
    }
    return this.client;
  }

  async publish(
    config: EventHubConfig,
    data: any,
    options: PublishOptions = {}
  ): Promise<boolean> {
    try {
      if (this.totalEventsPublished >= this.maxMessages) {
        console.log(`[${getTimestamp()}] Maximum message limit (${this.maxMessages}) reached. Message rejected.`);
        return false;
      }

      const event: CustomEventData = {
        body: data,
        properties: {
          id: uuidv4(),
          timestamp: getTimestamp()
        }
      };

      if (options.partitionKey) {
        event.partitionKey = options.partitionKey;
      }

      const result = await this.publishEvent(event as EventData, config);
      return result.success;
    } catch (err) {
      console.error('Error publishing event:', err);
      return false;
    }
  }

  async publishEvent(event: EventData, config: EventHubConfig): Promise<PublishResult> {
    try {
      if (this.totalEventsPublished >= this.maxMessages) {
        console.log(`[${getTimestamp()}] Maximum message limit (${this.maxMessages}) reached. Message rejected.`);
        return {
          success: false,
          reason: 'MAX_MESSAGES_REACHED',
          error: `Maximum message limit (${this.maxMessages}) reached`
        };
      }

      console.log(`[${getTimestamp()}] Attempting to publish event to ${config.fullyQualifiedNamespace}/${config.name}`);
      const client = await this.getClient(config);
      const batch = await client.createBatch();
      
      if (!batch.tryAdd(event)) {
        console.error(`[${getTimestamp()}] Event too large to fit in a batch`);
        return {
          success: false,
          reason: 'EVENT_TOO_LARGE',
          error: 'Event too large to fit in a batch'
        };
      }

      console.log(`[${getTimestamp()}] Publishing event batch to Event Hub`);
      await client.sendBatch(batch);
      console.log(`[${getTimestamp()}] Successfully published event. Total events published: ${this.totalEventsPublished + 1}`);
      
      this.totalEventsPublished++;
      this.isConnected = true;
      this.lastError = null;
      
      return { success: true };
    } catch (err) {
      this.isConnected = false;
      this.lastError = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error(`[${getTimestamp()}] Error publishing event:`, err);
      return {
        success: false,
        reason: 'PUBLISH_ERROR',
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  async checkHealth(config: EventHubConfig): Promise<HealthCheckResult> {
    try {
      if (this.client) {
        // Test connection by getting properties
        await this.client.getEventHubProperties();
        this.isConnected = true;
      } else {
        await this.getClient(config);
      }
    } catch (err) {
      this.isConnected = false;
      this.lastError = err instanceof Error ? err : new Error('Unknown error occurred');
    }

    return {
      isHealthy: this.isConnected && !this.lastError,
      lastError: this.lastError?.message || null,
      totalEventsPublished: this.totalEventsPublished,
      lastClientCreation: this.lastClientCreation?.toISOString() || null,
      isConnected: this.isConnected
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Create and export a singleton instance
export const eventHubManager = new EventHubManager();

// Export a simplified publish function
export async function publish(
  config: EventHubConfig,
  data: any,
  options: PublishOptions = {}
): Promise<boolean> {
  return eventHubManager.publish(config, data, options);
}
