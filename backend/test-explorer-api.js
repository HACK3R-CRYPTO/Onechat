/**
 * Test Cronos Explorer API Key
 * Checks if the Explorer API key is valid and not rate-limited
 */

require('dotenv').config();
const axios = require('axios');

const EXPLORER_API_KEY = process.env.CRONOS_TESTNET_EXPLORER_KEY;
// Based on your working curl: https://explorer-api.cronos.org/mainnet/api/v1/ethproxy/getBlockNumber
// For testnet, it should be: https://explorer-api.cronos.org/testnet/api/v1/ethproxy
const EXPLORER_ETH_PROXY = 'https://explorer-api.cronos.org/testnet/api/v1/ethproxy'; // Testnet ETH proxy endpoint

async function testExplorerAPI() {
  console.log('🔍 Testing Cronos Explorer API Key...\n');

  if (!EXPLORER_API_KEY) {
    console.log('❌ CRONOS_TESTNET_EXPLORER_KEY not set in .env');
    console.log('   Get your API key from: https://explorer-api-doc.cronos.org');
    return;
  }

  console.log(`🔑 API Key: ${EXPLORER_API_KEY.substring(0, 20)}...`);
  console.log(`📡 Testnet ETH Proxy: ${EXPLORER_ETH_PROXY}\n`);

  // Test 1: Get block number (like your working curl)
  console.log('Test 1: Get block number (like your working curl)...');
  try {
    const blockNumberResponse = await axios.get(`${EXPLORER_ETH_PROXY}/getBlockNumber`, {
      params: {
        apikey: EXPLORER_API_KEY,
      },
    });

    console.log(`✅ Status: ${blockNumberResponse.status}`);
    console.log(`✅ Latest Block Number:`, blockNumberResponse.data);
  } catch (error) {
    if (error.response) {
      console.log(`❌ Status: ${error.response.status}`);
      console.log(`❌ Error:`, error.response.data);
    } else {
      console.log(`❌ Error:`, error.message);
    }
  }

  console.log('\n---\n');

  // Test 2: Get block by number (what AI Agent SDK needs)
  console.log('Test 2: Get block by number (68716753) - what AI Agent SDK needs...');
  try {
    const blockResponse = await axios.get(`${EXPLORER_ETH_PROXY}/getBlockByNumber`, {
      params: {
        blockNumber: '0x419a1f1', // 68716753 in hex
        apikey: EXPLORER_API_KEY,
      },
    });

    console.log(`✅ Status: ${blockResponse.status}`);
    console.log(`✅ Response:`, JSON.stringify(blockResponse.data, null, 2).substring(0, 300));
  } catch (error) {
    if (error.response) {
      console.log(`❌ Status: ${error.response.status}`);
      console.log(`❌ Error:`, error.response.data);
      
      if (error.response.status === 403) {
        console.log('\n⚠️ 403 Forbidden - This is what AI Agent SDK is getting!');
        console.log('   Possible causes:');
        console.log('   1. API key doesn\'t have permission for getBlockByNumber endpoint');
        console.log('   2. Rate limit exceeded');
        console.log('   3. IP address is blocked');
        console.log('   4. Endpoint requires different authentication');
      } else if (error.response.status === 429) {
        console.log('\n⚠️ 429 Rate Limited - Too many requests');
        console.log('   Wait a few minutes and try again');
      }
    } else {
      console.log(`❌ Error:`, error.message);
    }
  }

  console.log('\n---\n');

  // Test 3: Get account balance
  console.log('Test 3: Get account balance...');
  try {
    const balanceResponse = await axios.post(`${EXPLORER_ETH_PROXY}/eth_getBalance`, {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: ['0xd2df53D9791e98Db221842Dd085F4144014BBE2a', 'latest'],
      id: 1,
    }, {
      params: {
        apikey: EXPLORER_API_KEY,
      },
    });

    console.log(`✅ Status: ${balanceResponse.status}`);
    console.log(`✅ Response:`, JSON.stringify(balanceResponse.data, null, 2).substring(0, 200));
  } catch (error) {
    if (error.response) {
      console.log(`❌ Status: ${error.response.status}`);
      console.log(`❌ Error:`, error.response.data);
    } else {
      console.log(`❌ Error:`, error.message);
    }
  }

  console.log('\n✅ Explorer API test complete!');
  console.log('\n📝 Summary:');
  console.log('   - If you see 403 errors, your API key may not have permission');
  console.log('   - If you see 429 errors, you\'ve hit rate limits');
  console.log('   - If you see 200 OK, your API key is working');
  console.log('\n💡 Note: AI Agent SDK uses Explorer API internally.');
  console.log('   If Explorer API returns 403, AI Agent SDK will fail for those queries.');
  console.log('   The system will automatically fall back to RPC for block queries.');
}

testExplorerAPI().catch(console.error);
