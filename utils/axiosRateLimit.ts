/**
 * inspired by axios-rate-limit with a few adjustments and bug fixes
 * https://github.com/aishek/axios-rate-limit
 */

import { Axios, InternalAxiosRequestConfig } from 'axios';

type RateLimitRequestHandler = {
  resolve: () => boolean;
};

type RateLimitOptions =
  | {
      maxRPS: number;
    }
  | {
      maxRequests: number;
      perMilliseconds: number;
    };

function throwIfCancellationRequested(config: InternalAxiosRequestConfig<any>) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

export class AxiosRateLimit {
  private queue: RateLimitRequestHandler[];

  private timeslotRequests: number;

  private perMilliseconds: number;

  private maxRequests: number;

  constructor(axios: Axios | Axios[], options: RateLimitOptions) {
    this.queue = [];
    this.timeslotRequests = 0;

    if ('maxRPS' in options) {
      this.perMilliseconds = 1000;
      this.maxRequests = options.maxRPS;
    } else {
      this.perMilliseconds = options.perMilliseconds;
      this.maxRequests = options.maxRequests;
    }

    function handleError(error: unknown) {
      return Promise.reject(error);
    }

    const axiosInstances = Array.isArray(axios) ? axios : [axios];
    axiosInstances.forEach((axiosInstance) => axiosInstance.interceptors.request.use(this.handleRequest, handleError));
  }

  private handleRequest = (request: InternalAxiosRequestConfig<any>) => {
    return new Promise<InternalAxiosRequestConfig<any>>((resolve, reject) => {
      this.push({
        resolve: function () {
          try {
            throwIfCancellationRequested(request);
          } catch (error) {
            reject(error);
            return false;
          }
          resolve(request);
          return true;
        },
      });
    });
  };

  private push = (requestHandler: RateLimitRequestHandler) => {
    this.queue.push(requestHandler);
    this.shift();
  };

  private onRequestTimerMet = () => {
    this.timeslotRequests--;
    this.shift();
  };

  private shift = () => {
    if (this.timeslotRequests >= this.maxRequests) return;

    const queued = this.queue.shift();
    if (!queued) return;

    const resolved = queued.resolve();

    if (!resolved) {
      this.shift(); // rejected request --> shift another request
      return;
    }

    this.timeslotRequests++;
    setTimeout(this.onRequestTimerMet, this.perMilliseconds);
  };
}
