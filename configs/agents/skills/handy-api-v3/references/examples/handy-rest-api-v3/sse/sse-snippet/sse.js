/**
 * Minimal javascript example of how to use the SSE endpoint with EventSource.
 */
const apikey = 'APP_ID_OR_CLIENT_TOKEN'
const ck = 'DEVICE_CONNECTION_KEY'
const eventSource = new EventSource(`https://handyfeeling.com/api/handy-rest/v3/sse?apikey=${apikey}&ck=${ck}`);
/**
 * 
 * @param {MessageEvent<any>} event 
 */
eventSource.onmessage = (event) => {
  console.log(event);
};