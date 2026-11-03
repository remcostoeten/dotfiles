import { NewHandyApiClient } from '../../handy-rest-api-v3-client.js';
import * as EH from '../../event_hub.js'
import Logger from '../../log.js'
import { DeviceStatus } from '../sse/device-status/device-status.js'

const EventHub = EH.default

const html = String.raw;

class HampController extends HTMLElement {

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
  #minSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #maxSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #velocitySlider = null;

  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });

    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>Hamp controller</h3>
        </div>
        <div class="card-body">
          <div class="mb-3" id="">
            <label for="velocitySlider" class="form-label custom-input-width">Velocity:</label>
            <input type="range" id="velocitySlider" name="velocity" min="1" max="100" class="form-range">
          </div>

          <div class="slider-container">
              <label for="minStrokeSlider" class="form-label">Minimum Stroke:</label>
              <input type="range" id="minStrokeSlider" name="minStroke" min="0" max="99" value="0" class="form-range">
          </div>

          <div class="slider-container">
              <label for="maxStrokeSlider" class="form-label">Maximum Stroke:</label>
              <input type="range" id="maxStrokeSlider" name="maxStroke" min="1" max="100" value="100" class="form-range">
          </div>

          <div class="button-container">
              <button type="button" class="btn btn-primary" id="startHamp">Start</button>
              <button type="button" class="btn btn-primary" id="stopHamp">Stop</button>
          </div>
        </div>
      </div>
      `

    // @ts-ignore
    this.#minSlider = this.shadowRoot.getElementById('minStrokeSlider')
    // @ts-ignore
    this.#maxSlider = this.shadowRoot.getElementById('maxStrokeSlider')
    // @ts-ignore
    this.#velocitySlider = this.shadowRoot.getElementById('velocitySlider')

    shadow.getElementById('startHamp').addEventListener('click', this.startHamp.bind(this));
    shadow.getElementById('stopHamp').addEventListener('click', this.stopHamp.bind(this));
    shadow.getElementById('minStrokeSlider').addEventListener('change', this.setStroke.bind(this));
    shadow.getElementById('maxStrokeSlider').addEventListener('change', this.setStroke.bind(this));
    shadow.getElementById('velocitySlider').addEventListener('change', this.setHampSpeed.bind(this));
    shadow.getElementById('minStrokeSlider').addEventListener('input', this.updateStrokeRange.bind(this));
    shadow.getElementById('maxStrokeSlider').addEventListener('input', this.updateStrokeRange.bind(this));
  }

  async updateStrokeRange() {
    if (parseInt(this.#minSlider.value) > parseInt(this.#maxSlider.value)) {
      this.#minSlider.value = this.#maxSlider.value;
    }
    if (parseInt(this.#maxSlider.value) < parseInt(this.#minSlider.value)) {
      this.#maxSlider.value = this.#minSlider.value;
    }
  }

  async setHampSpeed() {
    await this.#client.HAMP.setVelocity(this.#token, this.#deviceKey, parseInt(this.#velocitySlider.value, 10) / 100)
  }

  async setStroke() {
    await this.#client.SLIDER.setStroke(this.#token, this.#deviceKey, {
      min: parseFloat(this.#minSlider.value) / 100,       // API expects a double value between 0 and 1
      max: parseFloat(this.#maxSlider.value) / 100        // API expects a double value between 0 and 1
    })
  }

  async startHamp() {
    // Make sure the stroke limits are set on the device before starting
    await this.setStroke();
    // HAMP always starts with velocity=0 after a stop.
    await this.#client.HAMP.start(this.#sse.token, this.#deviceKey)
    // But we can set the velocity immediately after the start command
    // if we want the user to "hit the ground running".
    await this.setHampSpeed();
  }

  async stopHamp() {
    await this.#client.HAMP.stop(this.#sse.token, this.#deviceKey)
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
    Logger.debug('sse started for device', this.#deviceKey, this.#token);
    this.#sse.onDeviceConnected((event) => {
      Logger.debug('device connected:', event.data, 'ck:', this.#sse.connection_key);
    })
  }
}

customElements.define('hamp-controller', HampController);

export { HampController };