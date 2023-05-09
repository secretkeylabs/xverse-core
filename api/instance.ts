import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export default class ApiInstance {
  bitcoinApi: AxiosInstance;

  constructor(config: AxiosRequestConfig) {
    this.bitcoinApi = axios.create(config);
  }

  async httpGet(url: string, params: any = {}): Promise<any> {
    try {
      const response = await this.bitcoinApi.get(url, { params });
      return response.data;
    } catch (e) {
      Promise.reject(e);
      return e.toJSON();
    }
  }

  async httpPost(url: string, data: any): Promise<any> {
    try {
      const response = await this.bitcoinApi.post(url, data);
      return response.data;
    } catch (e) {
      Promise.reject(e);
      return e.toJSON();
    }
  }
}
