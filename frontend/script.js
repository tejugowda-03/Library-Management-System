// ============ AUTHENTICATION FUNCTIONS ============

function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Note: This is a frontend-only mock login for the admin UI.
    // In a full production environment, this should send a request to your /api/auth/login endpoint.
    if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', username);
        window.location.href = 'dashboard.html';
    } else {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px;">❌ Invalid credentials! Use admin / admin123</div>';
            setTimeout(() => {
                messageDiv.innerHTML = '';
            }, 3000);
        }
    }
}

function checkAuth() {
    if (!localStorage.getItem('isLoggedIn') && !window.location.href.includes('index.html')) {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        const bgColor = type === 'error' ? '#f8d7da' : '#d4edda';
        const textColor = type === 'error' ? '#721c24' : '#155724';
        messageDiv.innerHTML = `<div style="background: ${bgColor}; color: ${textColor}; padding: 10px; border-radius: 5px; margin: 10px 0;">${message}</div>`;
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }
}

// ============ API CONFIGURATION ============
// ✅ UPDATED: Pointing to your live Render backend
const API_URL = 'https://library-management-system-1npg.onrender.com/api';

// ============ BOOK FUNCTIONS ============
async function loadBooks() {
    try {
        const response = await fetch(`${API_URL}/books`);
        const books = await response.json();
        const tbody = document.getElementById('booksTableBody');
        
        if (!tbody) return;
        
        if (books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No books found</td></tr>';
            return;
        }
        
        tbody.innerHTML = books.map(book => `
            <tr>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.isbn}</td>
                <td>${book.category}</td>
                <td>${book.availableCopies}/${book.totalCopies}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteBook('${book._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showMessage('Error loading books: ' + error.message, 'error');
    }
}

async function deleteBook(id) {
    if (confirm('Are you sure you want to delete this book?')) {
        try {
            const response = await fetch(`${API_URL}/books/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showMessage('Book deleted successfully!', 'success');
                loadBooks();
                if (typeof loadDashboardStats === 'function') loadDashboardStats();
            } else {
                const result = await response.json();
                showMessage(result.message, 'error');
            }
        } catch (error) {
            showMessage('Error deleting book: ' + error.message, 'error');
        }
    }
}

// ============ DASHBOARD FUNCTIONS ============
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/books`);
        const books = await response.json();
        
        const totalBooks = books.length;
        const totalCopies = books.reduce((sum, book) => sum + book.totalCopies, 0);
        const availableCopies = books.reduce((sum, book) => sum + book.availableCopies, 0);
        
        const totalBooksElem = document.getElementById('totalBooks');
        const totalMembersElem = document.getElementById('totalMembers');
        const issuedBooksElem = document.getElementById('issuedBooks');
        
        if (totalBooksElem) totalBooksElem.innerText = totalBooks;
        if (totalMembersElem) totalMembersElem.innerText = '0';
        if (issuedBooksElem) issuedBooksElem.innerText = totalCopies - availableCopies;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}