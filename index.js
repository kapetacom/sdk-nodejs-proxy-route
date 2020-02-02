const URL = require('url');
const Path = require('path');
const express = require('express');
const proxy = require('express-http-proxy');
const Config = require('@blockware/sdk-config');

const SERVICE_TYPE = 'web';

class ProxyRoute  {

    constructor(name, path) {

        this._name = name;
        this._path = path;
        this._targetUrl = "http://" + name.toLowerCase();
        this._ready = false;
        this._router = new express.Router();

        Config.onReady(async (provider) => {
            await this.init(provider);
        });
    }

    /**
     * Called automatically during startup sequence.
     *
     * @param {ConfigProvider} provider
     * @return {Promise<void>}
     */
    async init(provider) {
        this._targetUrl = await provider.getServiceAddress(this._name, SERVICE_TYPE);
        this._ready = true;

        if (!this._targetUrl.endsWith('/')) {
            this._targetUrl += '/';
        }

        const urlParts = URL.parse(this._targetUrl);

        this._router.use(this._path, proxy(urlParts.host, {
            https: urlParts.protocol === 'https',
            proxyReqPathResolver: function (req) {
                let [path, query] = req.url.split('?');

                return Path.join(urlParts.pathname, path) + (query ? '?' + query : '');
            }
        }));
        console.log('Proxy route ready for %s. %s --> %s', this._name, this._path, this._targetUrl);
    }

    /**
     * Returns expressjs Router object that contains proxy
     */
    toExpressRoute() {
        return this._router;
    }
}


module.exports = ProxyRoute;