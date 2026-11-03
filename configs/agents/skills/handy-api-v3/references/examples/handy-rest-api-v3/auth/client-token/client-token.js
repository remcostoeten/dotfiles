import {
  NewHandyApiClient
} from '../../../handy-rest-api-v3-client.js';

const html = String.raw;

class ClientTokenIssuer extends HTMLElement {
  #client = NewHandyApiClient();
  /**
   * @type {HTMLInputElement}
   */
  #appKeyInput = null;
  /**
   * @type {HTMLInputElement}
   */
  #connectionKeyInput = null;
  /**
   * @type {HTMLInputElement}
   */
  #originInput = null;
  /**
   * @type {HTMLInputElement}
   */
  #ipInput = null;
  /**
   * @type {HTMLInputElement}
   */
  #ttlInput = null;
  /**
   * @type {HTMLInputElement}
   */
  #deviceKeyInput = null;
  /**
   * @type {string}
   */
  #issuedToken = "";


  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });
    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>Client token parameters</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label for="applicationKey" class="form-label">Appliction Key (required; authenticate with the /auth/token/issue endpoint)</label>
            <input type="text" class="form-control" id="applicationKey" placeholder="Application Key">
          </div>
          <div class="mb-3">
            <label for="connectionKey" class="form-label">Connection Key (optional; restrict the token to a specific device)</label>
            <input type="text" class="form-control" id="connectionKey" placeholder="Connection Key">
          </div>
          <div class="mb-3">
            <label for="origin" class="form-label">Origin (optional; restrict the token to a specific Origin)</label>
            <input type="text" class="form-control" id="origin" placeholder="Origin">
          </div>
          <div class="mb-3">
            <label for="ip" class="form-label">IP (optional; restrict the token to a specific client IP)</label>
            <input type="text" class="form-control" id="ip" placeholder="IP">
          </div>
          <div class="mb-3">
            <label for="ttl" class="form-label">TTL (optional; defaults to 3600 seconds if not specified)</label>
            <input type="number" class="form-control" id="ttl" value="3600" placeholder="TTL">
          </div>
          <button type="button" class="btn btn-primary" id="issueToken">Issue client token</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Issued token</h3>
        </div>
        <div class="card-body">
          <pre id="token"></pre>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Device info</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label for="deviceKeyInput" class="form-label">Device connection Key</label>
            <input type="text" class="form-control" id="deviceKeyInput" placeholder="Device connection Key" value="">
          </div>
        </div>
        <div class="card-body">
          <div class="mb-3">
          Test the issued client-token with device info endpoint.
          <pre id="deviceInfo"></pre>
        </div>
        <button type="button" class="btn btn-primary" id="getDeviceInfo">Get device info</button>
      </div>
    `;

    // @ts-ignore
    this.#appKeyInput = shadow.getElementById('applicationKey');
    // @ts-ignore
    this.#connectionKeyInput = shadow.getElementById('connectionKey');
    // @ts-ignore
    this.#originInput = shadow.getElementById('origin');
    // @ts-ignore
    this.#ipInput = shadow.getElementById('ip');
    // @ts-ignore
    this.#ttlInput = shadow.getElementById('ttl');
    // @ts-ignore
    this.#deviceKeyInput = shadow.getElementById('deviceKeyInput');

    shadow.getElementById('issueToken').addEventListener('click', this.issueToken.bind(this));
    shadow.getElementById('getDeviceInfo').addEventListener('click', this.getDeviceInfo.bind(this));

    this.#appKeyInput.value = localStorage.getItem('handy-rest-api#app-key') || '';

  }

  async getDeviceInfo() {
    console.log('getDeviceInfo');
    // clear device info in UI
    this.shadowRoot.getElementById('deviceInfo').textContent = '';
    const rsp = await this.#client.INFO.getInfo(this.#issuedToken, this.#deviceKeyInput.value);
    if (rsp.ok) {
      // update device info in UI
      this.shadowRoot.getElementById('deviceInfo').textContent = JSON.stringify(rsp.result, null, 2);
      return
    }
    // show error
    this.shadowRoot.getElementById('deviceInfo').textContent = JSON.stringify(rsp.error, null, 2);
  }

  async issueToken() {
    // clear client-token info in UI
    this.shadowRoot.getElementById('token').textContent = '';
    // issue token
    localStorage.setItem('handy-rest-api#app-key', this.#appKeyInput.value);
    const rsp = await this.#client.AUTH.issueToken(this.#appKeyInput.value, {
      ck: this.#connectionKeyInput.value,
      origin: this.#originInput.value,
      ip: this.#ipInput.value,
      ttl: parseInt(this.#ttlInput.value, 10)
    });
    if (rsp.ok) {
      // update client-token info in UI
      this.shadowRoot.getElementById('token').textContent = JSON.stringify(rsp.result, null, 2);
      this.#issuedToken = rsp.result.token;
      this.#deviceKeyInput.value = this.#connectionKeyInput.value;
      return
    }
    // show error
    this.shadowRoot.getElementById('token').textContent = JSON.stringify(rsp.error, null, 2);
  }


  connectedCallback() { }
  disconnectedCallback() { }
}

customElements.define('client-token-issuer', ClientTokenIssuer);

export { ClientTokenIssuer };