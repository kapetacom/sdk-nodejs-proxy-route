/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import type { RequestOptions } from 'node:http';
import type { RequestHandler, Request } from 'express';
import type { ConfigProvider } from '@kapeta/sdk-config';

import Path from 'path';
import proxy from 'express-http-proxy';


const DEFAULT_SERVICE_TYPE:ProxyServiceType = 'web';

export type ProxyServiceType = 'web' | 'rest' | 'http';
export type ProxyRequestDecorator = (serviceName:string, serviceType:ProxyServiceType, proxyReqOpts: RequestOptions, srcReq:Request) => RequestOptions
export type ProxyBodyDecorator = (serviceName:string, serviceType:ProxyServiceType, bodyContent: any, srcReq:Request) => any

export type ProxyRouteOptions = {
    // Apply decorators to the request options before sending each request
    requestDecorators?: ProxyRequestDecorator[]

    // Apply decorators to the body before sending each request
    bodyDecorators?: ProxyBodyDecorator[]
}

export const createProxyRoute = async (
    provider: ConfigProvider,
    name: string,
    serviceType: ProxyServiceType = DEFAULT_SERVICE_TYPE,
    opts: ProxyRouteOptions = {}
): Promise<RequestHandler> => {
    let targetUrl = await provider.getServiceAddress(name, serviceType);
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
        proxyReqBodyDecorator: function (bodyContent, srcReq) {
            if (opts?.bodyDecorators) {
                opts.bodyDecorators.forEach((decorator) => {
                    bodyContent = decorator(name, serviceType, bodyContent, srcReq);
                });
            }
            return bodyContent;
        },
        proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
            if (proxyReqOpts.headers) {
                delete proxyReqOpts.headers['connection'];
            }

            if (opts?.requestDecorators) {
                opts.requestDecorators.forEach((decorator) => {
                    proxyReqOpts = decorator(name, serviceType, proxyReqOpts, srcReq);
                });
            }
            return proxyReqOpts;
        },
        proxyReqPathResolver: function (req: Request) {
            const [path, query] = req.url.split('?');

            const out = Path.join(urlParts.pathname, path) + (query ? '?' + query : '');

            console.log('Proxy request to %s %s > %s', req.method, req.url, out);

            return out;
        },
    });
};
