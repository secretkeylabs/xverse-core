export interface UploadInscriptionRequest {
  file: string;
}

export enum InscriptionSubmission {
  SINGLE = 'single',
  BULK = 'bulk',
}

export interface InscriptionTransactionStatus {
  tx_id: string;
  block_height: number;
  confirmed: boolean;
}

export interface InscriptionRequestItem {
  id: string;
  btc_deposit_address: string;
  btc_ordinal_recipient_address: string;
  btc_refund_recipient_address: string;
  network_fee_rate: number;
  total_fee_sats: number;
  file_size_bytes: number;
  payment_tx_status: InscriptionTransactionStatus;
  commit_tx_status: InscriptionTransactionStatus;
  reveal_tx_status: InscriptionTransactionStatus;
  transfer_tx_status: InscriptionTransactionStatus;
  refund_tx_status: InscriptionTransactionStatus;
  inscription_id: string;
  inscription_revealed: boolean;
  inscription_transferred: boolean;
  raw_status: string;
}

export interface InscriptionRequest {
  id: string;
  submission_type: InscriptionSubmission;
  total_request_fee_sats: number;
  btc_deposit_address: string;
  request_items: InscriptionRequestItem;
}

export interface FeeRatesResponse {
  minimum_fee_rate: number;
  economy_fee_rate: number;
  normal_fee_rate: number;
  high_fee_rate: number;
  fastest_fee_rate: number;
}

export interface InscriptionFeeSummaryWithFeeRate {
  inscription_sats: number;
  network_fee_sats: number;
  total_fee_sats: number;
  network_fee_rate: number;
}

export interface CalculatedFeeSummary {
  minimum: InscriptionFeeSummaryWithFeeRate;
  economy: InscriptionFeeSummaryWithFeeRate;
  normal: InscriptionFeeSummaryWithFeeRate;
  high: InscriptionFeeSummaryWithFeeRate;
  fastest: InscriptionFeeSummaryWithFeeRate;
}

export interface PreviewFileResponse {
  output_base64: string;
  output_byte_length: number;
  output_width: number;
  output_file_type: string;
  output_file_extension: string;
  calculated_fee_summary: CalculatedFeeSummary;
}

export interface UploadInscriptionFileResponse {
  output_base64: string;
  output_byte_length: number;
  output_width: number;
  output_file_type: string;
  output_file_extension: string;
  calculated_fee_summary: CalculatedFeeSummary;
}

export interface EstimateFeeResponse {
  network_fee_rate: number,
  file_size_bytes: number,
  summary: {
    inscription_sats: number,
    network_fee_sats: number,
    total_fee_sats: number
  }
}