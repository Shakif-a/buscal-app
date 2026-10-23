# Micromax Dashboard (OKR Extension)

This repository is a stripped-down extract of the **Micromax Dashboard**, currently containing only the **Business Calendar module**, along with the underlying support infrastructure.

The **OKR module has been created and installed to act as a seemless addition to the existing ecosystem**.

---

## 🚀 Getting Started (Local Development Setup)

### 1. Backend Setup

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

### 2. Frontend Setup

Open a new terminal window and navigate to the frontend:

```bash
cd frontend
yarn install
yarn add recharts
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

## 🧪 Sample Data (Optional)

To fill the database with a fictional company's users, groups, objectives and key results, run this from the backend folder (after setting up `.env`):

```bash
cd backend
yarn seed:sample
```

Every sample user signs in with the password `SamplePass123!`. The admin is `priya.raman@harbourline.example.com`.

- Use `yarn seed:sample --password <password>` to pick a different password.
- Use `yarn seed:sample --reset` to remove the sample data and load it again.

The data lives in `backend/seed/okrSampleData.json`.

---

## 📌 Default Ports

| Service  | Port |
|----------|------|
| Backend  | 5000 |
| Frontend | 3000 |
