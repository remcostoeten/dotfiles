import { NewHandyApiClient } from '../../../handy-rest-api-v3-client.js';
import * as EH from '../../../event_hub.js'
import * as Log from '../../../log.js'
import { DeviceStatus } from '../device-status/device-status.js';

const EventHub = EH.default
const Logger = Log.default

const html = String.raw;

class DeviceEvents extends HTMLElement {
  #client = NewHandyApiClient('https://handyfeeling.com/api/handy-rest/v3-1');
  /** @type {import('../../../handy-rest-api-v3-client.js').SSESource}  */
  #sse = null;
  /** @type {HTMLOListElement} */
  #list = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
     <div class="card">
        <div class="card-header">
          <h3>Events</h3>
        </div>
        <div class="card-body">
          <div class="card-text">
            <ol id="events" class="list-unstyled"></ol>
          </div>
        </div>
      </div>
    `
    /** @ts-ignore */
    this.#list = shadow.getElementById('events');
  }


  /**
   * 
   * @param {import('../../../handy-rest-api-v3-client.js').SSEEvent<any>} event
   */
  addEventToList(event) {
    Logger.debug('addEventToList', event);
    const li = document.createElement('li');
    li.textContent = `${new Date().toISOString()} :: ${event.id} :: ${event.type} :: ${event.data.connection_key} :: ${JSON.stringify(event.data.data ?? {}, null, 2)}`;
    const firstItem = this.#list.firstChild;
    // Add this new item to the front of the list
    if (firstItem) {
      this.#list.insertBefore(li, firstItem);
      return
    }
    // If the list is empty, just append the new item
    this.#list.appendChild(li);
  }

  /**
   * 
   * @param {CustomEvent} event 
   */
  handleSseStarted(event) {
    // Handle the event
    const sse = event.detail.sse;
    this.#sse = sse;
    console.log('sse started for device', this.#sse.connection_key, this.#sse.token);
    this.#sse.onEventTypes(this.#client.SSE.AllEventTypes, (event) => {
      this.addEventToList(event);
    })
  }

  connectedCallback() {
    EventHub.addListener(DeviceStatus.SSE_STARTED.description, this.handleSseStarted.bind(this));
  }

  disconnectedCallback() {

  }
}

customElements.define('device-events', DeviceEvents);

export { DeviceEvents };