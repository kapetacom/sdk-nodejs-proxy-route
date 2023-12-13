/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import Path from 'path';

import { RequestHandler } from 'express';
import proxy from 'express-http-proxy';
import { ConfigProvider } from '@kapeta/sdk-config';

const DEFAULT_SERVICE_TYPE = 'web';

export const createProxyRoute = async (provider: ConfigProvider, name: string, serviceType?: string):Promise<RequestHandler> => {
    let targetUrl = await provider.getServiceAddress(name, serviceType ?? DEFAULT_SERVICE_TYPE);
    if (!targetUrl) {
        throw new Error(`Service ${name} not found`);
    }

    if (!targetUrl.endsWith('/')) {
        targetUrl += '/';
    }

    const urlParts = new URL(targetUrl);

    console.log('Proxy route ready for %s --> %s', name, targetUrl);

    return proxy(urlParts.host, {
        https: urlParts.protocol === 'https',
        proxyReqPathResolver: function (req) {
            const [path, query] = req.url.split('?');

            return Path.join(urlParts.pathname, path) + (query ? '?' + query : '');
        },
    })
}


