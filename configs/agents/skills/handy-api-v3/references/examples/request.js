/**
 * @fileoverview This file contains the request function that is used to make requests to the API.
 * 
 */
import Logger from './log.js'

/**
 * @template T
 * @typedef {Object} ApiResponse
 * @property {boolean} ok       - True if the request was successful
 * @property {T} [result]       - The result of the request if the endpoint returns a result
 * @property {object} [error]   - The error object if the request was not successful
 */

/**
 * 
 * @param {string} url 
 * @param {RequestInit} opts
 * @returns {Promise<ApiResponse<any>>}
 */
const request = async (url, opts) => {
  try {
    Logger.debug(`request ${url}`, opts)
    const rsp = await fetch(url, opts)
    if (rsp.ok) {
      const r = {
        ok: rsp.ok,
      }
      let content
      if (rsp.headers?.get('content-type') === "application/json") {
        content = await rsp.json();
      }
      Logger.debug("response", rsp.ok, rsp.status, content)
      if (r.ok) {
        r.result = content?.result ?? undefined
        r.error = content?.error ?? undefined
        if (r.result === undefined && r.error === undefined) {
          r.result = content
        }
      } else {
        r.error = content?.error ?? undefined
      }
      Logger.debug('result', r)
      return r
    } else {
      return {
        ok: false,
        error: {
          status: rsp.status,
          statusText: rsp.statusText
        }
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: error
    }
  }
}

export { request }