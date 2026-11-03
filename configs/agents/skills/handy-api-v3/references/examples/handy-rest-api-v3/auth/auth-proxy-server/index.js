#!/usr/bin/env node

import http from 'node:http'
import https from 'node:https';

if (process.argv.length < 3 || process.argv.length > 6) {
  console.error('Usage: node index.js <api-key> [port] [baseUrl] [origin]')
  process.exit(1)
}
const apikey = process.argv[2]
const port = process.argv[3] ?? 3000
const apiBaseUrl = process.argv[4] ?? 'https://handyfeeling.com/api/handy-rest/v3'
const origin = process.argv[5] ?? '*'
const authUrl = `${apiBaseUrl}/auth/token/issue`

/**
 * @param {string} authUrl
 * @returns {http.RequestListener}
 **/
const tokenProxy = (authUrl) => {

  const url = new URL(authUrl);
  const httpModule = url.protocol == "https" ? https : http;
  const port = url.port ?? (url.protocol == "https" ? 443 : 80);

  return (req, res) => {

    const q = new URL(req.url, `http://${req.headers.host}`).searchParams;

    // Get the client's IP address
    const clientIp = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
    const ip = Array.isArray(clientIp) ? clientIp[clientIp.length - 1] : clientIp;

    /** @type {https.RequestOptions} */
    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: port,
      path: `${url.pathname}?${new URLSearchParams({ ck: q.get('ck'), ip, origin }).toString()}`,
      method: 'GET',
      headers: {
        'X-Api-Key': apikey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const tokenReq = httpModule.request(options, (rsp) => {
      let data = '';
      rsp.on('data', (chunk) => {
        data += chunk;
      });
      rsp.on('end', () => {
        if (rsp.statusCode === 200) {
          try {
            const body = JSON.parse(data);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
            });
            res.end(JSON.stringify(body));
            return
          } catch (error) {
            console.error('error parsing JSON response:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('error parsing JSON response');
            return
          }
        } else {
          console.error('request failed with status code:', rsp.statusCode);
          res.writeHead(rsp.statusCode ?? 500, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': origin
          });
          res.end(data);
          return
        }
      });
    });
    tokenReq.on('error', (error) => {
      console.error('request error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': origin });
      res.end('Internal server error');
    });
    tokenReq.end();
  };
};

http.createServer(tokenProxy(authUrl)).listen(port, () => {
  console.info(`server running at http://127.0.0.1:${port}`);
})
