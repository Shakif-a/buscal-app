# Micromax Dashboard (Business Calendar Module)

This repository is a stripped-down extract of the **Micromax Dashboard**, currently containing only the **Business Calendar module**, along with supporting infrastructure such as:

- Account management
- User roles and permissions
- Notification system

The **OKR module is intended to be built using this codebase as the foundation**.

---

## 🚀 Getting Started (Local Development Setup)

### 1. Clone the Repository

```bash
git clone <repo-url>
cd <repo-folder>
```

---

### 2. Backend Setup

Navigate into the backend directory:

```bash
cd backend
yarn install
```

#### Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Then update the `.env` file with your local configuration:

- MONGO_URI → your MongoDB connection string
- JWT_SECRET → your authentication secret key

#### Run Backend Server

```bash
yarn start
```

By default, the backend runs on:

http://localhost:5000

---

### 3. Frontend Setup

Open a new terminal window and navigate to the frontend:

```bash
cd frontend
yarn install
yarn start
```

By default, the frontend runs on:

http://localhost:3000

---

## 🌐 Accessing the Application

Once both services are running:

Open your browser and navigate to:

http://localhost:3000

---

## 👤 First-Time Setup

- On first run, register a new user account.
- The **first registered account is automatically assigned admin privileges**.
- Any subsequent accounts require **admin approval** before full access is granted.

---

## 🧩 Notes for Developers

- This codebase is intentionally modular and partially trimmed from a larger system.
- Some UI elements may appear inconsistent due to export restructuring.
- Developers are encouraged to freely modify and improve the aesthetics and structure of the application.
- The OKR module should follow existing patterns used in the Business Calendar module.

---

## 📌 Default Ports

| Service  | Port |
|----------|------|
| Backend  | 5000 |
| Frontend | 3000 |
