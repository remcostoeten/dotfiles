import { NewHandyApiClient } from '../../../handy-rest-api-v3-client.js';
import EventHub from '../../../event_hub.js'
import Logger from '../../../log.js'
import { DeviceStatus } from '../../sse/device-status/device-status.js'
import { Patterns } from './patterns.js'

const html = String.raw;

class HspPatterns extends HTMLElement {

  #client = NewHandyApiClient();
  #sync = this.#client.NewClientSyncer()
  /** @type {string} */
  #deviceKey
  /** @type {import('../../../handy-rest-api-v3-client.js').SSESource}  */
  #sse
  /** @type {string} */
  #token

  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });

    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>HSP patterns</h3>
        </div>
        <div class="card-body">
          <div class="mb-3" id="">
              <label for="patterns" class="form-label">Patterns</label>
              <select class="form-select" id="patterns">
              </select>
          </div>
          <div class="mb-3 form-check">
            <input type="checkbox" class="form-check-input" id="loop-pattern">
            <label class="form-check-label" for="loop-pattern">Loop pattern</label>
          </div>
          <div class="button-container">
              <button type="button" class="btn btn-primary" id="run-pattern">Run pattern</button>
          </div>
        </div>
      </div>
    `

    const pats = this.shadowRoot.getElementById('patterns');
    // add pattern options
    Patterns.forEach((pattern) => {
      const opt = document.createElement('option');
      opt.value = pattern.name;
      opt.text = pattern.name;
      pats.appendChild(opt);
    });
    shadow.getElementById('run-pattern').addEventListener('click', this.runPattern.bind(this));
  }

  connectedCallback() {
    EventHub.addListener(DeviceStatus.SSE_STARTED.description, this.handleSseStarted.bind(this));
    this.#sync.sync()
  }

  disconnectedCallback() {
  }

  async runPattern() {
    // @ts-ignore
    const patternName = this.shadowRoot.getElementById('patterns').value;
    const pattern = Patterns.find((p) => p.name === patternName);
    if (!pattern) {
      Logger.error('pattern not found:', patternName);
      return;
    }
    let points = pattern.points;
    if (pattern.points.length > 10) {
      // if the pattern is very large, it might be benefical to only a smaller initial part
      // so we can start to play the pattern as soon as possible, and add the remaining points after
      // we have sent the initial play command
      points = pattern.points.slice(0, 10);
    }

    await this.#client.HSP.setup(this.#token, this.#deviceKey, Math.floor(Math.random() * 1024))
    await this.#client.HSP.add(this.#token, this.#deviceKey, {
      flush: false,
      points: points,
      tail_point_stream_index: points.length - 1
    })
    await this.#client.HSP.play(this.#token, this.#deviceKey, {
      server_time: this.#sync.estimate(),
      start_time: 0,
      // @ts-ignore
      loop: this.shadowRoot.getElementById('loop-pattern').checked,
      playback_rate: 1
    })
    if (points.length < pattern.points.length) {
      // max points allowed to add is 100 in one request
      const batchCount = Math.ceil((pattern.points.length - 10) / 100);
      for (let i = 0; i < batchCount; i++) {
        const batchPoints = pattern.points.slice(10 + i * 100, 10 + (i + 1) * 100);
        // send the next batch of points
        await this.#client.HSP.add(this.#token, this.#deviceKey, {
          flush: false,
          points: batchPoints,
          tail_point_stream_index: 10 + i * 100 + batchPoints.length - 1,
        })
      }
    }
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

customElements.define('hsp-patterns', HspPatterns);

export { HspPatterns };