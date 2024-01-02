/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import Path from 'path';

import { RequestHandler, Request } from 'express';
import proxy from 'express-http-proxy';
import { ConfigProvider } from '@kapeta/sdk-config';

const DEFAULT_SERVICE_TYPE = 'web';

export const createProxyRoute = async (
    provider: ConfigProvider,
    name: string,
    serviceType?: string
): Promise<RequestHandler> => {
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
        timeout: 120000,
        limit: '1000mb',
        proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
            if (proxyReqOpts.headers) {
                delete proxyReqOpts.headers['connection'];
            }
            return proxyReqOpts;
        },
        proxyReqPathResolver: function (req: Request) {
            const [path, query] = req.url.split('?');

            const out = Path.join(urlParts.pathname, path) + (query ? '?' + query : '');

            console.log('Proxy request to %s > %s', req.url, out);

            return out;
        },
    });
};
