// Simple API test script for admin endpoints
// Run with: node test-admin-api.js

const API_URL = 'http://localhost:3000/api';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

const createAuthHeader = (username, password) => {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    return `Basic ${credentials}`;
};

async function test() {
    console.log('🧪 Testing Admin API...\n');

    // Test 1: Login (GET customers)
    console.log('Test 1: Admin Login');
    try {
        const res = await fetch(`${API_URL}/admin/customers`, {
            headers: {
                'Authorization': createAuthHeader(USERNAME, PASSWORD)
            }
        });

        if (res.status === 401) {
            console.log('❌ FAIL: Invalid credentials');
            return;
        }

        if (!res.ok) {
            console.log('❌ FAIL: Server error', res.status);
            return;
        }

        const customers = await res.json();
        console.log(`✅ PASS: Logged in, found ${customers.length} customers`);
        console.log('   Customers:', customers.map(c => c.id).join(', ') || '(none)');
    } catch (error) {
        console.log('❌ FAIL: Cannot connect to server');
        console.log('   Error:', error.message);
        console.log('   Make sure server is running: npm start');
        return;
    }

    console.log();

    // Test 2: Create Customer
    console.log('Test 2: Create Customer');
    const testCustomerId = `test-${Date.now()}`;
    try {
        const res = await fetch(`${API_URL}/admin/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': createAuthHeader(USERNAME, PASSWORD)
            },
            body: JSON.stringify({
                id: testCustomerId,
                name: 'Test Customer',
                password: 'test123',
                role: 'customer',
                disabled: false,
                settings: { imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 },
                headerTitle: 'Test Event',
                backgroundImage: null
            })
        });

        if (!res.ok) {
            const error = await res.json();
            console.log('❌ FAIL:', error.error);
            return;
        }

        const result = await res.json();
        console.log(`✅ PASS: Created customer "${testCustomerId}"`);
    } catch (error) {
        console.log('❌ FAIL:', error.message);
        return;
    }

    console.log();

    // Test 3: Update Customer
    console.log('Test 3: Update Customer');
    try {
        const res = await fetch(`${API_URL}/admin/customers/${testCustomerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': createAuthHeader(USERNAME, PASSWORD)
            },
            body: JSON.stringify({
                disabled: true
            })
        });

        if (!res.ok) {
            const error = await res.json();
            console.log('❌ FAIL:', error.error);
            return;
        }

        console.log(`✅ PASS: Updated customer (disabled: true)`);
    } catch (error) {
        console.log('❌ FAIL:', error.message);
        return;
    }

    console.log();

    // Test 4: Delete Customer
    console.log('Test 4: Delete Customer');
    try {
        const res = await fetch(`${API_URL}/admin/customers/${testCustomerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': createAuthHeader(USERNAME, PASSWORD)
            }
        });

        if (!res.ok) {
            const error = await res.json();
            console.log('❌ FAIL:', error.error);
            return;
        }

        console.log(`✅ PASS: Deleted customer`);
    } catch (error) {
        console.log('❌ FAIL:', error.message);
        return;
    }

    console.log();
    console.log('🎉 All tests passed! Admin API is working correctly.');
    console.log();
    console.log('Next steps:');
    console.log('1. Open http://localhost:5173/admin in your browser');
    console.log('2. Login with: admin / admin123');
    console.log('3. Try creating a customer in the UI');
}

test();
