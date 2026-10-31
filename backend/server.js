const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // ADDED THIS
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files (ADDED THIS)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection (UPDATED to use .env if available)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://libraryadmin:library123@ac-fzycdjn-shard-00-00.j6diid9.mongodb.net:27017,ac-fzycdjn-shard-00-01.j6diid9.mongodb.net:27017,ac-fzycdjn-shard-00-02.j6diid9.mongodb.net:27017/libraryDB?ssl=true&replicaSet=atlas-cmc6o3-shard-0&authSource=admin&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/members', require('./routes/members'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/payment', require('./routes/payment'));
const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);
const chatbotRoutes = require('./routes/chatbot');
app.use('/api/chatbot', chatbotRoutes);
const purchaseRoutes = require('./routes/purchase');
app.use('/api/purchase', purchaseRoutes);
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Homepage route (ADDED THIS)
app.get('/', (req, res) => {
  res.send('📚 Library Management System API is running!');
});

// Start Scheduler
const { startScheduler } = require('./utils/reminderScheduler');
startScheduler();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});