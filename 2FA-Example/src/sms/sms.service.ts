import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  CreateSmsDto,
  Campagnesms,
  SendSmsResponse,
  SmsListParams,
  SmsGetParams,
} from '../types/sms.types';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api-staging.smsenmasse.fr',
      headers: {
        'X-API-KEY': process.env.SMSENMASSE_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendSms(dto: CreateSmsDto): Promise<SendSmsResponse> {
    try {
      const response = await this.client.post<SendSmsResponse>('/api/v1/sms', dto);
      this.logger.log(`SMS sent — campaignId: ${response.data.campagneId}`);
      return response.data;
    } catch (err: any) {
      this.logger.error(`SmsEnMasse error — status: ${err.response?.status}, data: ${JSON.stringify(err.response?.data)}`);
      throw err;
    }
  }

  async listSms(params?: SmsListParams): Promise<Campagnesms[]> {
    const response = await this.client.get<Campagnesms[]>('/api/v1/sms', { params });
    return response.data;
  }

  async getSms(id: number, params?: SmsGetParams): Promise<Campagnesms> {
    const response = await this.client.get<Campagnesms>(`/api/v1/sms/${id}`, { params });
    return response.data;
  }

  async deleteSms(id: number): Promise<void> {
    await this.client.delete(`/api/v1/sms/${id}`);
    this.logger.log(`SMS campaign ${id} deleted`);
  }
}
