const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dmsClientChannel = require('dms-client-channel');

// Load environment variables
try {
  require('dotenv').config();
  console.log('Environment variables loaded from .env file');
} catch (error) {
  console.log('No .env file found, using process environment variables');
}

// ========== SERVICE EXECUTION LOGGING SYSTEM ==========
const serviceLogs = [];
const MAX_LOGS = 1000; // Keep last 1000 log entries

// Logging utility function
function logServiceExecution(service, action, details = {}) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    service: service,
    action: action,
    details: details,
    level: details.level || 'info'
  };
  
  // Add to logs array
  serviceLogs.push(logEntry);
  
  // Keep only the last MAX_LOGS entries
  if (serviceLogs.length > MAX_LOGS) {
    serviceLogs.shift();
  }
  
  // Also log to console with formatting
  const timestamp = new Date().toISOString();
  const level = logEntry.level.toUpperCase().padEnd(5);
  const serviceName = service.padEnd(20);
  const actionName = action.padEnd(25);
  
  console.log(`\n[${timestamp}] [${level}] [${serviceName}] [${actionName}]`);
  if (details.message) {
    console.log(`  Message: ${details.message}`);
  }
  if (details.data) {
    console.log(`  Data:`, JSON.stringify(details.data, null, 2));
  }
  if (details.error) {
    console.log(`  Error:`, details.error);
    if (details.stack) {
      console.log(`  Stack:`, details.stack);
    }
  }
  if (details.duration !== undefined) {
    console.log(`  Duration: ${details.duration}ms`);
  }
  console.log(`  ──────────────────────────────────────────────────────────────`);
  
  return logEntry;
}

// Helper to log API requests
function logApiRequest(req, res, next) {
  const startTime = Date.now();
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  req.requestId = requestId;
  
  logServiceExecution(
    'API',
    req.method + ' ' + req.path,
    {
      level: 'info',
      message: 'Incoming API request',
      data: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined
      },
      requestId: requestId
    }
  );
  
  // Log response when it finishes
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'API',
      req.method + ' ' + req.path,
      {
        level: res.statusCode >= 400 ? 'error' : 'info',
        message: 'API response sent',
        data: {
          statusCode: res.statusCode,
          responseSize: data ? data.length : 0
        },
        duration: duration,
        requestId: requestId
      }
    );
    return originalSend.call(this, data);
  };
  
  next();
}

// Load environment variables or use defaults
const PORT = process.env.PORT || 3000;
const DMS_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || '',
  CHANNEL_ID: process.env.CHANNEL_ID || '',
  API_URL: process.env.API_URL || '',
  WEBHOOK_URL: process.env.WEBHOOK_URL || ''
};

// Initialize the app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(logApiRequest); // Add logging middleware
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DMS Client Channel
let dms = dmsClientChannel(DMS_CONFIG);

// Setup DMS callback handlers
dms.onTextMessage = async (message) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onTextMessage',
    {
      level: 'info',
      message: 'Text message callback received from DMS',
      data: message
    }
  );
  
  try {
    // If this message has a message_id, mark it as delivered
    if (message && message.message_id) {
      pendingMessages.set(message.message_id, 'delivered');
      logServiceExecution(
        'DMS_CALLBACK',
        'onTextMessage',
        {
          level: 'info',
          message: `Message ${message.message_id} marked as delivered`,
          data: { message_id: message.message_id }
        }
      );
    }
    
    // Store incoming messages to be fetched by clients
    const stored = storeIncomingMessage(message);
    const duration = Date.now() - startTime;
    
    logServiceExecution(
      'DMS_CALLBACK',
      'onTextMessage',
      {
        level: stored ? 'info' : 'warn',
        message: stored ? 'Text message stored successfully' : 'Text message was duplicate, not stored',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onTextMessage',
      {
        level: 'error',
        message: 'Error processing text message callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

dms.onRichContentMessage = async (message) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onRichContentMessage',
    {
      level: 'info',
      message: 'Rich content message callback received from DMS',
      data: message
    }
  );
  
  try {
    // If this message has a message_id, mark it as delivered
    if (message && message.message_id) {
      pendingMessages.set(message.message_id, 'delivered');
    }
    
    const stored = storeIncomingMessage(message);
    const duration = Date.now() - startTime;
    
    logServiceExecution(
      'DMS_CALLBACK',
      'onRichContentMessage',
      {
        level: stored ? 'info' : 'warn',
        message: stored ? 'Rich content message stored successfully' : 'Rich content message was duplicate',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onRichContentMessage',
      {
        level: 'error',
        message: 'Error processing rich content message callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

dms.onUrlLinkMessage = async (message) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onUrlLinkMessage',
    {
      level: 'info',
      message: 'URL link message callback received from DMS',
      data: message
    }
  );
  
  try {
    if (message && message.message_id) {
      pendingMessages.set(message.message_id, 'delivered');
    }
    
    const stored = storeIncomingMessage(message);
    const duration = Date.now() - startTime;
    
    logServiceExecution(
      'DMS_CALLBACK',
      'onUrlLinkMessage',
      {
        level: stored ? 'info' : 'warn',
        message: stored ? 'URL link message stored successfully' : 'URL link message was duplicate',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onUrlLinkMessage',
      {
        level: 'error',
        message: 'Error processing URL link message callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

dms.onTypingIndicator = async (customerId) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onTypingIndicator',
    {
      level: 'info',
      message: 'Typing indicator callback received from DMS',
      data: { customer_id: customerId }
    }
  );
  
  try {
    // Store typing indicator event
    incomingMessages.push({
      type: 'typing_indicator',
      customer_id: customerId,
      timestamp: new Date().toISOString()
    });
    
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onTypingIndicator',
      {
        level: 'info',
        message: 'Typing indicator stored successfully',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onTypingIndicator',
      {
        level: 'error',
        message: 'Error processing typing indicator callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

dms.onCsrEndSession = async (customerId) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onCsrEndSession',
    {
      level: 'info',
      message: 'CSR end session callback received from DMS',
      data: { customer_id: customerId }
    }
  );
  
  try {
    // Store end session event
    incomingMessages.push({
      type: 'end_session',
      customer_id: customerId,
      timestamp: new Date().toISOString()
    });
    
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onCsrEndSession',
      {
        level: 'info',
        message: 'End session event stored successfully',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onCsrEndSession',
      {
        level: 'error',
        message: 'Error processing CSR end session callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

// Add a new handler for menu messages
dms.onMenuMessage = async (message) => {
  const startTime = Date.now();
  logServiceExecution(
    'DMS_CALLBACK',
    'onMenuMessage',
    {
      level: 'info',
      message: 'Menu message callback received from DMS',
      data: message
    }
  );
  
  try {
    if (message && message.message_id) {
      pendingMessages.set(message.message_id, 'delivered');
    }
    
    const stored = storeIncomingMessage(message);
    const duration = Date.now() - startTime;
    
    logServiceExecution(
      'DMS_CALLBACK',
      'onMenuMessage',
      {
        level: stored ? 'info' : 'warn',
        message: stored ? 'Menu message stored successfully' : 'Menu message was duplicate',
        duration: duration
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'DMS_CALLBACK',
      'onMenuMessage',
      {
        level: 'error',
        message: 'Error processing menu message callback',
        error: error.message,
        stack: error.stack,
        duration: duration
      }
    );
  }
};

// Create a messages map to track sent messages for delivery confirmation
const pendingMessages = new Map();

// Create a store for incoming messages to be polled by clients
const incomingMessages = [];

// ADD: Message deduplication tracking
const processedMessageIds = new Set();
const messageIdToStoredIndex = new Map(); // Track where messages are stored for updates

// Helper function to store incoming messages
function storeIncomingMessage(message) {
  const startTime = Date.now();
  logServiceExecution(
    'MESSAGE_STORAGE',
    'storeIncomingMessage',
    {
      level: 'info',
      message: 'Attempting to store incoming message',
      data: {
        message_id: message.message_id,
        type: message.type,
        customer_id: message.customer_id
      }
    }
  );
  
  // CRITICAL FIX: Only check for duplicates on messages with the same customer_id AND type
  // Don't block DMS responses which are legitimate new messages
  if (message.message_id && processedMessageIds.has(message.message_id)) {
    // Allow DMS responses even if they have the same message_id as our outgoing messages
    // Only block true duplicates (same message_id AND same direction/source)
    const existingMessageIndex = messageIdToStoredIndex.get(message.message_id);
    if (existingMessageIndex !== undefined) {
      const existingMessage = incomingMessages[existingMessageIndex];
      // Only block if it's truly the same message (same content and source)
      if (existingMessage && 
          existingMessage.text === message.text && 
          existingMessage.type === message.type &&
          existingMessage.customer_id === message.customer_id) {
        const duration = Date.now() - startTime;
        logServiceExecution(
          'MESSAGE_STORAGE',
          'storeIncomingMessage',
          {
            level: 'warn',
            message: `True duplicate detected: ${message.message_id}. Skipping storage.`,
            duration: duration
          }
        );
        return false;
      }
    }
    // If we get here, it's probably a DMS response with the same ID but different content
    logServiceExecution(
      'MESSAGE_STORAGE',
      'storeIncomingMessage',
      {
        level: 'info',
        message: `Allowing message with existing ID (likely DMS response): ${message.message_id}`
      }
    );
  }

  // Add timestamp if not present
  if (!message.timestamp) {
    message.timestamp = new Date().toISOString();
  }
  
  // CRITICAL: Handle Pega message format
  // This is specifically for the message format we saw from the clipboard
  if (message.pyEntryText && typeof message.pyEntryText === 'string') {
    try {
      // Try to parse the JSON text that Pega sends
      const parsedText = JSON.parse(message.pyEntryText);
      
      // Create a more standard message format
      if (parsedText.text) {
        message.text = Array.isArray(parsedText.text) ? parsedText.text : [parsedText.text];
      }
      
      console.log(`Successfully parsed Pega message: ${JSON.stringify(message.text)}`);
    } catch (e) {
      // If not JSON, just use it as is
      message.text = [message.pyEntryText];
      console.log(`Using plain text from Pega: ${message.pyEntryText}`);
    }
  }
  
  // CRITICAL: Link Pega's UUID back to our logical ID
  if (message.pyCustomerId === '4cf33b5e963c45eb90cc2b99892844fc') {
    // This is a Pega message for user "TestClient"
    message.customer_id = 'TestClient';
    console.log(`Mapped Pega UUID to TestClient`);
  }

  // CRITICAL: For messages from Pega with a customer.id field, add customer_id
  if (message.customer && message.customer.id && !message.customer_id) {
    // Handle the specific UUID mapping for TestClient
    if (message.customer.id === '4cf33b5e963c45eb90cc2b99892844fc') {
      message.customer_id = 'TestClient';
      console.log(`Mapped Pega customer UUID to TestClient`);
    }
    // Handle the new UUID from the working logs - map to "Test"
    else if (message.customer.id === '4505811de7cf4ac6b310a8109ab11869') {
      message.customer_id = 'Test';
      console.log(`Mapped Pega customer UUID to Test`);
    }
    else {
      message.customer_id = message.customer.id;
      console.log(`Used customer UUID as customer_id: ${message.customer.id}`);
    }
  }
  
  // CRITICAL: Handle profile_id mapping - this is the most important one!
  if (message.customer && message.customer.profile_id && !message.customer_id) {
    message.customer_id = message.customer.profile_id;
    console.log(`Mapped customer profile_id to customer_id: ${message.customer.profile_id}`);
  }
  
  // CRITICAL: If we still don't have customer_id but have profile_id, use it as backup
  if (!message.customer_id && message.customer && message.customer.profile_id) {
    message.customer_id = message.customer.profile_id;
    console.log(`Using profile_id as fallback customer_id: ${message.customer.profile_id}`);
  }
  
  // Add the message to our store
  const messageIndex = incomingMessages.length;
  incomingMessages.push(message);
  
  // Track this message ID as processed (but allow DMS responses)
  if (message.message_id) {
    processedMessageIds.add(message.message_id);
    messageIdToStoredIndex.set(message.message_id, messageIndex);
  }
  
  const duration = Date.now() - startTime;
  logServiceExecution(
    'MESSAGE_STORAGE',
    'storeIncomingMessage',
    {
      level: 'info',
      message: `Stored NEW message for customer: ${message.customer_id}`,
      data: {
        message_id: message.message_id,
        message_content: message.text || message.pyEntryText || 'No text',
        total_stored_messages: incomingMessages.length
      },
      duration: duration
    }
  );
  
  return true; // Indicate message was stored successfully
}

// API endpoint to send messages
app.post('/api/messages', (req, res) => {
  const startTime = Date.now();
  const { customerId, messageId, text, customerName, advancedPayload } = req.body;
  
  logServiceExecution(
    'API_MESSAGES',
    'POST /api/messages',
    {
      level: 'info',
      message: 'Processing message send request',
      data: {
        customerId: customerId,
        messageId: messageId,
        hasAdvancedPayload: !!advancedPayload,
        hasText: !!text
      }
    }
  );
  
  if (!customerId || !messageId) {
    logServiceExecution(
      'API_MESSAGES',
      'POST /api/messages',
      {
        level: 'error',
        message: 'Missing required fields: customerId and messageId',
        duration: Date.now() - startTime
      }
    );
    return res.status(400).json({ error: 'Missing required fields: customerId and messageId' });
  }
  
  let messageObject;
  
  // Check if this is an advanced payload request
  if (advancedPayload) {
    logServiceExecution(
      'API_MESSAGES',
      'POST /api/messages',
      {
        level: 'info',
        message: 'Processing advanced payload',
        data: advancedPayload
      }
    );
    
    // Use the advanced payload directly (it's already in the correct Pega format)
    messageObject = advancedPayload;
    
    // Ensure required fields are present
    if (!messageObject.customer_id) messageObject.customer_id = customerId;
    if (!messageObject.message_id && messageObject.type !== 'typing_indicator' && messageObject.type !== 'customer_end_session') {
      messageObject.message_id = messageId;
    }
    if (!messageObject.timestamp) messageObject.timestamp = new Date().toISOString();
    
  } else {
    // Standard text message (backward compatibility)
    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }
    
    messageObject = {
      type: 'text',
      customer_id: customerId,
      message_id: messageId,
      text: Array.isArray(text) ? text : [text],
      customer_name: customerName || 'Customer',
      timestamp: new Date().toISOString()
    };
  }
  
  logServiceExecution(
    'DMS_SEND',
    'sendMessage',
    {
      level: 'info',
      message: 'Sending message to DMS',
      data: {
        customer_id: messageObject.customer_id,
        message_id: messageObject.message_id,
        message_type: messageObject.type,
        webhook_url: DMS_CONFIG.WEBHOOK_URL || 'NOT SET',
        payload: messageObject
      }
    }
  );
  
  if (!DMS_CONFIG.WEBHOOK_URL) {
    logServiceExecution(
      'DMS_SEND',
      'sendMessage',
      {
        level: 'warn',
        message: 'WARNING: No webhook URL configured! DMS won\'t know where to send responses!'
      }
    );
  }
  
  const sendStartTime = Date.now();
  
  // Use sendMessage to send the payload to DMS
  dms.sendMessage(messageObject, (response) => {
    const sendDuration = Date.now() - sendStartTime;
    const isSuccessful = response.status >= 200 && response.status < 300;
    
    logServiceExecution(
      'DMS_SEND',
      'sendMessage',
      {
        level: isSuccessful ? 'info' : 'error',
        message: `DMS response received: ${response.status} ${response.statusText}`,
        data: {
          status: response.status,
          statusText: response.statusText,
          responseData: response.data
        },
        duration: sendDuration
      }
    );
    
    // If the response is successful, mark the message as delivered immediately
    // since we know DMS received it (200 OK response)
    if (isSuccessful && messageObject.message_id) {
      pendingMessages.set(messageObject.message_id, 'delivered');
      logServiceExecution(
        'DMS_SEND',
        'sendMessage',
        {
          level: 'info',
          message: `Message ${messageObject.message_id} successfully delivered to DMS, marked as delivered`,
          data: { message_id: messageObject.message_id }
        }
      );
    }
    
    logServiceExecution(
      'DMS_SEND',
      'sendMessage',
      {
        level: 'info',
        message: 'DMS processing complete. Waiting for webhook response.',
        data: {
          webhook_url: DMS_CONFIG.WEBHOOK_URL || 'WEBHOOK_URL_NOT_SET',
          expected_timeline: '1-30 seconds'
        }
      }
    );
    
    const totalDuration = Date.now() - startTime;
    logServiceExecution(
      'API_MESSAGES',
      'POST /api/messages',
      {
        level: isSuccessful ? 'info' : 'error',
        message: 'Message send request completed',
        duration: totalDuration
      }
    );
    
    return res.status(response.status).json({
      status: response.status,
      message: response.statusText,
      messageStatus: isSuccessful ? 'sent' : 'error', // Revert to 'sent' to match frontend expectations
      messageId: messageObject.message_id || messageId,
      messageType: messageObject.type,
      dmsResponse: response.data // Include the DMS response data for client visibility
    });
  });
});

// New endpoint to update message status
app.post('/api/message-status', (req, res) => {
  const { messageId, status } = req.body;
  
  if (!messageId || !status) {
    return res.status(400).json({ error: 'Missing messageId or status' });
  }
  
  // Store the updated status
  pendingMessages.set(messageId, status);
  
  return res.status(200).json({ success: true });
});

// New endpoint to check message status
app.get('/api/message-status/:messageId', (req, res) => {
  const messageId = req.params.messageId;
  
  if (pendingMessages.has(messageId)) {
    return res.status(200).json({ 
      messageId, 
      status: pendingMessages.get(messageId) 
    });
  }
  
  return res.status(404).json({ 
    messageId, 
    status: 'unknown' 
  });
});

// Enhance DMS webhook endpoint to update message status when DMS responds
app.post('/api/dms/webhook', (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  logServiceExecution(
    'WEBHOOK',
    'POST /api/dms/webhook',
    {
      level: 'info',
      message: 'Webhook request received from DMS',
      data: {
        requestId: requestId,
        hasBody: !!req.body,
        body: req.body
      }
    }
  );
  
  try {
    // PRIORITY: Store all incoming messages first
    if (req.body) {
      const wasStored = storeIncomingMessage(req.body);
      
      logServiceExecution(
        'WEBHOOK',
        'POST /api/dms/webhook',
        {
          level: wasStored ? 'info' : 'warn',
          message: wasStored ? 'Message stored successfully' : 'Message was not stored (likely duplicate)',
          data: { requestId: requestId }
        }
      );
      
      // If this is a delivery confirmation, update message status
      if (req.body.message_id) {
        pendingMessages.set(req.body.message_id, 'delivered');
        logServiceExecution(
          'WEBHOOK',
          'POST /api/dms/webhook',
          {
            level: 'info',
            message: `Updated status for message ${req.body.message_id} to 'delivered'`,
            data: { message_id: req.body.message_id, requestId: requestId }
          }
        );
      }
      
      const duration = Date.now() - startTime;
      logServiceExecution(
        'WEBHOOK',
        'POST /api/dms/webhook',
        {
          level: 'info',
          message: 'Webhook processing complete - sending success response',
          duration: duration,
          data: { requestId: requestId }
        }
      );
      
      return res.status(200).send('Message processed successfully');
    }
    
    // If no body, still try to process with DMS client
    logServiceExecution(
      'WEBHOOK',
      'POST /api/dms/webhook',
      {
        level: 'warn',
        message: 'No body in webhook request, attempting DMS client processing',
        data: { requestId: requestId }
      }
    );
    
    dms.onRequest(req, (status, message) => {
      const duration = Date.now() - startTime;
      logServiceExecution(
        'WEBHOOK',
        'POST /api/dms/webhook',
        {
          level: status >= 200 && status < 300 ? 'info' : 'error',
          message: 'DMS client processing complete',
          data: { status: status, message: message, requestId: requestId },
          duration: duration
        }
      );
      return res.status(status).send(message);
    });
      
  } catch (err) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'WEBHOOK',
      'POST /api/dms/webhook',
      {
        level: 'error',
        message: 'Error in webhook processing',
        error: err.message,
        stack: err.stack,
        duration: duration,
        data: { requestId: requestId }
      }
    );
    
    // Even on error, try to store the message if it exists
    if (req.body) {
      try {
        const wasStored = storeIncomingMessage(req.body);
        logServiceExecution(
          'WEBHOOK',
          'POST /api/dms/webhook',
          {
            level: wasStored ? 'info' : 'warn',
            message: wasStored ? 'Successfully stored message despite error' : 'Failed to store message despite error',
            data: { requestId: requestId }
          }
        );
      } catch (storeErr) {
        logServiceExecution(
          'WEBHOOK',
          'POST /api/dms/webhook',
          {
            level: 'error',
            message: 'Failed to store message',
            error: storeErr.message,
            stack: storeErr.stack,
            data: { requestId: requestId }
          }
        );
      }
      return res.status(200).send('Message accepted despite error');
    }
    
    return res.status(500).send(err.message);
  }
});

// NEW ENDPOINT: API endpoint to ping DMS and check real connection
app.get('/api/ping', (req, res) => {
  const startTime = Date.now();
  
  logServiceExecution(
    'API_PING',
    'GET /api/ping',
    {
      level: 'info',
      message: 'Ping request received'
    }
  );
  
  // Check if we have the necessary configuration values
  if (!DMS_CONFIG.JWT_SECRET || !DMS_CONFIG.CHANNEL_ID || !DMS_CONFIG.API_URL) {
    const duration = Date.now() - startTime;
    logServiceExecution(
      'API_PING',
      'GET /api/ping',
      {
        level: 'error',
        message: 'Missing configuration values',
        duration: duration
      }
    );
    return res.json({ 
      connected: false, 
      message: 'Missing configuration values'
    });
  }
  
  // Create a test message to ping the DMS
  const pingMessage = {
    type: 'text',
    customer_id: 'ping-test-' + Date.now(),
    message_id: 'ping-' + Date.now(),
    text: ['ping test message']
  };
  
  logServiceExecution(
    'API_PING',
    'GET /api/ping',
    {
      level: 'info',
      message: 'Sending ping message to DMS',
      data: pingMessage
    }
  );
  
  const pingStartTime = Date.now();
  
  // Attempt to send a ping message to DMS
  dms.sendMessage(pingMessage, (response) => {
    const pingDuration = Date.now() - pingStartTime;
    const totalDuration = Date.now() - startTime;
    
    // Check if the connection was successful
    const isConnected = response.status >= 200 && response.status < 300;
    
    logServiceExecution(
      'API_PING',
      'GET /api/ping',
      {
        level: isConnected ? 'info' : 'error',
        message: `Ping response received: ${response.status} ${response.statusText}`,
        data: {
          status: response.status,
          statusText: response.statusText,
          responseData: response.data
        },
        duration: totalDuration,
        pingDuration: pingDuration
      }
    );
    
    return res.json({
      connected: isConnected,
      status: response.status,
      message: response.statusText || (isConnected ? 'Connection successful' : 'Connection failed: ' + (response.data || 'Unknown error'))
    });
  });
});

// API endpoint to get configuration
app.get('/api/config', (req, res) => {
  res.json({
    // Only send what the client needs to know - use simpler check
    connected: !!DMS_CONFIG.JWT_SECRET && !!DMS_CONFIG.CHANNEL_ID && !!DMS_CONFIG.API_URL
  });
});

// API endpoint to update configuration
app.post('/api/config', (req, res) => {
  const startTime = Date.now();
  const { jwtSecret, channelId, apiUrl, webhookUrl } = req.body;
  
  logServiceExecution(
    'API_CONFIG',
    'POST /api/config',
    {
      level: 'info',
      message: 'Configuration update request received',
      data: {
        hasJwtSecret: !!jwtSecret,
        hasChannelId: !!channelId,
        hasApiUrl: !!apiUrl,
        hasWebhookUrl: !!webhookUrl
      }
    }
  );
  
  let configChanged = false;
  
  // In a production app, you would store these securely
  // For this demo, we're just updating the in-memory config
  
  if (jwtSecret && jwtSecret !== DMS_CONFIG.JWT_SECRET) {
    DMS_CONFIG.JWT_SECRET = jwtSecret;
    configChanged = true;
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'JWT Secret updated'
      }
    );
  }
  
  if (channelId && channelId !== DMS_CONFIG.CHANNEL_ID) {
    DMS_CONFIG.CHANNEL_ID = channelId;
    configChanged = true;
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'Channel ID updated',
        data: { channelId: channelId }
      }
    );
  }
  
  if (apiUrl && apiUrl !== DMS_CONFIG.API_URL) {
    DMS_CONFIG.API_URL = apiUrl;
    configChanged = true;
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'API URL updated',
        data: { apiUrl: apiUrl }
      }
    );
  }
  
  // If webhook URL is provided, update it in the config
  // This should be a URL that DMS can call back to, like your /api/dms/webhook endpoint
  if (webhookUrl && webhookUrl !== DMS_CONFIG.WEBHOOK_URL) {
    DMS_CONFIG.WEBHOOK_URL = webhookUrl;
    configChanged = true;
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'Webhook URL updated',
        data: { webhookUrl: webhookUrl }
      }
    );
  }
  
  // Only reinitialize DMS client if config changed
  if (configChanged) {
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'Config changed, reinitializing DMS client'
      }
    );
    
    // Create a new instance with the updated config
    const newDms = dmsClientChannel(DMS_CONFIG);
    
    // Transfer all the callback handlers from the old instance
    newDms.onTextMessage = dms.onTextMessage;
    newDms.onRichContentMessage = dms.onRichContentMessage;
    newDms.onUrlLinkMessage = dms.onUrlLinkMessage;
    newDms.onTypingIndicator = dms.onTypingIndicator;
    newDms.onCsrEndSession = dms.onCsrEndSession;
    newDms.onMenuMessage = dms.onMenuMessage;
    
    // Replace the old instance with the new one
    dms = newDms;
    
    logServiceExecution(
      'API_CONFIG',
      'POST /api/config',
      {
        level: 'info',
        message: 'DMS client reinitialized successfully'
      }
    );
  }
  
  const duration = Date.now() - startTime;
  logServiceExecution(
    'API_CONFIG',
    'POST /api/config',
    {
      level: 'info',
      message: 'Configuration update completed',
      data: {
        configChanged: configChanged,
        JWT_SECRET: DMS_CONFIG.JWT_SECRET ? '****SET****' : 'NOT SET',
        CHANNEL_ID: DMS_CONFIG.CHANNEL_ID || 'NOT SET',
        API_URL: DMS_CONFIG.API_URL || 'NOT SET',
        WEBHOOK_URL: DMS_CONFIG.WEBHOOK_URL || 'NOT SET'
      },
      duration: duration
    }
  );
  
  res.json({ success: true });
});

// New endpoint to get pending incoming messages for a customer
app.get('/api/messages/:customerId', (req, res) => {
  const startTime = Date.now();
  const customerId = req.params.customerId;
  // Get the last timestamp if provided
  const lastTimestamp = req.query.since || '1970-01-01T00:00:00.000Z';
  
  logServiceExecution(
    'API_MESSAGES',
    'GET /api/messages/:customerId',
    {
      level: 'info',
      message: `Getting messages for customer ${customerId}`,
      data: {
        customerId: customerId,
        lastTimestamp: lastTimestamp,
        totalStoredMessages: incomingMessages.length
      }
    }
  );
  
  // CRITICAL FIX FOR PEGA - We need to look at different fields for customer identification
  const newMessages = incomingMessages.filter(msg => {
    // Check customer_id from our app
    const matchesCustomerId = msg.customer_id === customerId;
    
    // Check profile_id from Pega
    const matchesProfileId = msg.customer && msg.customer.profile_id === customerId;
    
    // Check UUID from Pega
    const isPegaUUID = msg.customer && msg.customer.id === '4cf33b5e963c45eb90cc2b99892844fc';
    
    // Set a debug log to see what we're filtering
    const customerId1 = msg.customer_id || 'none';
    const customerId2 = (msg.customer && msg.customer.profile_id) || 'none';
    const customerId3 = (msg.customer && msg.customer.id) || 'none';
    
    console.log(`DEBUG: Message check - Looking for "${customerId}" against [${customerId1}, ${customerId2}, ${customerId3}]`);
    
    // Any of these matches should return the message
    const isMatch = matchesCustomerId || matchesProfileId || isPegaUUID;
    const isNewer = msg.timestamp > lastTimestamp;
    
    return isMatch && isNewer;
  });
  
  const duration = Date.now() - startTime;
  
  logServiceExecution(
    'API_MESSAGES',
    'GET /api/messages/:customerId',
    {
      level: 'info',
      message: `Found ${newMessages.length} new messages for customer ${customerId}`,
      data: {
        customerId: customerId,
        messageCount: newMessages.length,
        messages: newMessages.map(msg => ({
          message_id: msg.message_id,
          type: msg.type,
          hasText: !!msg.text,
          hasPyEntryText: !!msg.pyEntryText
        }))
      },
      duration: duration
    }
  );
  
  res.json({
    customerId,
    messages: newMessages
  });
});

// DEBUG Endpoint: Add a new endpoint to see all stored messages
app.get('/api/debug/messages', (req, res) => {
  logServiceExecution(
    'API_DEBUG',
    'GET /api/debug/messages',
    {
      level: 'info',
      message: 'Debug endpoint: retrieving all stored messages',
      data: {
        messageCount: incomingMessages.length,
        processedMessageIdsCount: processedMessageIds.size
      }
    }
  );
  
  // Return all messages regardless of customer ID
  res.json({
    count: incomingMessages.length,
    messages: incomingMessages,
    processedMessageIds: Array.from(processedMessageIds),
    processedCount: processedMessageIds.size
  });
});

// NEW DEBUG Endpoint: Check deduplication status
app.get('/api/debug/deduplication', (req, res) => {
  res.json({
    totalStoredMessages: incomingMessages.length,
    uniqueMessageIds: processedMessageIds.size,
    duplicatesBlocked: Math.max(0, incomingMessages.length - processedMessageIds.size),
    recentMessages: incomingMessages.slice(-10).map(msg => ({
      message_id: msg.message_id,
      type: msg.type,
      timestamp: msg.timestamp,
      customer_id: msg.customer_id
    }))
  });
});

// NEW DEBUG Endpoint: Show full DMS configuration
app.get('/api/debug/config', (req, res) => {
  res.json({
    DMS_CONFIG: {
      JWT_SECRET: DMS_CONFIG.JWT_SECRET ? '****SET****' : 'NOT SET',
      CHANNEL_ID: DMS_CONFIG.CHANNEL_ID || 'NOT SET',
      API_URL: DMS_CONFIG.API_URL || 'NOT SET',
      WEBHOOK_URL: DMS_CONFIG.WEBHOOK_URL || 'NOT SET'
    },
    ENVIRONMENT_VARS: {
      JWT_SECRET: process.env.JWT_SECRET ? '****SET****' : 'NOT SET',
      CHANNEL_ID: process.env.CHANNEL_ID || 'NOT SET', 
      API_URL: process.env.API_URL || 'NOT SET',
      WEBHOOK_URL: process.env.WEBHOOK_URL || 'NOT SET'
    },
    WEBHOOK_ENDPOINTS: [
      'POST /api/dms/webhook - Main webhook endpoint',
      'GET /api/debug/config - This debug endpoint'
    ],
    SUGGESTED_WEBHOOK_URL: `${req.protocol}://${req.get('host')}/api/dms/webhook`
  });
});

// NEW ENDPOINT: Get service execution logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const service = req.query.service;
  const level = req.query.level;
  
  let filteredLogs = serviceLogs;
  
  // Filter by service if provided
  if (service) {
    filteredLogs = filteredLogs.filter(log => log.service === service);
  }
  
  // Filter by level if provided
  if (level) {
    filteredLogs = filteredLogs.filter(log => log.level === level);
  }
  
  // Get the most recent logs (limit)
  const recentLogs = filteredLogs.slice(-limit);
  
  logServiceExecution(
    'API_LOGS',
    'GET /api/logs',
    {
      level: 'info',
      message: 'Service logs retrieved',
      data: {
        totalLogs: serviceLogs.length,
        filteredLogs: filteredLogs.length,
        returnedLogs: recentLogs.length,
        filters: { service: service || 'all', level: level || 'all', limit: limit }
      }
    }
  );
  
  res.json({
    total: serviceLogs.length,
    filtered: filteredLogs.length,
    returned: recentLogs.length,
    logs: recentLogs
  });
});

// NEW ENDPOINT: Clear service logs
app.delete('/api/logs', (req, res) => {
  const countBefore = serviceLogs.length;
  serviceLogs.length = 0;
  
  logServiceExecution(
    'API_LOGS',
    'DELETE /api/logs',
    {
      level: 'info',
      message: 'Service logs cleared',
      data: {
        logsCleared: countBefore
      }
    }
  );
  
  res.json({
    success: true,
    logsCleared: countBefore
  });
});

// Catch all routes and redirect to the index file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 