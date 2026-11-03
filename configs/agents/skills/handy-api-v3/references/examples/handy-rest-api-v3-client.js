/**
 * A pure JavaScript client implementation of the Handy Rest API v3.
 * @reference https://www.handyfeeling.com/api/handy-rest/v3/docs/
 */

import { request } from './request.js'
import Logger from './log.js'

/**
 * @typedef {HSPState|StrokeSettings|OtaProgress|HSPState|HampStatus|ButtonEvent|ModeChanged|ClockSynchronized|DeviceDisonnected|DeviceStatus|HDSPState} DeviceEventData
 */

/**
 * @typedef {Object} ModeChanged
 * @property {DeviceModes} mode
 */

/**
 * @typedef {Object} ClockSynchronized
 * @property {number} offset
 * @property {number} time
 * @property {number} rtd
 */

/**
 * @typedef {Object} DeviceDisonnected
 * @property {string} timestamp
 * @property {string} reason
 * @property {string} description
 * @property {string} session_id
 */

/**
 * @typedef {Object} DeviceConnected
 * @property {DeviceStatusInfo} info
 */

/**
 * @typedef {Object} DeviceStatus
 * @property {boolean} connected
 * @property {DeviceStatusInfo} [info]
 */

/**
 * @typedef {Object} HDSPState
 * @property {HDSPPlayState} play_state
 */

/**
 * @typedef {Object} SSESource
 * @property {EventSource} source - The underlying EventSource object
 * @property {string} connection_key - The connection key of the device
 * @property {string} token - The token used to authenticate with the SSE source
 * @property {(listener: (ev: SSEEvent<DeviceStatus>) => any) => void} onDeviceStatus Add a listener for device status events
 * @property {(listener: (ev: SSEEvent<DeviceConnected>) => any) => void} onDeviceConnected Add a listener for device connected events
 * @property {(listener: (ev: SSEEvent<DeviceDisonnected>) => any) => void} onDeviceDisconnected Add a listener for device disconnect events
 * @property {(listener: (ev: SSEEvent<ButtonEvent>) => any) => void} onButtonEvent  Add a listener for button events
 * @property {(listener: (ev: SSEEvent<ClockSynchronized>) => any) => void} onDeviceClockSynchronized Add a listener for device clock synchronized events
 * @property {(listener: (ev: SSEEvent<ModeChanged>) => any) => void} onModeChanged Add a listener for device mode changed events
 * @property {(listener: (ev: SSEEvent<HampStatus>) => any) => void} onHampStateChanged Add a listener for HAMP state changed events
 * @property {(listener: (ev: SSEEvent<HSPState>) => any) => void} onHspStateChanged Add a listener for HSP state changed events
 * @property {(listener: (ev: SSEEvent<OtaProgress>) => any) => void} onOtaProgress Add a listener for OTA progress events
 * @property {(listener: (ev: SSEEvent<HDSPState>) => any) => void} onHdspStateChanged Add a listener for HDSP state changed events
 * @property {(listener: (ev: SSEEvent<HSPState>) => any) => void} onHspLooping Add a listener for HSP looping events
 * @property {(listener: (ev: SSEEvent<HSPState>) => any) => void} onHspStarving Add a listener for HSP starving events
 * @property {(listener: (ev: SSEEvent<HSPState>) => any) => void} onHspThresholdReached Event listener for HSP threshold reached events
 * @property {(listener: (ev: SSEEvent<StrokeSettings>) => any) => void} onStrokeChanged Add a listener for stroke changed events
 * @property {(types: EventType[], listener: (ev: SSEEvent<DeviceEventData>) => any) => void} onEventTypes Add a listener for multiple event types
 * @property {() => void} close Close the SSESource
 * 
 */

/**
 * @typedef {Object} OtaProgress
 * @property {number} progress
 */

/**
 * @typedef {Object} ButtonEvent
 * @property {ButtonIds} button
 * @property {ButtonEventType} event
 */

/**
 * @typedef {Object} DeviceStatusInfo
 * @property {FwStatus} fw_status
 * @property {string} fw_version
 * @property {number} hw_model_no
 * @property {string} hw_model_name
 * @property {number} hw_model_variant
 * @property {string} session_id
 */

/**
 * @template T
 * @typedef {Object} SSEEvent
 * @property {string} id
 * @property {string} type
 * @property {DeviceEvent<T>} data
 */

/**
 * @template T
 * @typedef {Object} DeviceEvent
 * @property {string} connection_key
 * @property {T} data
 */

/**
 * @typedef {Object} Button
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {Object} HdspOpts
 * @property {boolean} [stop_on_target=false]
 * @property {boolean} [immediate_rsp=true]
 */

/**
  * @typedef {Object} HSPState
  * @property {string} play_state The current play state of the device. One of 'playing', 'paused', 'stopped'.
  * @property {number} points The number of points in the device buffer.
  * @property {number} max_points  The maximum number of points that can be stored in the device buffer.
  * @property {number} current_point The buffer index of the current point being played.
  * @property {number} current_time The current time of the point being played.
  * @property {boolean} loop Flag to indicate if the device is in loop mode. If true, the device will loop playback when it reaches the end of the buffer.
  * @property {number} playback_rate  The playback rate of the device. 1.0 is normal speed, 0.5 is half speed, 2.0 is double speed, etc.
  * @property {number} first_point_time The time of the first point in the buffer.
  * @property {number} last_point_time The time of the last point in the buffer.
  * @property {number} stream_id The stream ID of the current stream being played.
  * @property {number} tail_point_stream_index The stream index of the last point (tail) in the buffer.
  * @property {number} tail_point_stream_index_threshold The stream index threshold (absolute stream index) for when the device will send a threshold reached event.
  */

/**
 * @typedef {Object} HVPstate
 * @property {number} amplitude
 * @property {number} frequency
 * @property {number} position
 */

/**
 * @typedef {Object} StrokeSettings
 * @property {number} min
 * @property {number} max
 * @property {number} min_absolute
 * @property {number} max_absolute
 */

/**
 * @typedef {Object} HampStatus
 * @property {number} play_state
 * @property {number} velocity
 * @property {boolean} direction
 */

/**
 * @enum {Button}
 * @readonly
 */
const Buttons = Object.freeze({
  ON: Object.freeze({ id: 0, name: 'BUTTON_ON' }),
  UP: Object.freeze({ id: 1, name: 'BUTTON_UP' }),
  DOWN: Object.freeze({ id: 2, name: 'BUTTON_DOWN' }),
  RIGHT: Object.freeze({ id: 3, name: 'BUTTON_RIGHT' }),
  LEFT: Object.freeze({ id: 4, name: 'BUTTON_LEFT' }),
  WIFI: Object.freeze({ id: 5, name: 'BUTTON_WIFI' }),
})

/**
 * @enum {Button}
 * @readonly
 */
const ButtonByName = Object.freeze({
  BUTTON_ON: Buttons.ON,
  BUTTON_UP: Buttons.UP,
  BUTTON_DOWN: Buttons.DOWN,
  BUTTON_RIGHT: Buttons.RIGHT,
  BUTTON_LEFT: Buttons.LEFT,
  BUTTON_WIFI: Buttons.WIFI
})

/**
 * @enum {number}
 * @readonly
 */
const ButtonIds = Object.freeze({
  ON: 0,
  UP: 1,
  DOWN: 2,
  RIGHT: 3,
  LEFT: 4,
  WIFI: 5
})

/**
 * @enum {Button}
 * @readonly
 * 
 */
const ButtonById = Object.freeze({
  0: Buttons.ON,
  1: Buttons.UP,
  2: Buttons.DOWN,
  3: Buttons.RIGHT,
  4: Buttons.LEFT,
  5: Buttons.WIFI
})

/**
 * @enum {number}
 * @readonly
 */
const ButtonEventType = Object.freeze({
  PRESSED: 0,
  RELEASED: 1,
  SHORTPRESS: 2,
  LONGPRESS_START: 3,
  LONGPRESS_STEP: 4,
  LONGPRESS_END: 5
})

/**
 * @enum {number}
 * @readonly
 */
const DeviceModes = Object.freeze({
  HAMP: 0,
  HSSP: 1,
  HDSP: 2,
  MAINTENANCE: 3,
  HSP: 4,
  OTA: 5,
  BUTTON: 6,
  IDLE: 7,
  HVP: 8
})

/**
   * @enum {number}
   * @readonly
   */
const FwStatus = Object.freeze({
  OK: 0,
  UPDATE_AVAILABLE: 1,
  UPDATE_REQUIRED: 2,
})

/**
 * @enum {number}
 * @readonly
 */
const HDSPPlayState = Object.freeze({
  STOPPED: 0,
  MOVING: 1,
  REACHED: 2
})

/**
 * @typedef {'device_status'|'hdsp_state_changed'|'device_error'|
 *  'device_connected'|'device_disconnected'|'button_event'|
 *  'device_clock_synchronized'|'mode_changed'|'hamp_state_changed'|'hsp_state_changed'|
 *  'hsp_looping'|'hsp_starving'|'hsp_threshold_reached'|'stroke_changed'|'ota_progress'|'error'} EventType
 */

/**
 * @enum {EventType}
 * @readonly
 */
const EventTypes = Object.freeze({
  DeviceStatus: 'device_status',
  DeviceError: 'device_error',
  DeviceConnected: 'device_connected',
  DeviceDisconnected: 'device_disconnected',
  DeviceClockSynchronized: 'device_clock_synchronized',
  Error: 'error',
  ButtonEvent: 'button_event',
  ModeChanged: 'mode_changed',
  HampStateChanged: 'hamp_state_changed',
  HdspStateChanged: 'hdsp_state_changed',
  HspStateChanged: 'hsp_state_changed',
  HspLooping: 'hsp_looping',
  HspStarving: 'hsp_starving',
  HspThresholdReached: 'hsp_threshold_reached',
  StrokeChanged: 'stroke_changed',
  OtaProgress: 'ota_progress'
})

/**
 * @template T
 * @typedef {import('./request.js').ApiResponse<T>} ApiResponse
 */


/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} t
 */


const EventTypeNames = new Set(Object.values(EventTypes))

/**
 * Create a new Handy API client
 * @param {string} [baseUrl]
 * @returns 
 */
const NewHandyApiClient = (baseUrl = 'https://handyfeeling.com/api/handy-rest/v3') => {

  const AUTH = {
    /**
     * @typedef {Object} Token
     * @property {string} token
     * @property {string} renew
     */
    /**
     * @typedef {Object} TokenOpts
     * @property {string} [ck]      - The connection key of the device to issue a token to
     * @property {string} [ip]      - The IP address of the client to issue a token to
     * @property {string} [origin]  - The origin the token is valid for
     * @property {number} [ttl]     - The time to live of the token in seconds
     */
    /**
     * 
     * @param {string} apikey     - The application key to use when authenticating with the token issuer endpoint.
     * @param {TokenOpts} opts    - The options for the token
     * @returns {Promise<ApiResponse<Token>>}
     */
    issueToken: async (apikey, opts = {}) => {
      const p = new URLSearchParams()
      if (apikey) {
        p.append('apikey', apikey)
      }
      if (opts.ck && opts.ck.length > 0) {
        p.append('ck', opts.ck)
      }
      if (opts.ip && opts.ip.length > 0) {
        p.append('ip', opts.ip)
      }
      if (opts.origin && opts.origin.length > 0) {
        p.append('origin', opts.origin)
      }
      if (opts.ttl && opts.ttl > 0) {
        p.append('ttl', opts.ttl.toString())
      }
      return request(`${baseUrl}/auth/token/issue?${p.toString()}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apikey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    }
  }

  const HAMP = {

    /**
     * 
     * @param {string} token 
     * @param {string} ck  
     * @returns {Promise<ApiResponse<HampStatus>>}
     */
    start: async (token, ck) => {
      return request(`${baseUrl}/hamp/start`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck
     * @returns {Promise<ApiResponse<HampStatus>>}
     */
    stop: async (token, ck) => {
      return request(`${baseUrl}/hamp/stop`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {number} velocity 
     * @returns {Promise<ApiResponse<HampStatus>>}
     */
    setVelocity: async (token, ck, velocity) => {
      return request(`${baseUrl}/hamp/velocity`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          velocity
        })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HampStatus>>}
     */
    getVelocity: async (token, ck) => {
      return request(`${baseUrl}/hamp/velocity`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns  {Promise<ApiResponse<HampStatus>>}
     */
    getState: async (token, ck) => {
      return request(`${baseUrl}/hamp/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    }
  }

  const INFO = {
    /**
     * @typedef {Object} Timestamp
     * @property {number} seconds
     * @property {number} nanos
     */
    /**
     * @typedef {Object} DeviceMessageStatistics
     * @property {number} transit_size
     * @property {number} max_transit_size
     * @property {number} buffer_size
     * @property {number} max_buffer_size
     * @property {number} total_bytes
     * @property {number} total_messages
     * @property {number} dropped_bytes
     * @property {number} dropped_messages
     * @property {number} acked_bytes
     * @property {number} acked_messages
     * @property {Timestamp} timestamp
     * 
     */
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<DeviceMessageStatistics>>}
     */
    getStatistics: async (token, ck) => {
      return request(`${baseUrl}/info`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * @typedef {Object} DeviceConnectedStatus
     * @property {boolean} connected
     */
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<DeviceConnectedStatus>>}
     */
    isConnected: async (token, ck) => {
      return request(`${baseUrl}/connected`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * @typedef {Object} DeviceInfo
     * @property {number} fw_status
     * @property {string} fw_version
     * @property {number} hw_model_no
     * @property {string} hw_model_name
     * @property {number} hw_model_variant
     */
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<DeviceInfo>>}
     */
    getInfo: async (token, ck) => {
      return request(`${baseUrl}/info`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * @typedef {Object} DeviceMode
     * @property {number} mode
     */
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<DeviceMode>>}
     */
    getMode: async (token, ck) => {
      return request(`${baseUrl}/mode`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {number} mode
     * @returns {Promise<ApiResponse<string>>}
     */
    setMode: async (token, ck, mode) => {
      return request(`${baseUrl}/mode`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ mode })
      })
    }
  }

  const UTILS = {
    /**
     * 
     * @returns {Promise<ApiResponse<{server_time:number}>>}
     */
    getServerTime: async () => {
      return request(`${baseUrl}/servertime`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
    }
  }

  const HSTP = {
    /**
     * 
     * @param {string} token 
     * @param {string} ck
     * @returns {Promise<ApiResponse<{time:number,clock_offset:number,rtd:number}>>}
     */
    getInfo: async (token, ck) => {
      return request(`${baseUrl}/hstp/info`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<string>>}
     */
    initClockSync: async (token, ck) => {
      return request(`${baseUrl}/hstp/clocksync`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck
     * @param {number} offset 
     * @returns {Promise<ApiResponse<string>>}
     */
    setOffset: async (token, ck, offset) => {
      return request(`${baseUrl}/hstp/offset`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ offset })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<{offset:number}>>}
     */
    getOffset: async (token, ck) => {
      return request(`${baseUrl}/hstp/offset`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    }
  }

  const SLIDER = {

    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<StrokeSettings>>}
     */
    getStroke: async (token, ck) => {
      return request(`${baseUrl}/slider/stroke`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{min?: number, max?:number}} stroke 
     * @returns {Promise<ApiResponse<StrokeSettings>>}
     */
    setStroke: async (token, ck, stroke) => {
      return request(`${baseUrl}/slider/stroke`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(stroke)
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<StrokeSettings>>}
     */
    getState: async (token, ck) => {
      return request(`${baseUrl}/slider/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    }
  }

  const AllEventTypes = Object.values(EventTypes)

  /**
   * Wraps an EventSource object to provide a more structured event handling API.
   * @param {string} token
   * @param {string} ck
   * @param {EventSource} es
   * @returns {SSESource} 
   */
  const eventSourceWrapper = (token, ck, es) => {
    const subs = new Map()
    /**
     * Wraps the listener in order to perform de-serialization, formatting and filtering of events.
     * @param {EventType} type 
     * @param {(ev: SSEEvent<any>) => any} listener 
     */
    const onEvent = (type, listener) => {
      /**
       * 
       * @param {MessageEvent<any>} event 
       * @returns 
       */
      const handler = (event) => {
        /** @ts-ignore */
        Logger.assert(EventTypeNames.has(event.type), `Invalid event type: ${event.type}`)
        try {
          const data = JSON.parse(event.data);
          return listener({
            id: event.lastEventId,
            type,
            data
          })
        } catch (err) {
          // ignore
        }
      }
      subs.set(listener, handler)
      es.addEventListener(type, handler)
    }
    /**
     * 
     * @param {(ev: SSEEvent<DeviceStatus>) => any} listener
     */
    const onDeviceStatus = (listener) => {
      onEvent(EventTypes.DeviceStatus, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<DeviceConnected>) => any} listener 
     */
    const onDeviceConnected = (listener) => {
      onEvent(EventTypes.DeviceConnected, listener)
    }
    /**
     * @param {(ev: SSEEvent<DeviceDisonnected>) => any} listener
     */
    const onDeviceDisconnected = (listener) => {
      onEvent(EventTypes.DeviceDisconnected, listener)
    }
    /**
     * @param {(ev: SSEEvent<ButtonEvent>) => any} listener
     */
    const onButtonEvent = (listener) => {
      onEvent(EventTypes.ButtonEvent, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<ClockSynchronized>) => any} listener 
     */
    const onDeviceClockSynchronized = (listener) => {
      onEvent(EventTypes.DeviceClockSynchronized, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<ModeChanged>) => any} listener 
     */
    const onModeChanged = (listener) => {
      onEvent(EventTypes.ModeChanged, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HampStatus>) => any} listener 
     */
    const onHampStateChanged = (listener) => {
      onEvent(EventTypes.HampStateChanged, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HSPState>) => any} listener 
     */
    const onHspStateChanged = (listener) => {
      onEvent(EventTypes.HspStateChanged, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<OtaProgress>) => any} listener 
     */
    const onOtaProgress = (listener) => {
      onEvent(EventTypes.OtaProgress, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HDSPState>) => any} listener 
     */
    const onHdspStateChanged = (listener) => {
      onEvent(EventTypes.HdspStateChanged, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HSPState>) => any} listener 
     */
    const onHspLooping = (listener) => {
      onEvent(EventTypes.HspLooping, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HSPState>) => any} listener 
     */
    const onHspStarving = (listener) => {
      onEvent(EventTypes.HspStarving, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<HSPState>) => any} listener 
     */
    const onHspThresholdReached = (listener) => {
      onEvent(EventTypes.HspThresholdReached, listener)
    }
    /**
     * 
     * @param {(ev: SSEEvent<StrokeSettings>) => any} listener 
     */
    const onStrokeChanged = (listener) => {
      onEvent(EventTypes.StrokeChanged, listener)
    }

    /**
     * Adds the listener to the specified event types
     * @param {EventType[]} types 
     * @param {(ev: SSEEvent<DeviceEventData>) => any} listener 
     */
    const onEventTypes = (types = AllEventTypes, listener) => {
      types.forEach(t => onEvent(t, listener))
    }

    /**
     * Close the SSESource
     */
    const close = () => {
      es.close()
    }

    return {
      token,
      connection_key: ck,
      source: es,
      onDeviceStatus,
      onDeviceConnected,
      onDeviceDisconnected,
      onButtonEvent,
      onDeviceClockSynchronized,
      onModeChanged,
      onHampStateChanged,
      onHspStateChanged,
      onHspLooping,
      onOtaProgress,
      onHspStarving,
      onHspThresholdReached,
      onHdspStateChanged,
      onStrokeChanged,
      onEventTypes,
      close,
    }
  }

  const SSE = {
    EventTypes,
    AllEventTypes,
    EventTypeNames,
    /**
     * Create a new EventSource for the Handy API SSE endpoint.
     * The EventSource will be configured to receive events of the specified types.
     * If no types are specified the EventSource defaults to all event types.
     * @param {string} token 
     * @param {string} ck
     * @param {EventType[]} [events]
     * @returns {SSESource}
     */
    newSSESource: (token, ck, events) => {
      const q = new URLSearchParams({ ck, apikey: token })
      if (events?.length > 0) {
        q.append('events', events.join(','))
      }
      return eventSourceWrapper(token, ck, new EventSource(`${baseUrl}/sse?${q.toString()}`, { withCredentials: false }))
    },
  }

  /**
  * Creates a new client clock syncer
  * @param {{samples:number, outliers: number}} [opts] 
  */
  const NewClientSyncer = (opts = { outliers: 5, samples: 30 }) => {

    // Default options
    opts.outliers = opts.outliers ?? 5
    opts.samples = opts.samples ?? 30

    // The measured clock offset
    let _offset = 0

    /**
     * Sychronize the client's clock with the server by calculating the client-server clock offset.
     * The offset value is used when estimating the server time.
     * The sampling and offset calculation is the same as described in
     * {@link https://www.handyfeeling.com/api/handy-rest/v3/docs/#/UTILS/getServerTime} with outliers removed.
     * @returns {Promise<{offset:number, rtd:number}>}
     */
    const sync = async () => {
      const s = []
      for (let i = 0; i < opts.samples; i++) {
        const start = Date.now()
        const r = await UTILS.getServerTime()
        const end = Date.now()
        if (r.ok) {
          const rtd = end - start // Round trip delay
          const srvTimeEst = (rtd / 2) + r.result.server_time // Estimated server time at the point of request start
          s.push({
            srvTimeEst,
            rtd,
            start,
            end,
            time: r.result.server_time,
            offset: srvTimeEst - end
          })
        }
      }
      // Sort by RTD and remove max outliers
      s.sort((a, b) => a.rtd - b.rtd)
      s.splice(-opts.outliers)

      let offsetAccum = 0
      for (let i = 0; i < s.length; i++) {
        offsetAccum += s[i].offset
      }
      _offset = offsetAccum / s.length
      return {
        offset: _offset,
        rtd: s.reduce((acc, cur) => acc + cur.rtd, 0) / s.length
      }
    }

    /**
     * Get a new current server time estimate.
     * @returns  {number}
     */
    const estimate = () => {
      return Math.round(Date.now() + _offset)
    }

    return {
      sync,
      estimate
    }
  }



  /**
   * 
   */
  const HSSP = {
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {string} url 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    setup: async (token, ck, url) => {
      return request(`${baseUrl}/hssp/setup`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck
     * @param {number} startTime
     * @param {number} serverTime
     * @param {{playbackRate: number, loop: boolean}} [opts]
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    play: async (token, ck, startTime, serverTime, opts) => {
      const playback_rate = opts?.playbackRate ?? 1.0
      const loop = opts?.loop ?? false
      return request(`${baseUrl}/hssp/play`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ start_time: startTime, server_time: serverTime, playback_rate, loop })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    stop: async (token, ck) => {
      return request(`${baseUrl}/hssp/stop`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    getState: async (token, ck) => {
      return request(`${baseUrl}/hssp/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{current_time:number, server_time:number, filter?:number}} syncOpts 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    synctime: async (token, ck, syncOpts) => {
      return request(`${baseUrl}/hssp/synctime`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(syncOpts)
      })
    }
  }

  const HDSP = {
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {number} xa 
     * @param {number} va
     * @param {HdspOpts} [opts] 
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xava: async (token, ck, xa, va, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xava`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xa, va, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    },
    /**
     * @param {string} token
     * @param {string} ck
     * @param {number} xa
     * @param {number} vp
     * @param {HdspOpts} [opts] 
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xavp: async (token, ck, xa, vp, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xavp`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xa, vp, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    },
    /**
     * @param {string} token
     * @param {string} ck
     * @param {number} xp
     * @param {number} va
     * @param {HdspOpts} [opts] 
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xpva: async (token, ck, xp, va, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xpva`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xp, va, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    },
    /**
     * @param {string} token
     * @param {string} ck
     * @param {number} xp
     * @param {number} vp
     * @param {HdspOpts} [opts]
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xpvp: async (token, ck, xp, vp, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xpvp`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xp, vp, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    },
    /**
     * @param {string} token
     * @param {string} ck
     * @param {number} xa
     * @param {number} t
     * @param {HdspOpts} [opts]
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xat: async (token, ck, xa, t, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xat`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xa, t, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    },
    /**
     * @param {string} token
     * @param {string} ck
     * @param {number} xp
     * @param {number} t
     * @param {HdspOpts} [opts]
     * @returns {Promise<ApiResponse<undefined>>}
     */
    xpt: async (token, ck, xp, t, opts = { immediate_rsp: true, stop_on_target: false }) => {
      opts.immediate_rsp = opts.immediate_rsp ?? true
      opts.stop_on_target = opts.stop_on_target ?? false
      return request(`${baseUrl}/hdsp/xpt`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ xp, t, immediate_rsp: opts.immediate_rsp, stop_on_target: opts.stop_on_target })
      })
    }
  }

  const HSP = {
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {number} stream_id 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    setup: async (token, ck, stream_id) => {
      return request(`${baseUrl}/hsp/setup`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ stream_id })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    flush: async (token, ck) => {
      return request(`${baseUrl}/hsp/flush`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{points:Point[], flush: boolean, tail_point_stream_index:number}} data
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    add: async (token, ck, data) => {
      return request(`${baseUrl}/hsp/add`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{start_time:number, server_time:number, playback_rate?:number, loop?: boolean}} playOpts 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    play: async (token, ck, playOpts) => {
      return request(`${baseUrl}/hsp/play`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(playOpts)
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    stop: async (token, ck) => {
      return request(`${baseUrl}/hsp/stop`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {number} threshold 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    setThreshold: async (token, ck, threshold) => {
      return request(`${baseUrl}/hsp/threshold`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ tail_point_threshold: threshold })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    getState: async (token, ck) => {
      return request(`${baseUrl}/hssp/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{current_time:number, server_time:number, filter:number}} syncOpts 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    synctime: async (token, ck, syncOpts) => {
      return request(`${baseUrl}/hssp/synctime`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(syncOpts)
      })
    }
  }

  const HVP = {

    /**
     * 
     * @param {string} token 
     * @param {string} ck 
    * @returns {Promise<ApiResponse<HVPstate>>}
     */
    getState: async (token, ck) => {
      return await request(`${baseUrl}/hvp/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {HVPstate} state
     * @returns {Promise<ApiResponse<HVPstate>>}
     */
    setState: async (token, ck, state) => {
      return request(`${baseUrl}/hvp/state`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(state)
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HVPstate>>}
     */
    start: async (token, ck) => {
      return request(`${baseUrl}/hvp/start`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HVPstate>>}
     */
    stop: async (token, ck) => {
      return request(`${baseUrl}/hvp/stop`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    }
  }

  const STREAM = {
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {string} stream_id 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    setup: async (token, ck, stream_id) => {
      return request(`${baseUrl}/stream/setup`, {
        method: 'POST',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ stream_id })
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @param {{start_time:number, server_time:number, playback_rate?:number, loop?:boolean}} playOpts
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    play: async (token, ck, playOpts) => {
      return request(`${baseUrl}/stream/start`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    stop: async (token, ck) => {
      return request(`${baseUrl}/stream/stop`, {
        method: 'PUT',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    },
    /**
     * 
     * @param {string} token 
     * @param {string} ck 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    getState: async (token, ck) => {
      return request(`${baseUrl}/stream/state`, {
        method: 'GET',
        headers: {
          'X-Connection-Key': ck,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    }
  }

  /**
   * @typedef {Object} Point
   * @property {number} x
   * @property {number} t
   */

  const newStreamId = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

  const DefaultThreshold = 20
  const DefaultBatchSize = 100

  /**
   * Creates a new HSP stream utility for pushing points to a device.
   * @typedef {Object} StreamOpts
   * @property {number} id
   * @property {number} threshold
   * @property {number} batchSize
   */
  /**
   * @param {StreamOpts} [opts]
   * @returns 
   */
  const NewHspStream = (opts = { id: newStreamId(), threshold: DefaultThreshold, batchSize: DefaultBatchSize }) => {

    // Defaults
    const id = opts.id ?? newStreamId()
    const defaultThreshold = opts.threshold ?? DefaultThreshold
    const defaultBatchSize = opts.batchSize ?? DefaultBatchSize
    // 
    const target = new EventTarget()

    /**
     * @typedef {Object} StreamConsumer
     * @property {boolean} sseOwner Flag indicating if the consumer is the owner of the sse source.
     * @property {string} token The authentication token of the consumer.
     * @property {string} ck         The connection key of the device.
     * @property {HSPState} state    The current HSP state of the device.
     * @property {SSESource} sse   The sse event source for the consumer.
     * @property {number} threshold  The threshold value for when the device will notify the consumer that is has reached the threshold.
     * @property {number} batchSize  The maximum number of points to push to the device in a single batch.
     * @property {boolean} isPushing Flag indicating if the consumer is currently pushing points to the device.
     * @property {number} prevPushTime The last time the consumer pushed points to the device.
     * @property {(e: SSEEvent<HSPState>)=>Promise<void>} starvingCallback
     * @property {(e: SSEEvent<HSPState>)=>Promise<void>} thresholdCallback
     * @property {(e: SSEEvent<HSPState>)=>Promise<void>} hspStateChangedCallback
     * @property {(e: CustomEvent<any>) => Promise<void>} pointsCb
     */
    /**
     * @type {Map<string,StreamConsumer>}
     */
    const subs = new Map()
    /**
     * @type {Point[]}
     */
    const streamPoints = []

    /**
     * @param {StreamConsumer} consumer
     */
    const hspThresholdReached = (consumer) => {
      /**
       * @param {SSEEvent<HSPState>} e
       */
      return async (e) => {
        if (e.data) {
          Logger.debug('device %s hsp threshold reached', consumer.ck)
          consumer.state = e.data.data
          const r = await pushToConsumer(consumer)
          if (!r) {
            Logger.debug('no points pushed, no points available to push to device')
            return
          }
          if (!r.ok) {
            Logger.error('failed to push points to device', r.error)
            return
          }
          Logger.debug('points pushed to device', r.result)
        }
      }
    }

    /**
    * @param {StreamConsumer} consumer
    */
    const hspStateChanged = (consumer) => {
      /**
      * @param {SSEEvent<HSPState>} e
      */
      return async (e) => {
        if (e?.data?.data) {
          Logger.debug('device %s hsp state change', consumer.ck)
          // Push more points to the stream if there are any available
          if (consumer.state.stream_id !== e.data.data.stream_id) {
            // Device have been setup with a different stream
            // Close the consumer
            consumer.sse.close()
            subs.delete(consumer.ck)
            return
          }
          consumer.state = e.data.data
        }
      }
    }

    /**
    * @param {StreamConsumer} consumer
    */
    const hspStarving = (consumer) => {
      /**
      * @param {SSEEvent<HSPState>} e
      */
      return async (e) => {
        if (e.data) {
          Logger.debug('device %s starving', consumer.ck)
          // Push more points to the stream if there are any available
          consumer.state = e.data.data
          const r = await pushToConsumer(consumer)
          if (!r) {
            Logger.debug('no points pushed, no points available to push to device')
            return
          }
          if (!r.ok) {
            Logger.error('failed to push points to device', r.error)
            return
          }
          Logger.debug('points pushed to device', r.result)
        }
      }
    }

    /**
     * @typedef {Object} PointsAddedEvent
     */

    /**
    * @param {StreamConsumer} consumer
    * @returns {(e: CustomEvent<PointsAddedEvent>) => Promise<void>}
    */
    const pointsAdded = (consumer) => {
      /**
       * @param {CustomEvent<{points: number, tail_point_stream_index: number}>} e
       */
      return async (e) => {
        if (e.detail) {
          // TODO: fix inconsistent number/string play_state value in API
          // @ts-ignore
          if (consumer.state?.play_state === 4 || consumer.state?.play_state === 'HSP_STATE_STARVING') {
            Logger.debug('starving, trying to push newly added points to device')
            const r = await pushToConsumer(consumer)
            if (!r) {
              Logger.debug('no points pushed, no new points available to push to device')
              return
            }
            if (!r.ok) {
              Logger.error('failed to push points to device', r.error)
              return
            }
            Logger.debug('points pushed to device', r.result)
          }
        }
      }
    }

    /**
     * 
     * @param {StreamConsumer} consumer 
     * @returns {Promise<ApiResponse<HSPState>>}
     */
    const pushToConsumer = async (consumer) => {
      if (consumer.isPushing) {
        // Already pushing points to the device
        Logger.debug('already pushing points to device, ignoring push request')
        return { ok: true, result: consumer.state }
      }
      try {
        consumer.isPushing = true
        Logger.debug("consumer tail_point_stream_index", consumer.state.tail_point_stream_index)
        let chunk
        if (consumer.prevPushTime === 0) {
          chunk = streamPoints.slice(0, consumer.batchSize)
        } else {
          const nextChunkStart = consumer.state.tail_point_stream_index + 1
          chunk = streamPoints.slice(nextChunkStart, nextChunkStart + consumer.batchSize)
        }
        Logger.debug("chunk_size, stream_size", chunk.length, streamPoints.length)
        if (chunk.length === 0) {
          Logger.debug('no new points available to push to device')
          return { ok: true, result: consumer.state }
        }
        const tail_point_stream_index = consumer.state.tail_point_stream_index + chunk.length
        let rsp = await HSP.add(consumer.token, consumer.ck, { points: chunk, flush: false, tail_point_stream_index })
        if (rsp) {
          if (rsp.ok) {
            if (!rsp.result) {
              Logger.error("no state returned", rsp)
              return { ok: false, error: 'no state returned' }
            }
            consumer.state = rsp.result ?? consumer.state
            rsp = await HSP.setThreshold(consumer.token, consumer.ck, Math.max(0, tail_point_stream_index - consumer.threshold))
            if (rsp) {
              if (rsp.ok) {
                if (!rsp.result) {
                  Logger.error("no state returned", rsp)
                  return { ok: false, error: 'no state returned' }
                }
              }
              consumer.state = rsp.result ?? consumer.state
              consumer.prevPushTime = Date.now()
              return rsp
            }
            return { ok: false, error: 'failed to set threshold' }
          } else {
            return { ok: false, error: rsp.error }
          }
        }
      } catch (err) {
        Logger.error('failed to push points to device', err)
        return { ok: false, error: err }
      } finally {
        consumer.isPushing = false
        Logger.debug('pushing points to device completed')
      }
    }

    const PointsAdded = 'points'

    /**
       * 
       * @param {EventListenerOrEventListenerObject} callback
       * @param {boolean | AddEventListenerOptions} options 
       */
    const onPoints = (callback, options) => {
      target.addEventListener(PointsAdded, callback, options)
    }

    /**
      * 
      * @param {Point[]} points 
      * @returns 
      */
    const append = (points) => {
      if (!Array.isArray(points) || points.length === 0) {
        return streamPoints.length
      }
      const i = streamPoints.push(...points)
      target.dispatchEvent(new CustomEvent(PointsAdded, { detail: { points: points.length, tail_point_stream_index: i } }))
      return i
    }

    /**
       * Read the next n points from the stream starting at index i.
       * @param {number} i 
       * @param {number} n 
       * @returns {Point[]}
       */
    const read = (i, n) => {
      return streamPoints.slice(i, n)
    }

    /**
      * 
      * @returns {number} The current number of points in the stream
      */
    const len = () => {
      return streamPoints.length
    }
    /**
     * 
     * @returns {number} The stream id
     */
    const streamId = () => {
      return id
    }

    /**
     * @typedef {Object} ConsumerOpts
     * @property {number} [threshold] The relative threshold value (remaining playable points) at which the device will notify the consumer.
     * @property {number} [batchSize] The number of points to push to the device in a single batch.
     * @property {SSESource} [sse] Optional SSE source to use for the consumer. If not provided a new SSE source will be created.
     */
    /**
     * Adds a new consumer to the stream.
     * @param {string} token
     * @param {string} ck
     * @param {ConsumerOpts} [opts] 
     */
    const addConsumer = async (token, ck, opts) => {
      /**
       * @type {StreamConsumer}
       */
      const consumer = {
        pointsCb: undefined,
        starvingCallback: undefined,
        thresholdCallback: undefined,
        hspStateChangedCallback: undefined,
        sseOwner: !opts?.sse,
        token,
        ck,
        state: undefined,
        threshold: opts?.threshold ?? defaultThreshold,
        batchSize: opts?.batchSize ?? defaultBatchSize,
        sse: opts?.sse ?? SSE.newSSESource(token, ck),
        isPushing: false,
        prevPushTime: 0
      }
      // HSP event handlers
      consumer.hspStateChangedCallback = hspStateChanged(consumer)
      consumer.sse.onHspThresholdReached(consumer.hspStateChangedCallback)
      consumer.thresholdCallback = hspThresholdReached(consumer)
      consumer.sse.onHspThresholdReached(hspThresholdReached(consumer))
      consumer.starvingCallback = hspStarving(consumer)
      consumer.sse.onHspStarving(hspStarving(consumer))
      consumer.pointsCb = pointsAdded(consumer)
      target.addEventListener('points', consumer.pointsCb)
      subs.set(consumer.ck, consumer)

      // Setup the stream on the device
      let rsp = await HSP.setup(consumer.token, consumer.ck, id)
      if (rsp.ok) {
        consumer.state = rsp.result
        // push some initial stream points.
        rsp = await pushToConsumer(consumer)
      }
      if (!rsp.ok) {
        // Initial push failed, close the consumer
        closeConsumer(consumer.ck)
      }
    }
    /**
     * 
     * @param {string} ck
     * @returns {HSPState} 
     */
    const closeConsumer = (ck) => {
      const consumer = subs.get(ck)
      if (consumer) {
        if (consumer.sseOwner) {
          consumer.sse?.close()
        } else {

        }
        target.removeEventListener('points', consumer.pointsCb)
        subs.delete(ck)
        return consumer.state
      }
    }

    return {
      onPoints,
      append,
      read,
      len,
      streamId,
      addConsumer,
      closeConsumer
    }
  }

  return {
    AUTH,
    INFO,
    HAMP,
    HDSP,
    HSTP,
    HSSP,
    HSP,
    HVP,
    UTILS,
    SLIDER,
    SSE,
    STREAM,
    NewClientSyncer,
    NewHspStream,
  }
}

export { NewHandyApiClient }

Logger.debug('handy client loaded');