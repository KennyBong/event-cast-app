const API_URL = 'http://localhost:3000/api';

/**
 * Uploads a file to S3 via a pre-signed URL from the server.
 * @param {File} file 
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
/**
 * Uploads a file to S3 via a pre-signed URL from the server.
 * @param {File} file 
 * @param {string} customerId - The folder name (event slug)
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
export const uploadFileToS3 = async (file, customerId) => {
    // 1. Get Pre-signed URL
    const signRes = await fetch(`${API_URL}/upload/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            folder: customerId
        })
    });

    if (!signRes.ok) throw new Error('Failed to get upload URL');
    const { uploadUrl, publicUrl } = await signRes.json();

    // 2. Upload to S3
    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
    });

    if (!uploadRes.ok) throw new Error('Failed to upload to S3');

    return publicUrl;
};

export const getStorageStats = async (customerId) => {
    const res = await fetch(`${API_URL}/stats/${customerId}`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
};

/**
 * Submits a message to the server.
 * @param {Object} messageData 
 */
export const submitMessage = async (messageData) => {
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
    });

    if (!res.ok) throw new Error('Failed to submit message');
    return await res.json();
};

// --- ADMIN API FUNCTIONS ---

const createBasicAuthHeader = (username, password) => {
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
};

export const adminLogin = async (username, password) => {
    const res = await fetch(`${API_URL}/admin/customers`, {
        method: 'GET',
        headers: {
            'Authorization': createBasicAuthHeader(username, password)
        }
    });

    if (res.status === 401) throw new Error('Invalid credentials');
    if (!res.ok) throw new Error('Login failed');

    return { success: true, username, password }; // Return credentials for future requests
};

export const getAdminCustomers = async (username, password) => {
    const res = await fetch(`${API_URL}/admin/customers`, {
        headers: {
            'Authorization': createBasicAuthHeader(username, password)
        }
    });

    if (!res.ok) throw new Error('Failed to fetch customers');
    return await res.json();
};

export const createAdminCustomer = async (username, password, customerData) => {
    const res = await fetch(`${API_URL}/admin/customers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': createBasicAuthHeader(username, password)
        },
        body: JSON.stringify(customerData)
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create customer');
    }
    return await res.json();
};

export const updateAdminCustomer = async (username, password, customerId, updates) => {
    const res = await fetch(`${API_URL}/admin/customers/${customerId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': createBasicAuthHeader(username, password)
        },
        body: JSON.stringify(updates)
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update customer');
    }
    return await res.json();
};

export const deleteAdminCustomer = async (username, password, customerId) => {
    const res = await fetch(`${API_URL}/admin/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': createBasicAuthHeader(username, password)
        }
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete customer');
    }
    return await res.json();
};
