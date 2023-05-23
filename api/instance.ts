import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export default class ApiInstance {
  bitcoinApi: AxiosInstance;

  constructor(config: AxiosRequestConfig) {
    this.bitcoinApi = axios.create(config);
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
