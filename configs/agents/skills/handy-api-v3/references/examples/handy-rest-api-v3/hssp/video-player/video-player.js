import { NewHandyApiClient } from '../../../handy-rest-api-v3-client.js';
import EventHub from '../../../event_hub.js'
import Logger from '../../../log.js'
import { DeviceStatus } from '../../sse/device-status/device-status.js'


const html = String.raw;

class VideoPlayer extends HTMLElement {

  #client = NewHandyApiClient();
  /** @type {string} */
  #deviceKey
  /** @type {import('../../../handy-rest-api-v3-client.js').SSESource}  */
  #sse
  /** @type {string} */
  #token
  #videoUrl = 'https://sweettecheu.s3.eu-central-1.amazonaws.com/testsync/sync_video_2021.mp4'
  #funscriptUrl = 'https://sweettecheu.s3.eu-central-1.amazonaws.com/testsync/sync_video_2021.csv'
  /**
   * @type {HTMLVideoElement}
   */
  #videoPlayer = null;
  /**
   * @type {HTMLInputElement}
   */
  #offset = null;
  /**
   * @type {NodeJS.Timeout}
   */
  #timer = null;
  #syncer = this.#client.NewClientSyncer({ outliers: 5, samples: 30 })

  constructor() {
    super();
    // Attach a shadow DOM tree to the element
    const shadow = this.attachShadow({
      mode: 'open'
    });
    shadow.innerHTML = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
      <div class="card">
        <div class="card-header">
          <h3>Video</h3>
        </div>  
        <div class="card-body">
          <p class="card-text">Play a video and sync it with a funscript.
          </p>
          <form>
            <div class="mb-3" id="">
              <label for="offset" class="form-label custom-input-width">Offset:&nbsp&nbsp</label><span id="offsetValue">0</span>
              <input type="range" id="offset" name="offset" min="-500" max="500" value="0" class="form-range">              
            </div>
            <div class="mb-3" id="">
              <video id="videoPlayer" width="640" height="360" controls>
                <source id="videoSource" src="${this.#videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
            </div>
          </form>
        </div>
      </div>
    `;

    // video player element handling
    this.#videoPlayer = this.shadowRoot.querySelector('#videoPlayer');
    this.#videoPlayer.addEventListener('playing', this.onPlay.bind(this));
    this.#videoPlayer.addEventListener('pause', this.onPause.bind(this));
    this.#videoPlayer.addEventListener('ratechange', this.onPlaybackRateChange.bind(this));
    this.#videoPlayer.addEventListener('seeking', this.onPause.bind(this));
    this.#videoPlayer.addEventListener('stalled', this.onPause.bind(this));
    this.#videoPlayer.addEventListener('waiting', this.onPause.bind(this));

    this.#offset = this.shadowRoot.querySelector('#offset');
    this.#offset.addEventListener('change', (event) => {
      this.#client.HSTP.setOffset(this.#token, this.#deviceKey, parseInt(this.#offset.value)).then((rsp) => {
        if (rsp.ok) {
          this.shadowRoot.getElementById('offsetValue').innerText = this.#offset.value
        }
      })
    });
  }

  connectedCallback() {
    EventHub.addListener(DeviceStatus.SSE_STARTED.description, this.onSSEStarted.bind(this));
    this.#syncer.sync()
  }

  disconnectedCallback() { }

  /**
   * 
   * @param {Event} event 
   */
  onPlaybackRateChange(event) {
    if (!this.#videoPlayer.paused && !this.#videoPlayer.ended && this.#videoPlayer.currentTime > 0) {
      // update the playback rate on the device if the video is playing
      this.#client.HSSP.play(this.#token, this.#deviceKey, Math.round(this.#videoPlayer.currentTime * 1000), this.#syncer.estimate(), {
        loop: this.#videoPlayer.loop,
        playbackRate: this.#videoPlayer.playbackRate,
      })
    }
  }

  /**
   * 
   * @param {Event} event 
   */
  onPlay(event) {
    this.#client.HSSP.play(this.#token, this.#deviceKey, Math.round(this.#videoPlayer.currentTime * 1000), this.#syncer.estimate(), {
      loop: this.#videoPlayer.loop,
      playbackRate: this.#videoPlayer.playbackRate,
    }).then((rsp) => {
      if (rsp.ok) {
        this.videoSyncTime(0, 2000)
      }
    })
  }

  /**
   * 
   * @param {Event} event 
   */
  onPause(event) {
    clearTimeout(this.#timer)
    this.#client.HSSP.stop(this.#token, this.#deviceKey)
  }

  /**
   * @param {number} counter
   * @param {number} interval 
   */
  videoSyncTime(counter, interval) {
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = setTimeout(() => {
      counter++
      this.#client.HSSP.synctime(this.#token, this.#deviceKey, {
        current_time: Math.round(this.#videoPlayer.currentTime * 1000),
        server_time: this.#syncer.estimate(),
        filter: counter === 1 ? 0.9 : 0.5     // hard filter on first sync time adjustment, then softer
      })
      this.videoSyncTime(counter, counter === 1 ? 2000 : 15000) // first sync time adjustment after 2s, then every 15s
    }, interval)
  }

  /**
   * 
   * @param {CustomEvent} event 
   */
  onSSEStarted(event) {
    // Handle the event
    const sse = event.detail.sse;
    this.#sse = sse;
    this.#deviceKey = sse.connection_key;
    this.#token = sse.token
    Logger.debug('sse started for device', this.#deviceKey, this.#token);
    this.#sse.onDeviceStatus((event) => {
      if (event.data.data.connected) {
        this.#client.HSSP.setup(this.#token, this.#deviceKey, this.#funscriptUrl).then((rsp) => {
          if (!rsp.ok) {
            Logger.error('failed to setup', rsp.error)
            alert('failed to setup script')
          }
        })
        this.#client.HSTP.getOffset(this.#token, this.#deviceKey).then((rsp) => {
          if (rsp.ok) {
            this.#offset.value = rsp.result.offset + ''
            this.shadowRoot.getElementById('offsetValue').innerText = this.#offset.value
          }
        })
      }
    })
    this.#sse.onDeviceDisconnected(this.onPause.bind(this))
    this.#sse.onDeviceConnected((event) => {
      this.#client.HSTP.getOffset(this.#token, this.#deviceKey).then((rsp) => {
        if (rsp.ok) {
          this.#offset.value = rsp.result.offset + ''
          this.shadowRoot.getElementById('offsetValue').innerText = this.#offset.value
        }
      })
      this.#client.HSSP.setup(this.#token, this.#deviceKey, this.#funscriptUrl).then((rsp) => {
        if (!rsp.ok) {
          Logger.error('failed to setup', rsp.error)
          alert('failed to setup script')
        }
      })
    })
  }

}

// Define the new element
customElements.define('video-player', VideoPlayer);
