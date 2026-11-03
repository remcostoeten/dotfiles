import { NewHandyApiClient } from '../../handy-rest-api-v3-client.js';
import * as EH from '../../event_hub.js'
import Logger from '../../log.js'
import { DeviceStatus } from '../sse/device-status/device-status.js'


const EventHub = EH.default

const html = String.raw;

class HdspController extends HTMLElement {

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
  #velocitySlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #timeSlider = null;


  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });

    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>HDSP controller</h3>
        </div>
        <div class="card-body">
          <div class="mb-3" id="">
            <label for="timeSlider" class="form-label custom-input-width">Time (ms):</label>
            <input type="range" id="timeSlider" name="time" min="100" max="3000" class="form-range">
          </div>
          <div class="mb-3" id="">
            <label for="velocitySlider" class="form-label custom-input-width">Velocity (relative):</label>
            <input type="range" id="velocitySlider" name="velocity" min="1" max="100" value="50" class="form-range">
          </div>
          <div class="mb-3">
              <label for="posSlider" class="form-label">Position:</label>
              <input type="range" id="posSlider" name="pos" min="0" max="100" value="50" class="form-range">
          </div>
          <div class="mb-3 form-check">
            <input type="checkbox" class="form-check-input" id="immediateRsp" checked>
            <label class="form-check-label" for="immediateRsp">Immediate response</label>
          </div>
          <div class="mb-3 form-check">
            <input type="checkbox" class="form-check-input" id="stopOnTarget" >
            <label class="form-check-label" for="stopOnTarget" >Stop on target</label>
          </div>
          <div class="button-container">
              <button type="button" class="btn btn-primary" id="xpvp">Send Xpvp</button>
              <button type="button" class="btn btn-primary" id="xpt">Send Xpt</button>
          </div>
        </div>
      </div>
      `

    // @ts-ignore
    this.#posSlider = this.shadowRoot.getElementById('posSlider')
    // @ts-ignore
    this.#velocitySlider = this.shadowRoot.getElementById('velocitySlider')
    // @ts-ignore
    this.#timeSlider = this.shadowRoot.getElementById('timeSlider')

    shadow.getElementById('xpvp').addEventListener('click', this.sendXpvp.bind(this));
    shadow.getElementById('xpt').addEventListener('click', this.sendXpt.bind(this));
    // shadow.getElementById('posSlider').addEventListener('change', this.setStroke.bind(this));
    // shadow.getElementById('maxStrokeSlider').addEventListener('change', this.setStroke.bind(this));
    // shadow.getElementById('timeSlider').addEventListener('change', this.setHampSpeed.bind(this));
    // shadow.getElementById('posSlider').addEventListener('input', this.updateStrokeRange.bind(this));
    // shadow.getElementById('maxStrokeSlider').addEventListener('input', this.updateStrokeRange.bind(this));
  }

  async sendXpvp() {
    await this.#client.HDSP.xpvp(this.#token, this.#deviceKey, parseInt(this.#posSlider.value) / 100, parseInt(this.#velocitySlider.value) / 100, {
      /** @ts-ignore */
      immediate_rsp: this.shadowRoot.getElementById('immediateRsp').checked,
      /** @ts-ignore */
      stop_on_target: this.shadowRoot.getElementById('stopOnTarget').checked
    });
  }


  async sendXpt() {
    await this.#client.HDSP.xpt(this.#token, this.#deviceKey, parseInt(this.#posSlider.value) / 100, parseInt(this.#timeSlider.value), {
      /** @ts-ignore */
      immediate_rsp: this.shadowRoot.getElementById('immediateRsp').checked,
      /** @ts-ignore */
      stop_on_target: this.shadowRoot.getElementById('stopOnTarget').checked
    });
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

customElements.define('hdsp-controller', HdspController);

export { HdspController };