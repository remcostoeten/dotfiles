/**
 * @file event_hub.js
 * @description Simple event hub to dispatch events to listeners
 */
export default class EventHub {
  /**
   * @type {Object.<string, ListenerFunc[]>}
   */
  static events = {}

  /**
   * @typedef {Function} ListenerFunc
   * @param {CustomEvent} event
   */

  /**
   * 
   * @param {string} event 
   * @param {ListenerFunc} listener 
   */
  static addListener(event, listener) {
    const s = event.valueOf()
    if (!EventHub.events[s]) {
      EventHub.events[s] = []
    }
    EventHub.events[s].push(listener)
  }

  /**
   * @param {CustomEvent} data
   * @returns 
   */
  static dispatchEvent(data) {
    const listeners = EventHub.events[data?.type]
    for (let i = 0; i < listeners?.length; i++) {
      listeners[i](data)
    }
  }
}