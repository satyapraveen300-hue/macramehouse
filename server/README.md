# Macrame House Express API

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API listens on `http://localhost:8000`. If `data/products.xlsx` does not exist, the server creates it with three sample products on first start. Set the Cloudinary values in `.env` before using admin image uploads. Excel is the source of truth and product writes are serialized by a lock file.
