const BASE_URL = 'https://plataforma-sostenimiento.vercel.app//api';

export const API = {
    getToken() { return localStorage.getItem('token'); },
    setToken(token) { localStorage.setItem('token', token); },
    clear() { localStorage.clear(); },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = options.headers || {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && typeof options.body === 'object') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        options.headers = headers;
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        
        if (response.status === 401 || response.status === 403) {
            this.clear();
            window.location.href = '/index.html';
            throw new Error('Sesión inválida o expirada.');
        }
        
        return response.json();
    }
};
