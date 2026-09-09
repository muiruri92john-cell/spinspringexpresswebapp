// ============================================
// M-PESA DARAJA API INTEGRATION
// Production Ready
// ============================================

const axios = require('axios');

class MpesaDaraja {
  constructor() {
    this.environment = 'production'; // 'sandbox' or 'production'
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    this.consumerKey = 'YOUR_CONSUMER_KEY';
    this.consumerSecret = 'YOUR_CONSUMER_SECRET';
    this.passkey = 'YOUR_PASSKEY';
    this.businessShortcode = 'YOUR_SHORTCODE'; // Paybill or Till
    this.accountType = 'till'; // 'paybill', 'till', 'buygoods'
    this.callbackUrl = 'https://ardthonsolutions.com/spinspg/api/mpesa/callback';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get OAuth token
  async getAccessToken() {
    // Check if token exists and is not expired
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute
      return this.accessToken;
    } catch (err) {
      console.error('M-PESA OAuth Error:', err.response?.data || err.message);
      throw new Error('Failed to get M-PESA access token');
    }
  }

  // Generate password for STK Push
  generatePassword() {
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(
      `${this.businessShortcode}${this.passkey}${timestamp}`
    ).toString('base64');
    return { password, timestamp };
  }

  // Generate timestamp
  generateTimestamp() {
    const now = new Date();
    return now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
  }

  // ===== STK PUSH (Most popular - customer enters PIN) =====
  async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.businessShortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: this.accountType === 'paybill' ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
          Amount: Math.round(amount),
          PartyA: phoneNumber,
          PartyB: this.businessShortcode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.callbackUrl,
          AccountReference: accountReference || 'SpinSpring',
          TransactionDesc: transactionDesc || 'Laundry Payment'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return {
        success: true,
        MerchantRequestID: response.data.MerchantRequestID,
        CheckoutRequestID: response.data.CheckoutRequestID,
        ResponseCode: response.data.ResponseCode,
        ResponseDescription: response.data.ResponseDescription,
        CustomerMessage: response.data.CustomerMessage
      };
    } catch (err) {
      console.error('STK Push Error:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data?.errorMessage || err.message
      };
    }
  }

  // ===== STK Push Query (Check status) =====
  async stkPushQuery(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.businessShortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return {
        success: true,
        ResultCode: response.data.ResultCode,
        ResultDesc: response.data.ResultDesc,
        MpesaReceiptNumber: response.data.MpesaReceiptNumber,
        Amount: response.data.Amount,
        PhoneNumber: response.data.PhoneNumber
      };
    } catch (err) {
      console.error('STK Query Error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // ===== C2B (Customer to Business - Paybill/Till) =====
  // For Till: Register URLs
  async registerC2BUrls() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/c2b/v2/registerurl`,
        {
          ShortCode: this.businessShortcode,
          ResponseType: 'Completed',
          ConfirmationURL: this.callbackUrl + '/confirmation',
          ValidationURL: this.callbackUrl + '/validation'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return { success: true, data: response.data };
    } catch (err) {
      console.error('C2B Register Error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // ===== B2C (Business to Customer - Refunds) =====
  async b2cPayment(phoneNumber, amount, occasion = 'Refund') {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: 'YOUR_INITIATOR_NAME',
          SecurityCredential: 'YOUR_SECURITY_CREDENTIAL',
          CommandID: 'BusinessPayment',
          Amount: Math.round(amount),
          PartyA: this.businessShortcode,
          PartyB: phoneNumber,
          Remarks: occasion,
          QueueTimeOutURL: this.callbackUrl + '/b2c-timeout',
          ResultURL: this.callbackUrl + '/b2c-result',
          Occasion: occasion
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return { success: true, data: response.data };
    } catch (err) {
      console.error('B2C Error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // ===== Account Balance =====
  async accountBalance() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/accountbalance/v1/query`,
        {
          Initiator: 'YOUR_INITIATOR_NAME',
          SecurityCredential: 'YOUR_SECURITY_CREDENTIAL',
          CommandID: 'AccountBalance',
          PartyA: this.businessShortcode,
          IdentifierType: '4',
          Remarks: 'Balance Query',
          QueueTimeOutURL: this.callbackUrl + '/balance-timeout',
          ResultURL: this.callbackUrl + '/balance-result'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return { success: true, data: response.data };
    } catch (err) {
      console.error('Balance Error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new MpesaDaraja();