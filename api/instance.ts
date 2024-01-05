import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface ApiInstanceOptions {
  axiosConfig: AxiosRequestConfig;
  fallbackUrl?: string;
}

export default class ApiInstance {
  bitcoinApi: AxiosInstance;

  fallbackBitcoinApi?: AxiosInstance;

  constructor(options: ApiInstanceOptions) {
    const { axiosConfig, fallbackUrl } = options;

    this.bitcoinApi = axios.create(axiosConfig);

    if (fallbackUrl) {
      this.fallbackBitcoinApi = axios.create({ ...axiosConfig, baseURL: fallbackUrl });
      this.bitcoinApi.interceptors.response.use(
        // if the request succeeds, we do nothing.
        (response) => response,
        (error) => {
          if (!this.fallbackBitcoinApi) {
            return Promise.reject(error);
          }
          // if an address has > 500 UTXOs, mempool.space returns a 400 error
          // can extend this to catch other errors in the future, e.g. 504, 500
          if (error?.response?.status === 400) {
            return this.fallbackBitcoinApi.request({ ...error.config, baseURL: fallbackUrl });
          }
          return Promise.reject(error);
        },
      );
    }
  }

  async httpGet<T = any>(url: string, params: any = {}): Promise<T> {
    const response = await this.bitcoinApi.get<T>(url, { params });
    return response.data;
  }

  async httpPost<T = any>(url: string, data: any): Promise<T> {
    const response = await this.bitcoinApi.post(url, data);
    return response.data;
  }
}
