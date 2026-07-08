# Email OTP Configuration Guide

## Setting Up Gmail for OTP Emails

To enable OTP email functionality, you need to configure Gmail with an App Password:

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account: https://myaccount.google.com
2. Select "Security" from the left menu
3. Under "How you sign in to Google", select "2-Step Verification"
4. Follow the steps to enable 2-Step Verification

### Step 2: Generate App Password
1. Go to App Passwords: https://myaccount.google.com/apppasswords
2. Select "Mail" for the app
3. Select "Other (Custom name)" for the device
4. Enter "HIFIX Backend" as the name
5. Click "Generate"
6. Copy the 16-character password (it will look like: `xxxx xxxx xxxx xxxx`)

### Step 3: Update .env File
Open `backend/.env` and update:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```
*(Remove spaces from the app password)*

### Step 4: Restart Server
After updating the .env file, restart your backend server:
```bash
cd backend
node server.js
```

## Alternative Email Services

### Using Outlook/Hotmail
```javascript
service: 'hotmail'
auth: {
  user: 'your-email@outlook.com',
  pass: 'your-password'
}
```

### Using SendGrid
```javascript
host: 'smtp.sendgrid.net',
port: 587,
auth: {
  user: 'apikey',
  pass: 'your-sendgrid-api-key'
}
```

## Testing OTP Flow

1. **Request OTP**: 
   - Go to Security screen
   - Click "Change Password"
   - Click "Send OTP to Email"

2. **Check Email**: 
   - Look for email from HIFIX Security
   - Find the 6-digit OTP code

3. **Enter OTP**: 
   - Enter the 6 digits in the OTP screen
   - Click "Verify OTP"

4. **Set New Password**: 
   - Enter your new password
   - Confirm the password
   - Click "Change Password"

## Notification Settings

Users can control if they receive email notifications:
- Email notifications toggle in settings
- OTP will still be sent via email
- In-app notification shown only if email notifications are ON

## Troubleshooting

### Email Not Sending
1. Check .env file has correct credentials
2. Verify 2FA is enabled on Gmail
3. Ensure App Password is correct (no spaces)
4. Check console for email errors

### OTP Expired
- OTPs expire after 10 minutes
- Request a new OTP if expired

### Too Many Attempts
- Max 3 attempts per OTP
- Request new OTP after failed attempts
