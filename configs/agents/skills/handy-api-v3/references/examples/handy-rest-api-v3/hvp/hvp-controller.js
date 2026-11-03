import { NewHandyApiClient } from '../../handy-rest-api-v3-client.js';
import * as EH from '../../event_hub.js'
import { DeviceStatus } from '../sse/device-status/device-status.js'

const EventHub = EH.default

const html = String.raw;

class HvpController extends HTMLElement {

  #client = NewHandyApiClient();
  /** @type {string} */
  #deviceKey
  /** @type {import('../../handy-rest-api-v3-client.js').SSESource}  */
  #sse
  /** @type {string} */
  #token
  /**
   * @type {HTMLInputElement}
   */
  #posSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #freqSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #ampSlider = null;

  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });

    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>Hvp</h3>
        </div>
        <div class="card-body">
          <form>
            <div class="mb-3" id="">
              <label for="device" class="form-label custom-input-width">Position:</label>
              <input type="range" id="position" name="position" min="1" max="100" class="form-range">
            </div>
            <div class="mb-3" id="">
              <label for="device" class="form-label custom-input-width">Frequency:</label>
              <input type="range" id="frequency" name="frequency" min="20" max="200" value="80" class="form-range">
            </div>
            <div class="mb-3" id="">
              <label for="device" class="form-label custom-input-width">Amplitude:</label>
              <input type="range" id="amplitude" name="amplitude" min="1" max="100" value="50" class="form-range">
            </div>
            <div class="button-container">
                <button type="button" class="btn btn-primary" id="startHvp">Start</button>
                <button type="button" class="btn btn-primary" id="stopHvp">Stop</button>
            </div>
          </form>
        </div>
      </div>
      `

    // @ts-ignore
    this.#posSlider = this.shadowRoot.getElementById('position')
    // @ts-ignore
    this.#freqSlider = this.shadowRoot.getElementById('frequency')
    // @ts-ignore
    this.#ampSlider = this.shadowRoot.getElementById('amplitude')
    this.#posSlider.addEventListener('change', this.setHvpState.bind(this));
    this.#freqSlider.addEventListener('change', this.setHvpState.bind(this));
    this.#ampSlider.addEventListener('change', this.setHvpState.bind(this));
    this.shadowRoot.getElementById('startHvp').addEventListener('click', this.startHvp.bind(this));
    this.shadowRoot.getElementById('stopHvp').addEventListener('click', this.stopHvp.bind(this));
  }

  async setHvpState() {
    await this.#client.HVP.setState(this.#token, this.#deviceKey, {
      amplitude: parseFloat(this.#ampSlider.value) / 100,       // API expects a double value between 0 and 1
      frequency: parseInt(this.#freqSlider.value),      // API expects a double value between 0 and 1
      position: parseFloat(this.#posSlider.value) / 100         // API expects a double value between 0 and 1
    })
  }


  async startHvp() {
    // // Make sure the stroke limits are set on the device before starting
    // await this.setHvpState();
    // // HAMP always starts with velocity=0 after a stop.
    await this.#client.HVP.start(this.#sse.token, this.#deviceKey)
    // // But we can set the velocity immediately after the start command
    // // if we want to and the user will "hit the ground running".
    await this.setHvpState();
  }

  async stopHvp() {
    await this.#client.HVP.stop(this.#sse.token, this.#deviceKey)
  }

  connectedCallback() {
    EventHub.addListener(DeviceStatus.SSE_STARTED.description, this.handleSseStarted.bind(this));
  }

  disconnectedCallback() {

  }

  /**
   * 
   * @param {CustomEvent} event 
   */
  handleSseStarted(event) {
    // Handle the event
    const sse = event.detail.sse;
    this.#sse = sse;
    this.#deviceKey = sse.connection_key;
    this.#token = sse.token
    console.log('SSE started for device', this.#deviceKey, this.#token);
    this.#sse.onDeviceConnected((event) => {
      console.log('Device connected:', event.data, 'ck:', this.#sse.connection_key);
    })
  }
}

customElements.define('hvp-controller', HvpController);

export { HvpController };