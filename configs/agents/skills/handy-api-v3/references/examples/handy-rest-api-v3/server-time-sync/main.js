import { NewHandyApiClient } from '../../handy-rest-api-v3-client.js';
const apiHost = document.getElementById('apiHost');
// @ts-ignore
const ApiClient = NewHandyApiClient(`${apiHost.innerText}/api/handy-rest/v3`);
const ClientSyncer = ApiClient.NewClientSyncer();

const initialize = async () => {
  console.log('onload');
  document.getElementById('syncClient').addEventListener('click', async () => {
    const result = await ClientSyncer.sync();
    console.log('Offset:', result);
    // Update the view 
    document.getElementById('offset').innerHTML = `${result.offset}ms`;
    document.getElementById('rtd').innerHTML = `${result.rtd}ms`;
  });
  document.getElementById('timeEstimate').addEventListener('click', async () => {
    const estimate = ClientSyncer.estimate();
    console.log('Estimate:', estimate);
    // Update the view 
    document.getElementById('estimate').innerHTML = `${estimate}`;
  });
}

if (document.readyState === 'complete') {
  // Document is already loaded, initialize directly
  initialize();
} else {
  // Document not loaded yet, wait for load event
  window.onload = initialize;
}
