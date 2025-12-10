// Firebase Configuration
// REPLACE these values with your project configuration
// You can get this from Firebase Console > Project Settings > General > Your Apps > Web App
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Export to window so it's accessible (since we are using vanilla JS without modules)
window.firebaseConfig = firebaseConfig;
