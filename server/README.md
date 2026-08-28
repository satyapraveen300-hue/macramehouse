# Macrame House Express API

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API listens on `http://localhost:8000`. Set `MONGODB_URI` in `.env` to a MongoDB deployment and optionally set `MONGODB_DB` and `MONGODB_COLLECTION`. Product collections start empty; add products through the admin panel. Set the Cloudinary values before using admin image uploads.
