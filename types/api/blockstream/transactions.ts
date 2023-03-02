   
   export interface BtcAddressMempool {
    txid: string;
    vin: MempoolInput[];
    sequence: number;
   }

   export interface MempoolInput {
    txid: string,
    vout: number,
   }