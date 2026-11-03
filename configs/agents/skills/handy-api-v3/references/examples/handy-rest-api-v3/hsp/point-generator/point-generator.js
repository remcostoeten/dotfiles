import { NewHandyApiClient } from '../../../handy-rest-api-v3-client.js';
import EventHub from '../../../event_hub.js'
import Logger from '../../../log.js'
import { DeviceStatus } from '../../sse/device-status/device-status.js'
import { WaveGenerator } from './points.js'

const html = String.raw;

class HspPointGenerator extends HTMLElement {

  #client = NewHandyApiClient();
  #sync = this.#client.NewClientSyncer()
  /** @type {string} */
  #deviceKey
  /** @type {import('../../../handy-rest-api-v3-client.js').SSESource}  */
  #sse
  /** @type {string} */
  #token
  /**
   * @type {HTMLInputElement}
   */
  #pointsSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #intervalSlider = null;
  /**
   * @type {HTMLInputElement}
   */
  #amplitudeSlider = null;

  #startTime = 0;
  /**
   * @type {import('../../../handy-rest-api-v3-client.js').Point}
   */
  #lastPoint = null
  /**
   * @type {import('../../../handy-rest-api-v3-client.js').Point[]}
   */
  #points = []


  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });

    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>HSP point generator</h3>
        </div>
        <div class="card-body">
          <div class="mb-3" id="">
            <label for="amplitudeSlider" class="form-label custom-input-width">Amplitude:</label><span id="amplitudeValue">50</span>
            <input type="range" id="amplitudeSlider" name="amplitude" min="1" max="50" value="50" class="form-range">
          </div>
          <div class="mb-3" id="">
            <label for="intervalSlider" class="form-label custom-input-width">Interval (ms):</label><span id="intervalValue">250</span>
            <input type="range" id="intervalSlider" name="interval" min="100" max="1000" value="250" class="form-range">
          </div>
          <div class="mb-3">
              <label for="pointsSlider" class="form-label">Points:</label><span id="pointsValue">25</span>
              <input type="range" id="pointsSlider" name="points" min="5" max="100" value="25" class="form-range">
          </div>
          <div class="button-container">
              <button type="button" class="btn btn-primary" id="setup">Setup</button>
              <button type="button" class="btn btn-primary" id="start">Play</button>
              <button type="button" class="btn btn-primary" id="stop">Stop</button>
              <button type="button" class="btn btn-primary" id="addPoints">Add points</button>
          </div>
        </div>
      </div>
      `

    // @ts-ignore
    this.#pointsSlider = this.shadowRoot.getElementById('pointsSlider')
    shadow.getElementById('pointsSlider').addEventListener('input', (event) => {
      // @ts-ignore
      shadow.getElementById('pointsValue').innerText = event.target.value
    })
    // @ts-ignore
    this.#intervalSlider = this.shadowRoot.getElementById('intervalSlider')
    shadow.getElementById('intervalSlider').addEventListener('input', (event) => {
      // @ts-ignore
      shadow.getElementById('intervalValue').innerText = event.target.value
    })
    // @ts-ignore
    this.#amplitudeSlider = this.shadowRoot.getElementById('amplitudeSlider')
    shadow.getElementById('amplitudeSlider').addEventListener('input', (event) => {
      // @ts-ignore
      shadow.getElementById('amplitudeValue').innerText = event.target.value
    })

    shadow.getElementById('setup').addEventListener('click', this.setupHsp.bind(this));
    shadow.getElementById('addPoints').addEventListener('click', this.addPoints.bind(this));

    shadow.getElementById('start').addEventListener('click', this.playHsp.bind(this));
    shadow.getElementById('stop').addEventListener('click', this.stopHsp.bind(this));
  }

  connectedCallback() {
    EventHub.addListener(DeviceStatus.SSE_STARTED.description, this.handleSseStarted.bind(this));
    this.#sync.sync()
  }

  disconnectedCallback() {
  }

  async setupHsp() {
    this.#points = []
    this.#lastPoint = null
    this.startTime = Date.now()
    this.#sse.onHspThresholdReached(async (event) => {
      Logger.debug('threshold reached:', event.data)
      // add more points to the buffer
      await this.addPoints()
    })
    this.#sse.onHspStarving(async (event) => {
      Logger.debug('starving:', event.data)
      // add more points to the buffer
      await this.addPoints()
    })
    return await this.#client.HSP.setup(this.#token, this.#deviceKey, Math.floor(Math.random() * 1024))
  }

  async addPoints() {
    const points = WaveGenerator(this.#lastPoint ? this.#lastPoint : { t: this.#startTime, x: 0 }, parseInt(this.#amplitudeSlider.value), parseInt(this.#intervalSlider.value), parseInt(this.#pointsSlider.value))
    this.#points = this.#points.concat(points)
    Logger.debug('points:', points.length, points)
    Logger.debug('total points:', this.#points.length)
    this.#lastPoint = points[points.length - 1]
    await this.#client.HSP.add(this.#token, this.#deviceKey, {
      flush: false,
      points: points,
      tail_point_stream_index: this.#points.length - 1
    })
    // update the threshold to notify when there are 5 points or less left
    await this.#client.HSP.setThreshold(this.#token, this.#deviceKey, this.#points.length - 5)
  }

  async playHsp() {
    return await this.#client.HSP.play(this.#token, this.#deviceKey, {
      server_time: this.#sync.estimate(),
      start_time: 0,
      loop: false,
      playback_rate: 1
    })
  }

  async stopHsp() {
    return await this.#client.HSP.stop(this.#token, this.#deviceKey)
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

customElements.define('hsp-point-generator', HspPointGenerator);

export { HspPointGenerator };