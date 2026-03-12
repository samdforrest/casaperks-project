/**
 * Test script for Zod validation on POST /redeem
 *
 * Tests various malformed/missing data scenarios that should be caught
 * by Zod validation BEFORE any business logic runs.
 *
 * Run: npx ts-node test-zod-validation.ts
 */

const BASE_URL = 'http://localhost:3001';

interface TestCase {
  name: string;
  body: unknown;
  expectedStatus: number;
}

const testCases: TestCase[] = [
  {
    name: 'Missing body entirely (undefined)',
    body: undefined,
    expectedStatus: 400
  },
  {
    name: 'Empty object (missing giftCardId)',
    body: {},
    expectedStatus: 400
  },
  {
    name: 'giftCardId is null',
    body: { giftCardId: null },
    expectedStatus: 400
  },
  {
    name: 'giftCardId is a number',
    body: { giftCardId: 12345 },
    expectedStatus: 400
  },
  {
    name: 'giftCardId is a boolean',
    body: { giftCardId: true },
    expectedStatus: 400
  },
  {
    name: 'giftCardId is an array',
    body: { giftCardId: ['gc-001'] },
    expectedStatus: 400
  },
  {
    name: 'giftCardId is an object',
    body: { giftCardId: { id: 'gc-001' } },
    expectedStatus: 400
  },
  {
    name: 'giftCardId is empty string',
    body: { giftCardId: '' },
    expectedStatus: 400  // Zod allows empty string by default, but this tests that
  },
  {
    name: 'Wrong field name (giftcardId lowercase)',
    body: { giftcardId: 'gc-001' },
    expectedStatus: 400
  },
  {
    name: 'Wrong field name (gift_card_id snake_case)',
    body: { gift_card_id: 'gc-001' },
    expectedStatus: 400
  }
];

async function getAuthToken(): Promise<string> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sam.rivera@casaperks.com',
      password: 'password123'
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}

async function runTest(token: string, testCase: TestCase): Promise<{ passed: boolean; actual: number; response: string }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${BASE_URL}/redeem`, {
    method: 'POST',
    headers,
    body: testCase.body === undefined ? undefined : JSON.stringify(testCase.body)
  });

  const responseText = await response.text();
  const passed = response.status === testCase.expectedStatus;

  return {
    passed,
    actual: response.status,
    response: responseText
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Zod Validation Test Suite for POST /redeem');
  console.log('='.repeat(60));
  console.log();

  // Get auth token
  console.log('Authenticating...');
  let token: string;
  try {
    token = await getAuthToken();
    console.log('Authentication successful\n');
  } catch (error) {
    console.error('Failed to authenticate. Is the server running?');
    console.error(error);
    process.exit(1);
  }

  // Run tests
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(token, testCase);

    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${testCase.name}`);
    console.log(`  Body: ${JSON.stringify(testCase.body)}`);
    console.log(`  Expected: ${testCase.expectedStatus}, Actual: ${result.actual}`);
    console.log(`  Response: ${result.response}`);
    console.log();

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  console.log('='.repeat(60));

  // Note about empty string
  console.log();
  console.log('NOTE: The "empty string" test case may pass Zod validation');
  console.log('because z.string() allows empty strings by default.');
  console.log('Use z.string().min(1) to reject empty strings.');

  process.exit(failed > 0 ? 1 : 0);
}

main();
