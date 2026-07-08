const nodemailer = require('nodemailer');

// Send OTP email
const sendOTPEmail = async (email, otp, userName) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || 
        process.env.EMAIL_USER === 'your-email@gmail.com') {
      console.log('⚠️  Email not configured. OTP:', otp);
      return { 
        success: false, 
        error: 'Email not configured',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    const mailOptions = {
      from: `"HIFIX Security" <${process.env.EMAIL_USER || 'noreply@hifix.com'}>`,
      to: email,
      subject: 'Password Change OTP Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #4285F4; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #4285F4; letter-spacing: 5px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Change Request</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>We received a request to change your password. Please use the following OTP to verify your identity:</p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Your One-Time Password</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong><br>
                • Never share this OTP with anyone<br>
                • HIFIX staff will never ask for your OTP<br>
                • If you didn't request this change, please secure your account immediately
              </div>
              
              <p>After entering the OTP, you'll be able to set your new password.</p>
              
              <p>Best regards,<br><strong>HIFIX Security Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} HIFIX. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail
};
