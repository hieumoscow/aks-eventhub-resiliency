import { config as dotenvConfig } from 'dotenv';
import express from 'express';
import { EventData } from '@azure/event-hubs';
import { EventHubManager, EventHubConfig } from './event-hub-client';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

dotenvConfig(); // Load environment variables from .env file

function getTimestamp(): string {
    return new Date().toISOString();
}

const app = express();
app.use(express.json()); // Add this after app initialization
const port = 8080;

// Initialize Event Hub client
const eventHubNamespace = process.env.EVENT_HUB_NAMESPACE;
const eventHubName = process.env.EVENT_HUB_NAME;

if (!eventHubNamespace || !eventHubName) {
    throw new Error('EVENT_HUB_NAMESPACE and EVENT_HUB_NAME environment variables are required');
}

const eventHubConfig: EventHubConfig = {
    name: eventHubName,
    fullyQualifiedNamespace: eventHubNamespace
};

const eventHubManager = new EventHubManager();
let eventCounter = 0;

let publishInterval: NodeJS.Timeout;
let isPublishing = false;

async function startAutomaticPublishing() {
    if (isPublishing) {
        console.log(`[${getTimestamp()}] Automatic publishing is already running`);
        return;
    }

    isPublishing = true;
    console.log(`[${getTimestamp()}] Starting automatic event publishing...`);

    // Publish events every 2 seconds
    publishInterval = setInterval(async () => {
        try {
            eventCounter++;
            const event: EventData = {
                body: {
                    id: `event-${eventCounter}`,
                    timestamp: getTimestamp(),
                    type: 'AUTO_EVENT',
                    message: `Automatic test event ${eventCounter}`
                },
                properties: {
                    source: 'auto-publisher',
                    eventNumber: eventCounter
                }
            };

            console.log(`[${getTimestamp()}] Publishing automatic event ${eventCounter}...`);
            await eventHubManager.publishEvent(event, eventHubConfig);
            console.log(`[${getTimestamp()}] Successfully published event ${eventCounter}`);

            // Simulate stale connection every 5 events
            if (eventCounter % 5 === 0) {
                console.log(`[${getTimestamp()}] Simulating stale connection...`);
                await eventHubManager.close();
                console.log(`[${getTimestamp()}] Forced client to become stale`);
            }

        } catch (error) {
            console.error(`[${getTimestamp()}] Error in automatic publishing:`, error);
        }
    }, 2000); // 2 seconds interval
}

// Start automatic publishing when the server starts
startAutomaticPublishing();

app.get('/health/live', async (req: express.Request, res: express.Response) => {
    try {
        const health = await eventHubManager.checkHealth(eventHubConfig);
        res.json({
            status: 'UP',
            checks: {
                eventHub: {
                    status: health.isHealthy ? 'UP' : 'DOWN',
                    details: health
                }
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(503).json({
            status: 'DOWN',
            error: errorMessage
        });
    }
});

app.get('/health/ready', async (req: express.Request, res: express.Response) => {
    try {
        const health = await eventHubManager.checkHealth(eventHubConfig);
        if (health.isHealthy) {
            res.json({ status: 'UP' });
        } else {
            res.status(503).json({
                status: 'DOWN',
                error: health.lastError
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(503).json({
            status: 'DOWN',
            error: errorMessage
        });
    }
});

app.post('/publish', async (req: express.Request, res: express.Response) => {
    try {
        eventCounter++;
        const message = req.body.message || `Test event ${eventCounter}`;
        
        console.log(`[${getTimestamp()}] Received publish request for message: ${message}`);
        
        const event: EventData = {
            body: {
                id: `event-${eventCounter}`,
                timestamp: getTimestamp(),
                type: 'TEST_EVENT',
                message: message,
                counter: eventCounter
            },
            properties: {
                source: 'test-service',
                eventNumber: eventCounter
            }
        };

        console.log(`[${getTimestamp()}] Publishing event ${eventCounter}...`);
        await eventHubManager.publishEvent(event, eventHubConfig);
        
        res.json({
            status: 'success',
            eventId: `event-${eventCounter}`,
            message: 'Event published successfully'
        });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error publishing event:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
            status: 'error',
            error: errorMessage
        });
    }
});

app.post('/simulate-stale', async (req, res) => {
    console.log(`[${getTimestamp()}] Simulating stale connection...`);
    
    // Close the current client to simulate a stale connection
    await eventHubManager.close();
    
    // Wait for 2 seconds
    await sleep(2000);
    
    // Try to publish a test event to verify recovery
    try {
        const event = {
            body: { message: "Recovery test event", timestamp: getTimestamp() },
            properties: { eventType: "recovery-test" }
        };
        
        await eventHubManager.publishEvent(event, eventHubConfig);
        console.log(`[${getTimestamp()}] Successfully recovered from stale connection`);
        res.json({ status: 'success', message: 'Successfully recovered from stale connection' });
    } catch (err) {
        console.error(`[${getTimestamp()}] Failed to recover from stale connection:`, err);
        res.status(500).json({ status: 'error', message: 'Failed to recover from stale connection' });
    }
});

app.post('/test-recovery', async (req, res) => {
    console.log(`[${getTimestamp()}] Starting stale connection recovery test...`);
    
    try {
        const initialEvent = {
            body: { message: "Initial test event", timestamp: getTimestamp() },
            properties: { eventType: "initial-test" }
        };
        await eventHubManager.publishEvent(initialEvent, eventHubConfig);
        console.log(`[${getTimestamp()}] Initial event published successfully`);
        
        console.log(`[${getTimestamp()}] Forcing client to become stale...`);
        await eventHubManager.close();
        
        console.log(`[${getTimestamp()}] Waiting for 5 seconds...`);
        await sleep(5000);
        
        const results = [];
        for (let i = 1; i <= 3; i++) {
            try {
                const event = {
                    body: { 
                        message: `Recovery test event ${i}`, 
                        timestamp: getTimestamp(),
                        sequence: i
                    },
                    properties: { eventType: "recovery-test" }
                };
                
                console.log(`[${getTimestamp()}] Attempting to publish recovery event ${i}...`);
                await eventHubManager.publishEvent(event, eventHubConfig);
                console.log(`[${getTimestamp()}] Successfully published recovery event ${i}`);
                
                results.push({
                    event: i,
                    status: 'success',
                    timestamp: getTimestamp()
                });
                
                await sleep(1000);
                
            } catch (err) {
                console.error(`[${getTimestamp()}] Failed to publish recovery event ${i}:`, err);
                results.push({
                    event: i,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Unknown error',
                    timestamp: getTimestamp()
                });
            }
        }
        
        const healthStatus = await eventHubManager.checkHealth(eventHubConfig);
        
        res.json({
            status: 'completed',
            results,
            finalHealth: healthStatus
        });
        
    } catch (err) {
        console.error(`[${getTimestamp()}] Test failed:`, err);
        res.status(500).json({
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
        });
    }
});

app.post('/auto-publish/start', (req, res) => {
    startAutomaticPublishing();
    res.json({ status: 'success', message: 'Automatic publishing started' });
});

app.post('/auto-publish/stop', (req, res) => {
    if (publishInterval) {
        clearInterval(publishInterval);
        isPublishing = false;
        console.log(`[${getTimestamp()}] Stopped automatic publishing`);
    }
    res.json({ status: 'success', message: 'Automatic publishing stopped' });
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal, cleaning up...');
    await eventHubManager.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`[${getTimestamp()}] Server running on port ${port}`);
});
