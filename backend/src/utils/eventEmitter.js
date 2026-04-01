const EventEmitter = require('events');

// Singleton — same instance used across entire app
const emitter = new EventEmitter();

// Prevent memory leak warnings for many listeners
emitter.setMaxListeners(20);

module.exports = emitter;
