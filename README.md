# Library Management System with AI Recommendations

A full-stack web application built to automate library operations, manage book borrowing, calculate fines, and provide AI-based book recommendations.

## 🎯 Project Objective
To transform the traditional library experience into a smart, digital ecosystem by eliminating manual paperwork and automating core operations. This system aims to make book borrowing seamless, ensure zero revenue loss through automated fine calculations, and secure user data with robust JWT authentication. Beyond just management, the goal is to make reading exciting by using an AI engine to recommend personalized books, while keeping users effortlessly informed through automated email alerts.

## 🚀 Technologies Used
* **Frontend:** HTML5, CSS3, JavaScript, Bootstrap, Chart.js
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas
* **Authentication:** JWT (JSON Web Tokens), bcryptjs
* **Email Service:** Nodemailer

## ✨ Key Features
* **User Authentication:** Secure login/register for Admins and Members.
* **Book Management:** Add, update, search, and delete books.
* **Borrow & Return:** Real-time book availability tracking.
* **Fine Management:** Automated fine calculation (₹5/day after a 1-day grace period) and payment tracking.
* **AI Recommendations:** Suggests books based on user history and trending data.
* **Email Notifications:** Automated alerts for due dates and low stock.

## ⚙️ How to Run Locally
1. Clone the repository: `git clone https://github.com/tejugowda-03/Library-Management-System.git`
2. Navigate to the backend folder: `cd backend`
3. Install dependencies: `npm install`
4. Create a `.env` file and add your `MONGODB_URI`, `JWT_SECRET`, and Email credentials.
5. Start the server: `npm run dev`

## 🌐 Live Demo
* **Frontend:** https://frabjous-jelly-58d600.netlify.app/ (or your Netlify link)
* **Backend API:** https://library-management-system-1npg.onrender.com/

## 🔐 Demo Admin Credentials

* **Email: admin@library.com
* **Password: admin123

