# Node.js Authentication Proxy Server

This project showcases a basic Node.js server designed to act as a proxy, forwarding authentication token requests to the Handy API's client-token endpoint.

It serves as a conceptual demonstration rather than a production-ready solution, highlighting how to securely manage device-client token requests through a backend infrastructure.

By deploying a proxy server, it's possible to issue these tokens without revealing your ApplicationKey to users of your service, ensuring a secure authentication process between your service and the Handy API.

## Prerequisites

Ensure that Node.js is installed on your system before attempting to run this server. Node.js can be downloaded from the official website at [https://nodejs.org/](https://nodejs.org/).

## Usage

Follow these steps to get the server up and running:

1. **Clone the repository** to your local machine:

   ```bash
   git clone <repository-url>
   ```

2. **Navigate** to the cloned directory:

   ```bash
   cd <directory-name>
   ```

3. **Start the server** with the necessary parameters. You can run the server using an executable script, with Node directly, or through npm:

   ```bash
   # Using an executable script
   ./index.js <api-key> [port] [baseUrl] [origin]

   # Using Node
   node index.js <api-key> [port] [baseUrl] [origin]

   # Using npm
   npm run start -- <api-key> [port] [baseUrl] [origin]
   ```

   - `<api-key>`: Your API key for accessing the Handy API v3's client-token endpoint.
   - `[port]`: (Optional) The port on which the server will listen. Defaults to `3000` if not specified.
   - `[baseUrl]`: (Optional) The base URL of the Handy API v3 service. Defaults to `https://handyfeeling.com/api/handy-rest/v3` if not specified.

## Configuration

The server will listen on the specified port and is accessible via `http://127.0.0.1:[port]/`. By default, the `Access-Control-Allow-Origin` header is set to `*`. However, for production environments, it is recommended to restrict this setting to specific domains to increase security.

### Example Request

To request a client-token, send a GET request to `http://127.0.0.1:[port]/?ck=<connection-key>`, replacing `<connection-key>` with the connection key of the device for which you are issuing a token. The server will automatically resolve the client's IP address from the request.
