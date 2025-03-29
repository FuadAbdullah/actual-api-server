// Import necessary modules
const fs = require('fs');
const api = require('@actual-app/api');
const express = require('express');

// --- Configuration via Environment Variables ---
// Load .env file for local development (optional, install with: npm install dotenv)
require('dotenv').config(); // Uncomment if you use a .env file locally

const ACTUAL_SERVER_URL = process.env.ACTUAL_SERVER_URL;
const ACTUAL_SERVER_PASSWORD = process.env.ACTUAL_SERVER_PASSWORD; // Optional
const ACTUAL_BUDGET_SYNC_ID = process.env.ACTUAL_BUDGET_SYNC_ID;
const ACTUAL_BUDGET_PASSWORD = process.env.ACTUAL_BUDGET_PASSWORD; // Optional, for encrypted budget files
const WRAPPER_PORT = process.env.WRAPPER_PORT || 3000; // Default to port 3000
const DATA_DIR = process.env.DATA_DIR || './data'; // Default to ./data in the container/working dir

// --- Helper Function for Async Route Handling ---
// This avoids writing try/catch in every single route handler
const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// --- Main Application Logic ---
const app = async () => {
    console.log("--- Starting Actual Budget Read-Only API Wrapper ---");

    // --- Validate Required Environment Variables ---
    if (!ACTUAL_SERVER_URL) {
        console.error("FATAL ERROR: ACTUAL_SERVER_URL environment variable is not set.");
        process.exit(1);
    }
    if (!ACTUAL_BUDGET_SYNC_ID) {
        console.error("FATAL ERROR: ACTUAL_BUDGET_SYNC_ID environment variable is not set.");
        process.exit(1);
    }
    console.log(`Using Actual Server URL: ${ACTUAL_SERVER_URL}`);
    console.log(`Using Budget Sync ID: ${ACTUAL_BUDGET_SYNC_ID}`);
    console.log(`Using Data Directory: ${DATA_DIR}`);
    console.log(`Wrapper server will listen on port: ${WRAPPER_PORT}`);

    // --- Ensure Data Directory Exists ---
    if (!fs.existsSync(DATA_DIR)) {
        console.log(`Creating data directory: ${DATA_DIR}`);
        fs.mkdirSync(DATA_DIR, { recursive: true }); // Use recursive just in case
    } else {
        console.log(`Data directory already exists: ${DATA_DIR}`);
    }

    // --- Initialize Actual API ---
    try {
        console.log('Initializing Actual API connection...');
        await api.init({
            serverURL: ACTUAL_SERVER_URL,
            password: ACTUAL_SERVER_PASSWORD, // Will be undefined if not set, which is fine
            dataDir: DATA_DIR,
        });
        console.log('Actual API Initialized Successfully!');

        // --- Download/Load Budget ---
        // Using downloadBudget is generally safer in a container setup
        // as it ensures the budget file is fetched if not present locally.
        console.log(`Attempting to load budget: ${ACTUAL_BUDGET_SYNC_ID}...`);
        await api.downloadBudget(
            ACTUAL_BUDGET_SYNC_ID, // Updated based on recent API changes - syncId first
            { password: ACTUAL_BUDGET_PASSWORD } // Options object second
        );
        console.log(`Budget ${ACTUAL_BUDGET_SYNC_ID} loaded successfully!`);

    } catch (err) {
        console.error("FATAL ERROR: Could not initialize API or load budget.");
        console.error(err);
        process.exit(1); // Exit if we can't connect or load the budget
    }

    // --- Setup Express Server ---
    const server = express();
    server.use(express.json()); // Enable JSON body parsing (though not strictly needed for GET)

    console.log("Setting up read-only HTTP endpoints...");

    // --- Read-Only Endpoints ---

    // GET /status - Basic health check
    server.get('/status', (req, res) => {
        res.json({ status: 'ok', message: 'Actual API Wrapper is running' });
    });

    // GET /budgets/list - List available budgets [0]
    server.get('/budgets/list', asyncHandler(async (req, res) => {
        console.log("GET /budgets/list");
        const budgets = await api.getBudgets();
        res.json(budgets);
    }));

    // GET /budgets/months - Get all budget months [0]
    server.get('/budgets/months', asyncHandler(async (req, res) => {
        console.log("GET /budgets/months");
        const months = await api.getBudgetMonths();
        res.json(months);
    }));

    // GET /budgets/months/:month - Get budget details for a specific month [0]
    server.get('/budgets/months/:month', asyncHandler(async (req, res) => {
        const { month } = req.params;
        // Basic validation for YYYY-MM format
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
        }
        console.log(`GET /budgets/months/${month}`);
        const budgetMonth = await api.getBudgetMonth(month);
        res.json(budgetMonth);
    }));

    // GET /accounts - Get all accounts [0]
    server.get('/accounts', asyncHandler(async (req, res) => {
        console.log("GET /accounts");
        const accounts = await api.getAccounts();
        res.json(accounts);
    }));

    // GET /accounts/:id/balance - Get account balance [0]
    server.get('/accounts/:id/balance', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { cutoff } = req.query; // Optional YYYY-MM-DD cutoff date
        console.log(`GET /accounts/${id}/balance ${cutoff ? `(cutoff: ${cutoff})` : ''}`);
        // Basic validation for cutoff date format if provided
        if (cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
            return res.status(400).json({ error: 'Invalid cutoff date format. Use YYYY-MM-DD.' });
        }
        const balance = await api.getAccountBalance(id, cutoff); // Pass cutoff if provided
        res.json({ accountId: id, balance: balance });
    }));

    // GET /accounts/:id/transactions - Get transactions for an account within a date range [0]
    server.get('/accounts/:id/transactions', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { startDate, endDate } = req.query; // Required query params

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required query parameters: startDate and endDate.' });
        }
        // Basic validation for date formats
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD for startDate and endDate.' });
        }

        console.log(`GET /accounts/${id}/transactions (from ${startDate} to ${endDate})`);
        const transactions = await api.getTransactions(id, startDate, endDate);
        res.json(transactions);
    }));

    // GET /categories - Get all categories [0]
    server.get('/categories', asyncHandler(async (req, res) => {
        console.log("GET /categories");
        const categories = await api.getCategories();
        res.json(categories);
    }));

    // GET /category-groups - Get all category groups (including their categories) [0]
    server.get('/category-groups', asyncHandler(async (req, res) => {
        console.log("GET /category-groups");
        const groups = await api.getCategoryGroups();
        res.json(groups);
    }));

    // GET /payees - Get all payees [0]
    server.get('/payees', asyncHandler(async (req, res) => {
        console.log("GET /payees");
        const payees = await api.getPayees();
        res.json(payees);
    }));

    // GET /rules - Get all rules [0]
    server.get('/rules', asyncHandler(async (req, res) => {
        console.log("GET /rules");
        const rules = await api.getRules();
        res.json(rules);
    }));

    // GET /payees/:id/rules - Get rules for a specific payee [0]
    server.get('/payees/:id/rules', asyncHandler(async (req, res) => {
        const { id } = req.params;
        console.log(`GET /payees/${id}/rules`);
        const rules = await api.getPayeeRules(id);
        res.json(rules);
    }));

    // --- Global Error Handler ---
    // Catches errors from asyncHandler
    server.use((err, req, res, next) => {
        console.error(`Error processing request ${req.method} ${req.path}:`);
        console.error(err);
        // Avoid leaking stack traces in production environments
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message || 'An unexpected error occurred.',
        });
    });

    // --- Start Listening ---
    const listener = server.listen(WRAPPER_PORT, '0.0.0.0', () => {
        // Listen on 0.0.0.0 to be accessible from other containers in the Docker network
        console.log(`🚀 Actual API Wrapper server listening on http://0.0.0.0:${WRAPPER_PORT}`);
        console.log("Ready to accept connections!");
    });

    // --- Graceful Shutdown Handling ---
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        listener.close(async () => {
            console.log('HTTP server closed.');
            try {
                console.log('Shutting down Actual API connection...');
                await api.shutdown(); // Clean up the API connection [0]
                console.log('Actual API connection shut down successfully.');
                process.exit(0);
            } catch (err) {
                console.error('Error during Actual API shutdown:', err);
                process.exit(1);
            }
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop sends SIGTERM
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C sends SIGINT
};

// --- Run the App ---
app().catch(err => {
    // Catch errors during the initial setup phase (before server.listen)
    console.error("--- Unrecoverable Error During Startup ---");
    console.error(err);
    process.exit(1);
});