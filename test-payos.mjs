import { PayOS } from '@payos/node';

const payos = new PayOS({
  clientId: '149c8535-25c6-4a91-95f9-768b578c2322',
  apiKey: 'b1bf5762-2343-4add-9b91-f9c7afe406c5',
  checksumKey: '060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43',
});

console.log('🧪 Testing PayOS credentials...\n');

try {
  console.log('📤 Creating test payment request...');
  
  const paymentLink = await payos.paymentRequests.create({
    orderCode: 999999,
    amount: 10000,
    description: 'Test payment from SDK',
    returnUrl: 'https://locket.io.vn',
    cancelUrl: 'https://locket.io.vn',
    buyerName: 'Test User',
    buyerEmail: 'test@locket.io.vn',
    buyerPhone: '0123456789',
    buyerAddress: 'VN',
  });
  
  console.log('\n✅ SUCCESS! PayOS credentials are VALID!\n');
  console.log('Payment Link Response:');
  console.log(JSON.stringify(paymentLink, null, 2));
  
} catch (error) {
  console.log('\n❌ ERROR! PayOS credentials might be INVALID!\n');
  console.log('Error Message:', error.message);
  console.log('Error Code:', error.code);
  
  if (error.response?.data) {
    console.log('PayOS Response:', JSON.stringify(error.response.data, null, 2));
  }
}
