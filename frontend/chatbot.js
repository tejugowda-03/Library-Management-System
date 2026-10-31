// Chatbot Widget JavaScript
class Chatbot {
    constructor() {
        this.isOpen = false;
        this.token = localStorage.getItem('token');
        this.userRole = null;
        this.init();
    }

    init() {
        this.createWidget();
        this.loadUserRole();
        this.loadSuggestions();
    }

    loadUserRole() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.userRole = user.role || 'user';
    }

    createWidget() {
        // Create widget container
        const widget = document.createElement('div');
        widget.className = 'chatbot-widget';
        widget.innerHTML = `
            <button class="chatbot-toggle" id="chatbotToggleBtn">💬</button>
            <div class="chatbot-container" id="chatbotContainer" style="display: none;">
                <div class="chatbot-header">
                    <h3>🤖 Library Assistant</h3>
                    <button class="close-btn" id="chatbotCloseBtn">✕</button>
                </div>
                <div class="chatbot-messages" id="chatbotMessages">
                    <div class="message bot">
                        <div class="message-content">
                            👋 Hello! I'm your Library Assistant.<br>
                            How can I help you today?
                        </div>
                        <div class="message-time">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                <div class="suggestions" id="suggestionsList"></div>
                <div class="chatbot-input">
                    <input type="text" id="chatbotInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter') chatbot.sendMessage()">
                    <button onclick="chatbot.sendMessage()">Send</button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);

        // Add event listeners
        document.getElementById('chatbotToggleBtn').addEventListener('click', () => this.toggle());
        document.getElementById('chatbotCloseBtn').addEventListener('click', () => this.close());
        
        // Store instance globally
        window.chatbot = this;
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatbotContainer');
        const toggleBtn = document.getElementById('chatbotToggleBtn');
        
        if (this.isOpen) {
            container.style.display = 'flex';
            toggleBtn.innerHTML = '✕';
            this.loadSuggestions();
        } else {
            container.style.display = 'none';
            toggleBtn.innerHTML = '💬';
        }
    }

    close() {
        this.isOpen = false;
        document.getElementById('chatbotContainer').style.display = 'none';
        document.getElementById('chatbotToggleBtn').innerHTML = '💬';
    }

    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addMessage(message, 'user');
        input.value = '';
        
        // Show typing indicator
        this.showTyping();
        
        try {
            const response = await fetch('https://library-management-system-1npg.onrender.com/api/chatbot/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            this.hideTyping();
            this.addMessage(data.botResponse, 'bot');
            
        } catch (error) {
            this.hideTyping();
            this.addMessage("Sorry, I'm having trouble connecting. Please try again later.", 'bot');
        }
    }

    addMessage(text, sender) {
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        // Format links and line breaks
        let formattedText = text.replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = `
            <div class="message-content">${formattedText}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTyping() {
        const messagesContainer = document.getElementById('chatbotMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async loadSuggestions() {
        try {
            const response = await fetch('https://library-management-system-1npg.onrender.com/api/chatbot/suggestions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            const suggestionsContainer = document.getElementById('suggestionsList');
            if (data.suggestions && data.suggestions.length > 0) {
                suggestionsContainer.innerHTML = data.suggestions.map(s => 
                    `<span class="suggestion-chip" onclick="chatbot.setSuggestion('${s.replace(/'/g, "\\'")}')">${s}</span>`
                ).join('');
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    }

    setSuggestion(text) {
        document.getElementById('chatbotInput').value = text;
        this.sendMessage();
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.chatbot = new Chatbot();
    }
});