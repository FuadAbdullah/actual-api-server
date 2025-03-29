# Actual Budget Read-Only API Wrapper

> Note: This README was generated by Gemini.

## Overview

This project provides a simple, read-only HTTP API wrapper around the `@actual-app/api` library for [Actual Budget](https://actualbudget.org/). It's designed to run as a Docker container, typically within the same Docker network as an Actual Budget server instance.

The primary goal is to expose specific read-only data points from your Actual Budget instance via a clean RESTful interface, making it easier to integrate with other tools (like n8n, Home Assistant, custom dashboards, etc.) without needing those tools to directly use the `@actual-app/api` library or have full access to the budget file management.

## Motivation

This was built to facilitate integration between a self-hosted Actual Budget server and other services (initially n8n) running in the same local network (specifically, within Docker). It provides a secure (read-only) and simplified way to query budget data programmatically over HTTP.

## Features

*   **Read-Only Access:** Only exposes GET endpoints, ensuring no accidental modifications to your budget data via this wrapper.
*   **Connects to Actual Server:** Interfaces with your running Actual Budget server instance.
*   **Environment Variable Configuration:** Easily configured using environment variables, perfect for containerized deployments.
*   **Dockerized:** Includes a `Dockerfile` for easy building and deployment.
*   **Specific Endpoints:** Provides clear endpoints for common data points like accounts, transactions (by date range), categories, payees, budget months, and rules.

## Tech Stack

*   [Node.js](https://nodejs.org/) (Developed/Tested with v20)
*   [Express.js](https://expressjs.com/)
*   [@actual-app/api](https://actualbudget.org/docs/api/reference)
*   [Docker](https://www.docker.com/)

## Prerequisites

*   **Node.js:** v18 or preferably v20+ installed locally (for development/testing).
*   **npm** or **yarn:** For managing dependencies.
*   **Docker:** Required for building and running the containerized application. [Docker Compose](https://docs.docker.com/compose/) is recommended for easier management alongside Actual Budget.
*   **Running Actual Budget Server:** You need an instance of Actual Budget server running and accessible from where this wrapper will run (ideally on the same Docker network).
*   **Budget Sync ID:** You need the Sync ID (UUID) of the budget file you want to access. You can usually find this via the Actual UI or potentially by hitting the `/budgets/list` endpoint once the wrapper is initially set up without a specific budget loaded (if the API allows).

## Setup (Local Development)

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    Set the required environment variables (see Configuration section below). You can use a `.env` file (install `dotenv` with `npm install dotenv` and uncomment the `require('dotenv').config()` line in `server.js`) or export them in your shell.

4.  **Run the server:**
    ```bash
    npm start
    # or
    node server.js
    ```

## Configuration

The application is configured using environment variables:

| Variable                 | Required | Default         | Description                                                                                                                            |
| :----------------------- | :------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `ACTUAL_SERVER_URL`      | **Yes**  | -               | URL of your running Actual Budget server (e.g., `http://actual-server:5006` if running in Docker with service name `actual-server`).       |
| `ACTUAL_BUDGET_SYNC_ID`  | **Yes**  | -               | The Sync ID (UUID) of the Actual Budget file you want this wrapper to load and serve data from.                                          |
| `ACTUAL_SERVER_PASSWORD` | No       | -               | Password for your Actual Budget server instance, if you have set one.                                                                  |
| `ACTUAL_BUDGET_PASSWORD` | No       | -               | Password for the specific budget file *if* it is encrypted.                                                                            |
| `WRAPPER_PORT`           | No       | `3000`          | Port on which this wrapper server will listen inside the container.                                                                    |
| `DATA_DIR`               | No       | `./data`        | Path inside the container where the `@actual-app/api` library will store cached budget files and metadata. Recommended to map to a volume. |
| `NODE_ENV`               | No       | `production`    | Node environment. Set in Dockerfile, primarily affects npm install behavior (`--omit=dev`).                                               |

## Running with Docker (Recommended)

1.  **Build the Docker image:**
    ```bash
    docker build -t actual-api-wrapper .
    ```

2.  **Run the container:**
    You need to run the container attached to the same Docker network as your Actual Budget server and provide the necessary environment variables. Mapping the `DATA_DIR` to a Docker volume is highly recommended for persistence of the budget file cache.

    ```bash
    docker run -d --name actual-wrapper \
      --network your_actual_network_name \
      -p 3000:3000 \
      -e ACTUAL_SERVER_URL="http://actual-server:5006" \
      -e ACTUAL_BUDGET_SYNC_ID="YOUR_BUDGET_UUID" \
      -e ACTUAL_SERVER_PASSWORD="your_actual_server_password" \
      -e ACTUAL_BUDGET_PASSWORD="your_budget_file_password" \
      -e WRAPPER_PORT="3000" \
      -v actual_wrapper_data:/usr/src/app/data \
      actual-api-wrapper
    ```

    *   Replace `your_actual_network_name` with the name of the Docker network your Actual Budget server uses.
    *   Replace `actual-server` with the **service name** of your Actual Budget container within the Docker network.
    *   Replace `YOUR_BUDGET_UUID` with your budget file's Sync ID.
    *   Provide passwords if applicable.
    *   Adjust the host port mapping (`-p 3000:3000`) if needed. If only accessed by other containers in the network (like n8n), you might not need `-p`.
    *   `actual_wrapper_data` is a named Docker volume to persist the cache.

3.  **Using Docker Compose (Example Snippet):**
    Integrating this into your existing `docker-compose.yml` for Actual Budget and n8n is ideal:

    ```yaml
    version: '3.8'

    services:
      actual-server:
        # ... your existing actual-server configuration ...
        networks:
          - actual-net

      n8n:
        # ... your existing n8n configuration ...
        networks:
          - actual-net

      actual-api-wrapper:
        build: ./path/to/your/wrapper/code # Or use image: actual-api-wrapper if pre-built
        container_name: actual-wrapper
        restart: unless-stopped
        environment:
          - ACTUAL_SERVER_URL=http://actual-server:5006 # Uses service name
          - ACTUAL_BUDGET_SYNC_ID=${ACTUAL_BUDGET_SYNC_ID} # Use .env file or set directly
          - ACTUAL_SERVER_PASSWORD=${ACTUAL_SERVER_PASSWORD}
          - ACTUAL_BUDGET_PASSWORD=${ACTUAL_BUDGET_PASSWORD}
          - WRAPPER_PORT=3000
          - DATA_DIR=/usr/src/app/data
        volumes:
          - actual_wrapper_data:/usr/src/app/data
        networks:
          - actual-net
        # No ports needed if only accessed internally by n8n/other services
        # ports:
        #  - "3000:3000" # Uncomment to expose on host

    networks:
      actual-net:
        driver: bridge

    volumes:
      actual_wrapper_data:
    ```

## API Endpoints (Read-Only)

All endpoints are prefixed by the server address (e.g., `http://localhost:3000` or `http://actual-wrapper:3000` within Docker).

*   **`GET /status`**
    *   Basic health check.
    *   Returns: `{ "status": "ok", "message": "Actual API Wrapper is running" }`

*   **`GET /budgets/list`**
    *   Lists available budget files known to the Actual server.
    *   Returns: Array of `BudgetFile` objects. [0]

*   **`GET /budgets/months`**
    *   Gets a list of all months for which budget data exists.
    *   Returns: Array of month strings (`YYYY-MM`). [0]

*   **`GET /budgets/months/:month`**
    *   Gets detailed budget information for a specific month.
    *   `:month` parameter should be in `YYYY-MM` format.
    *   Returns: `Budget` object for the month. [0]

*   **`GET /accounts`**
    *   Gets a list of all accounts (on-budget and off-budget).
    *   Returns: Array of `Account` objects. [0]

*   **`GET /accounts/:id/balance`**
    *   Gets the balance for a specific account.
    *   `:id` is the account UUID.
    *   Optional query parameter: `cutoff=YYYY-MM-DD` to get balance as of a specific date.
    *   Returns: `{ "accountId": "...", "balance": 12345 }` (balance as integer). [0]

*   **`GET /accounts/:id/transactions`**
    *   Gets transactions for a specific account within a date range.
    *   `:id` is the account UUID.
    *   **Required** query parameters: `startDate=YYYY-MM-DD` and `endDate=YYYY-MM-DD`.
    *   Returns: Array of `Transaction` objects. [0]

*   **`GET /categories`**
    *   Gets a list of all spending and income categories.
    *   Returns: Array of `Category` objects. [0]

*   **`GET /category-groups`**
    *   Gets a list of all category groups, including the categories within each group.
    *   Returns: Array of `CategoryGroup` objects. [0]

*   **`GET /payees`**
    *   Gets a list of all payees.
    *   Returns: Array of `Payee` objects. [0]

*   **`GET /rules`**
    *   Gets a list of all general rules.
    *   Returns: Array of `Rule` objects. [0]

*   **`GET /payees/:id/rules`**
    *   Gets rules associated with a specific payee.
    *   `:id` is the payee UUID.
    *   Returns: Array of `PayeeRule` objects. [0]

## Docker Image Notes (Alpine vs. Slim)

The `Dockerfile` currently uses `node:20-slim` as the base image. Initially, `node:18-alpine` was tested but encountered potential issues, possibly related to native dependencies or ARM64 architecture compatibility which can sometimes be problematic with Alpine's `musl libc`.

The `-slim` variant (Debian-based) generally offers better compatibility for a wider range of Node.js packages, especially those with native C++ addons, at the cost of a slightly larger image size compared to Alpine. If you encounter build or runtime issues, sticking with `node:20-slim` or a similar Debian-based Node image is recommended.

## Future Ideas / TODO

*   [ ] Add more specific read-only endpoints if needed (e.g., get single transaction by ID, query specific budget values).
*   [ ] Implement optional basic authentication (e.g., API key in header) for the wrapper itself, adding a layer of security even within the Docker network.
*   [ ] Enhance logging.
*   [ ] Add unit or integration tests.
*   [ ] Explore exposing ActualQL via a `/query` endpoint (potentially complex security considerations).
