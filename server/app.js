import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { ProductRepository } from './repository.js'

const app = express()
const port = Number(process.env.PORT || 8000)
const repository = new ProductRepository()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/'))
})

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret')
    if (payload.sub !== (process.env.ADMIN_USERNAME || 'admin')) throw new Error()
    next()
  } catch { response.status(401).json({ detail: 'Invalid or expired admin session' }) }
}

function validateProduct(request, response, next) {
  const { title, price } = request.body
  if (!title?.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) return response.status(422).json({ detail: 'Title and a positive price are required' })
  request.body = { title: title.trim(), category: request.body.category?.trim() || 'Uncategorized', price: Number(price), description: request.body.description || '', image_url: request.body.image_url || '', cloudinary_public_id: request.body.cloudinary_public_id || '' }
  next()
}

function isCloudinaryImage(imageUrl, publicId) {
  return imageUrl.startsWith('https://res.cloudinary.com/') && Boolean(publicId)
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/products', (_request, response) => response.json(repository.list()))
app.get('/api/categories', (_request, response) => response.json(repository.categories()))
app.get('/api/categories/:category/products', (request, response) => {
  const category = decodeURIComponent(request.params.category).replace(/-/g, ' ').toLowerCase()
  response.json(repository.list().filter((product) => product.category.toLowerCase() === category))
})
app.get('/api/products/:id', (request, response) => {
  const product = repository.get(request.params.id)
  return product ? response.json(product) : response.status(404).json({ detail: 'Product not found' })
})
app.post('/api/admin/login', (request, response) => {
  const { username, password } = request.body
  if (username !== (process.env.ADMIN_USERNAME || 'admin') || password !== (process.env.ADMIN_PASSWORD || 'change-me')) return response.status(401).json({ detail: 'Invalid credentials' })
  response.json({ token: jwt.sign({ sub: username }, process.env.JWT_SECRET || 'development-secret', { expiresIn: '12h' }) })
})
app.post('/api/admin/products', requireAdmin, validateProduct, (request, response) => {
  if (!isCloudinaryImage(request.body.image_url, request.body.cloudinary_public_id)) return response.status(422).json({ detail: 'A Cloudinary image is required before saving the product' })
  response.status(201).json(repository.create(request.body))
})
app.put('/api/admin/products/:id', requireAdmin, validateProduct, (request, response) => {
  const product = repository.update(request.params.id, request.body)
  return product ? response.json(product) : response.status(404).json({ detail: 'Product not found' })
})
app.delete('/api/admin/products/:id', requireAdmin, (request, response) => repository.delete(request.params.id) ? response.json({ deleted: true }) : response.status(404).json({ detail: 'Product not found' }))
app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (request, response) => {
  if (!request.file) return response.status(415).json({ detail: 'Only image files are accepted' })
  const configured = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every((key) => process.env[key])
  if (!configured) return response.status(503).json({ detail: 'Cloudinary is not configured' })
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
  try {
    const result = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ folder: 'macrame-house', resource_type: 'image' }, (error, value) => error ? reject(error) : resolve(value)).end(request.file.buffer))
    response.json({ image_url: result.secure_url, cloudinary_public_id: result.public_id })
  } catch (error) {
    const upstreamError = error?.error?.message || error?.message || 'Cloudinary rejected the upload'
    console.error('Cloudinary upload failed:', upstreamError)
    response.status(502).json({ detail: 'Cloudinary upload failed. Check the Cloudinary cloud name, API key, and API secret.', upstream_error: upstreamError })
  }
})

app.listen(port, () => console.log(`Macrame House API listening on http://localhost:${port}`))