import { NewHandyApiClient } from '../../../handy-rest-api-v3-client.js';
import * as EH from '../../../event_hub.js'
import * as Log from '../../../log.js'

const EventHub = EH.default
const Logger = Log.default

const html = String.raw;

class DeviceStatus extends HTMLElement {
  #client = NewHandyApiClient('https://handyfeeling.com/api/handy-rest/v3-1');
  #deviceKey = '';
  // #appKey = '';
  #appId = '';
  /** @type {HTMLInputElement} */
  #ckInput = null;
  /** @type {HTMLInputElement} */
  #appIdInput = null;
  // /** @type {HTMLInputElement} */
  // #appKeyInput = null;
  // @ts-ignore
  #status = null;
  /** @type {import('../../../handy-rest-api-v3-client.js').SSESource}  */
  #sse = null;
  /** @type { NodeJS.Timeout} */
  #debounceTimer = null;
  // #sessionId = '';
  /**
   * @type {boolean | null}
   */
  // @ts-ignore
  #connected = undefined

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <style>
        :host {}
        .status[data-connected=""] {
          <!-- background-color: #e9ecef; /* Green */ -->
        }
        .status[data-connected="true"] {
          background-color: #45a52b; /* Green */
        }
        .status[data-connected="false"] {
          background-color: #d32f2f; /* Red */
        }
        .custom-input-width {
          width: 100px;
        }
      </style>
      <div class="card">
        <div class="card-header">
          <h3>Handy API credentials</h3>
        </div>
        <div class="card-body">
          <div class="card-text">
            <p>Enter your Handy API ApplicationID</p>
          </div>
          <div class="mb-3">
            <label for="app-id" class="form-label">ApplicationID</label>
            <input type="text" class="form-control" id="app-id" placeholder="Enter an ApplicationID" minlength="5" value="">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Connection key</h3>
        </div>
        <div class="card-body">
          <div class="card-text">
            <p>Enter the connection key of the device you want to connect to</p>
          </div>
          <div class="card-text">
          <form>
            <div class="mb-3">
              <label for="app-id" class="form-label">ConnectionKey</label>
              <input type="text" class="form-control" id="connectionKey" placeholder="Connection key" minlength="5" value="" />        
            </div>
        </form>
        </div>
        </div>        
      </div>

      <div id="device-list" class="card" hidden>
        <div class="card-header">
          <h3>Device status</h3>
        </div>
        <div class="card-body">
          <table  class="table">
            <thead>
              <tr >
                <th scope="col">Connection Key</th>
                <th scope="col">Status</th>
                <th scope="col">FirmwareVersion</th>
                <th scope="col">HardwareModel</th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
      </div>
      `
    /** @ts-ignore */
    this.#ckInput = shadow.getElementById('connectionKey');
    /** @ts-ignore */
    // this.#appKeyInput = shadow.getElementById('app-key');
    /** @ts-ignore */
    this.#appIdInput = shadow.getElementById('app-id');
    this.#appIdInput.value = localStorage.getItem('handy-rest-api#app-id') || '';
    this.#status = shadow.getElementById('status');
    this.handleInput = this.handleInput.bind(this);
    this.#ckInput.addEventListener('input', this.handleInput);
    this.#ckInput.value = localStorage.getItem('device-key') || '';
    this.handleInput();
  }
  /**
   * @param {string} ck
   * @param {boolean} connected
   * @param {import('../../../handy-rest-api-v3-client.js').DeviceStatusInfo} info
   */
  updateDeviceStatus(ck, connected, info) {
    Logger.debug('updateDeviceStatus', ck, connected, info)
    const dl = this.shadowRoot.getElementById('device-list')
    const thbody = dl.querySelector('tbody')
    // find tr with data-ck = ck
    let tr = thbody.querySelector(`tr[data-ck="${ck}"]`)
    if (tr) {
      const sid = tr.getAttribute('data-sid')
      // update the status
      if (!connected && sid > info?.session_id) {
        // ignore disconnect events for older sessions then the current one
        return
      }
      tr.querySelector('td:nth-child(2)').textContent = connected ? 'Online' : 'Offline'
      if (connected && sid <= info?.session_id) {
        tr.setAttribute('data-sid', info?.session_id)
        tr.querySelector('td:nth-child(3)').textContent = info?.fw_version || 'unknown'
        tr.querySelector('td:nth-child(4)').textContent = info?.hw_model_name || 'unknown'
      }
      return
    }
    // create a new tr
    tr = document.createElement('tr')
    tr.setAttribute('data-ck', ck)
    tr.setAttribute('data-sid', info?.session_id ?? '')
    tr.innerHTML = `<td>${ck}</td><td>${connected ? 'Online' : 'Offline'}</td><td>${info?.fw_version || 'unknown'}</td><td>${info?.hw_model_name || 'unknown'}</td>`
    thbody.appendChild(tr)
  }

  connectedCallback() {
  }

  /** @ts-ignore" */
  handleInput() {
    if (this.#ckInput.value?.length < 5) {
      // Min key length: 5
      // this.updateOnlineStatus(false);
      return;
    }
    // Clear the existing debounce timer if there is one
    if (this.#debounceTimer !== null) {
      clearTimeout(this.#debounceTimer);
    }
    // Set a new debounce timer
    this.#debounceTimer = setTimeout(async () => {
      if (this.#deviceKey === this.#ckInput.value) {
        // No change
        return
      }

      if (this.#sse !== null) {
        // Close the existing event stream
        this.#sse.close();
        EventHub.dispatchEvent(new CustomEvent(DeviceStatus.SSE_CLOSED.description, { detail: { sse: this.#sse }, bubbles: true, composed: true }))
        const dl = this.shadowRoot.getElementById('device-list')
        dl.hidden = true
        // clear the device list
        const tbody = dl.querySelector('tbody')
        tbody.innerHTML = ''
      }

      // Get a token for the device key and start listening for device events
      this.#deviceKey = this.#ckInput.value;
      localStorage.setItem('device-key', this.#deviceKey);
      // this.#appKey = this.#appKeyInput.value
      this.#appId = this.#appIdInput.value
      localStorage.setItem('handy-rest-api#app-id', this.#appId);
      // const rsp = await this.#client.AUTH.issueToken(this.#appKey, { ck: this.#deviceKey });
      // if (rsp.ok) {
      // this.#appKey = rsp.result.token
      this.#sse = this.#client.SSE.newSSESource(this.#appId, this.#deviceKey, []);
      this.#sse.onDeviceStatus((event) => {
        this.updateDeviceStatus(event.data.connection_key, event.data.data.connected, event.data.data.info);
      })
      this.#sse.onDeviceConnected((event) => {
        this.updateDeviceStatus(event.data.connection_key, true, event.data.data.info);
      })
      this.#sse.onDeviceDisconnected((event) => {
        // @ts-ignore
        this.updateDeviceStatus(event.data.connection_key, false, { session_id: event.data.data.session_id });
      })
      this.initDeviceList()
      Logger.debug('SSE started:', this.#sse);
      EventHub.dispatchEvent(new CustomEvent(DeviceStatus.DEVICE_KEY_CHANGE.description, { detail: { deviceKey: this.#deviceKey }, bubbles: true, composed: true }))
      EventHub.dispatchEvent(new CustomEvent(DeviceStatus.SSE_STARTED.description, { detail: { sse: this.#sse }, bubbles: true, composed: true }))
      return
      // }
      // Logger.error('Failed to get token:', rsp.error);
    }, 500);
  }

  initDeviceList() {
    const dl = this.shadowRoot.getElementById('device-list')
    const thbody = dl.querySelector('tbody')
    thbody.innerHTML = ''
    dl.hidden = false
  }

  disconnectedCallback() {
    this.#ckInput.removeEventListener('input', this.handleInput);
    // Also clear the debounce timer if the element is removed
    if (this.#debounceTimer !== null) {
      clearTimeout(this.#debounceTimer);
    }
    if (this.#sse !== null) {
      this.#sse.close();
    }
  }

  static SSE_STARTED = Symbol('device-status#sse_started')
  static DEVICE_KEY_CHANGE = Symbol('device-status#device_key_change')
  static SSE_CLOSED = Symbol('device-status#sse_closed')
}

customElements.define('device-status', DeviceStatus);

export { DeviceStatus };