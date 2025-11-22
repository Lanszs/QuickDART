import React from 'react';
import { createRoot } from 'react-dom/client';
// Make sure this path correctly points to your main application component
import App from './App.jsx'; 

// 1. Get the root element from public/index.html (the <div id="root">)
const container = document.getElementById('root');

if (container) {
    // 2. Create the React root (modern React 18+ way)
    const root = createRoot(container);
    
    // 3. Render the main App component into the root
    root.render(
        // StrictMode helps identify potential problems in the application
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    // This is a safety check—it means the index.html file is missing the required div
    console.error("Failed to find the root element with ID 'root'. Please check public/index.html.");
}