process.env.NODE_ENV = 'development';
process.env.PORT = '5555'; // Use a test port

const { server } = require('../server');
const axios = require('axios');
const pool = require('../config/database');

const BASE_URL = 'http://localhost:5555/api';

async function runTests() {
  try {
    console.log('🧪 Starting Google Auth & JWT Refresh Integration Tests...');

    // Clean up any test users that might exist
    await pool.query("DELETE FROM workers WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");

    // Test 1: Sign up new user (Homeowner)
    console.log('\n1. Testing Google Sign-Up for a new Homeowner...');
    let res = await axios.post(`${BASE_URL}/auth/google`, {
      idToken: 'mock_token_alice_smith',
      user_type: 'homeowner'
    });
    
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
    
    if (!res.data.success || !res.data.token || !res.data.refreshToken || res.data.user.user_type !== 'homeowner') {
      throw new Error('Test 1 Failed');
    }
    console.log('✅ Test 1 Passed!');

    const registeredToken = res.data.token;
    const registeredRefreshToken = res.data.refreshToken;

    // Test 2: Log in existing user
    console.log('\n2. Testing Google Login for an existing user...');
    res = await axios.post(`${BASE_URL}/auth/google`, {
      idToken: 'mock_token_alice_smith'
    });
    
    console.log('Response Status:', res.status);
    if (!res.data.success || !res.data.token || res.data.user.email !== 'alice_smith@example.com') {
      throw new Error('Test 2 Failed');
    }
    console.log('✅ Test 2 Passed!');

    // Test 3: Attempt Google login without user_type for a new user
    console.log('\n3. Testing Google login requiring role selection...');
    res = await axios.post(`${BASE_URL}/auth/google`, {
      idToken: 'mock_token_bob_builder'
    });
    
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
    if (res.data.success || res.data.code !== 'ROLE_REQUIRED' || !res.data.googleProfile) {
      throw new Error('Test 3 Failed');
    }
    console.log('✅ Test 3 Passed!');

    // Test 4: Complete Google sign up after role selection
    console.log('\n4. Testing completing registration as a Worker...');
    res = await axios.post(`${BASE_URL}/auth/google`, {
      idToken: 'mock_token_bob_builder',
      user_type: 'worker',
      service_type: 'plumber'
    });

    console.log('Response Data:', JSON.stringify(res.data, null, 2));
    if (!res.data.success || res.data.user.user_type !== 'worker') {
      throw new Error('Test 4 Failed');
    }
    console.log('✅ Test 4 Passed!');

    // Test 5: JWT Token Refresh
    console.log('\n5. Testing Access Token Refresh rotation...');
    res = await axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken: registeredRefreshToken
    });
    
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
    if (!res.data.success || !res.data.token || !res.data.refreshToken) {
      throw new Error('Test 5 Failed');
    }
    console.log('✅ Test 5 Passed!');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Cleaning up database.');
    
    // Clean up test users
    await pool.query("DELETE FROM workers WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
    
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test Failed:', err.message);
    if (err.response) {
      console.error('Error response data:', err.response.data);
    }
    server.close();
    process.exit(1);
  }
}

// Wait for database initialization
setTimeout(runTests, 2000);
