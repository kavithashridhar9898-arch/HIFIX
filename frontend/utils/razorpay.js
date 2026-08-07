/**
 * Razorpay Helper Utilities for React Native / Expo
 */

export const generateDemoPaymentDetails = (orderId) => {
  const timestamp = Date.now();
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: `DEMO_PAY_${timestamp}`,
    razorpay_signature: `DEMO_SIG_${timestamp}`,
  };
};

export const buildRazorpayHTML = ({ orderId, amount, currency = 'INR', key, name = 'HiFix Services', description = 'Service Payment', prefill = {} }) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #0F172A;
            color: #FFFFFF;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: rgba(30, 41, 59, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 24px;
            text-align: center;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
          h2 { margin-top: 0; color: #38BDF8; }
          .amount { font-size: 32px; font-weight: 800; margin: 16px 0; color: #22C55E; }
          button {
            background: linear-gradient(135deg, #2563EB, #3B82F6);
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: bold;
            width: 100%;
            cursor: pointer;
            margin-top: 20px;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          }
          .cancel-btn {
            background: transparent;
            color: #94A3B8;
            border: 1px solid rgba(255,255,255,0.2);
            margin-top: 10px;
            font-size: 14px;
            padding: 12px;
          }
        </style>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body>
        <div class="card">
          <h2>HiFix Secure Checkout</h2>
          <p style="color: #94A3B8;">Order #${orderId.slice(-8)}</p>
          <div class="amount">₹${(amount / 100).toLocaleString('en-IN')}</div>
          <button id="pay-btn">Proceed to Pay</button>
          <button class="cancel-btn" id="cancel-btn">Cancel Transaction</button>
        </div>

        <script>
          const options = {
            "key": "${key}",
            "amount": "${amount}",
            "currency": "${currency}",
            "name": "${name}",
            "description": "${description}",
            "order_id": "${orderId}",
            "handler": function (response){
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'success',
                data: response
              }));
            },
            "modal": {
              "ondismiss": function(){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  status: 'dismissed'
                }));
              }
            },
            "prefill": {
              "name": "${prefill.name || ''}",
              "email": "${prefill.email || ''}",
              "contact": "${prefill.phone || ''}"
            },
            "theme": {
              "color": "#2563EB"
            }
          };

          const rzp1 = new Razorpay(options);

          rzp1.on('payment.failed', function (response){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              status: 'failed',
              error: response.error
            }));
          });

          document.getElementById('pay-btn').onclick = function(e){
            rzp1.open();
            e.preventDefault();
          }

          document.getElementById('cancel-btn').onclick = function(e){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              status: 'cancelled'
            }));
          }

          // Auto open Razorpay modal on load
          setTimeout(() => {
            rzp1.open();
          }, 600);
        </script>
      </body>
    </html>
  `;
};
