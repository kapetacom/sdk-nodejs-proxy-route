/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import Path from 'path';

import express, { Router } from 'express';
import proxy from 'express-http-proxy';
import Config, { ConfigProvider } from '@kapeta/sdk-config';

const DEFAULT_SERVICE_TYPE = 'web';

export class ProxyRoute {
    private readonly _name: string;
    private readonly _path: string;
    private readonly _serviceType: string;
    private readonly _router: Router;

    private _targetUrl: string;
    private _ready: boolean;

    constructor(name: string, path: string, serviceType: string) {
        this._name = name;
        this._path = path;
        this._serviceType = serviceType ?? DEFAULT_SERVICE_TYPE;
        this._targetUrl = `http://${name.toLowerCase()}`;
        this._ready = false;
        this._router = express.Router();

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
    async init(provider: ConfigProvider) {
        this._targetUrl = await provider.getServiceAddress(this._name, this._serviceType);
        this._ready = true;

        if (!this._targetUrl.endsWith('/')) {
            this._targetUrl += '/';
        }

        const urlParts = new URL(this._targetUrl);

        this._router.use(
            this._path,
            proxy(urlParts.host, {
                https: urlParts.protocol === 'https',
                proxyReqPathResolver: function (req) {
                    const [path, query] = req.url.split('?');

                    return Path.join(urlParts.pathname, path) + (query ? '?' + query : '');
                },
            })
        );
        console.log('Proxy route ready for %s. %s --> %s', this._name, this._path, this._targetUrl);
    }

    /**
     * Returns expressjs Router object that contains proxy
     */
    toExpressRoute() {
        return this._router;
    }
}
