import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import XLSX from 'xlsx'

const HEADERS = ['id', 'title', 'category', 'price', 'description', 'image_url', 'cloudinary_public_id', 'created_at', 'updated_at']
const SAMPLES = [
  { id: 'sample-tote', title: 'The Everyday Tote', category: 'Tote Bags', price: 2499, description: 'A generous, soft-structured carryall for market mornings and slow afternoons.', image_url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1000&q=85', cloudinary_public_id: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'sample-sling', title: 'Sunset Sling', category: 'Sling Bags', price: 1899, description: 'A light, hands-free companion with an easy shape and a long woven fringe.', image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', cloudinary_public_id: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'sample-knot', title: 'Knotwork Mini', category: 'Mini Bags', price: 1499, description: 'Small enough for the essentials, expressive enough to be remembered.', image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=85', cloudinary_public_id: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
]
const COLLECTION_CATEGORIES = [
  'Classic Mini Bagpack',
  'Tango Mini Bagpack',
  'Classic Medium Bagpack',
  'Campus Duo Backpack',
  'Urban Large Bagpack',
  'Blush Wooden Handle Totte Bags',
  'Sunset Handbags',
  'Rusty Charm Handbags'
]

function inferredCategory(product) {
  if (product.category) return product.category
  if (product.id === 'sample-tote' || product.title?.toLowerCase().includes('tote')) return 'Tote Bags'
  if (product.id === 'sample-sling' || product.title?.toLowerCase().includes('sling')) return 'Sling Bags'
  if (product.id === 'sample-knot' || product.title?.toLowerCase().includes('mini')) return 'Mini Bags'
  return 'Uncategorized'
}

export class ProductRepository {
  constructor(filePath = process.env.PRODUCTS_FILE || path.join('data', 'products.xlsx')) {
    this.filePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    this.lockPath = `${this.filePath}.lock`
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    if (!fs.existsSync(this.filePath)) this.write(SAMPLES)
    else {
      const products = this.readRaw()
      if (products.some((product) => !product.category)) this.withLock(() => this.write(products.map((product) => ({ ...product, category: inferredCategory(product) }))))
    }
  }

  readRaw() {
    const workbook = XLSX.readFile(this.filePath)
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
  }

  read() {
    return this.readRaw().map((product) => ({ ...product, category: inferredCategory(product) }))
  }

  list() { return this.read() }
  get(id) { return this.read().find((product) => product.id === id) || null }
  categories() {
    const grouped = new Map()
    for (const name of COLLECTION_CATEGORIES) grouped.set(name, { name, count: 0, image_url: SAMPLES[0].image_url })
    for (const product of this.read()) {
      const current = grouped.get(product.category) || { name: product.category, count: 0, image_url: product.image_url }
      current.count += 1
      if (!current.image_url) current.image_url = product.image_url
      grouped.set(product.category, current)
    }
    return [...grouped.values()]
  }

  withLock(operation) {
    let handle
    try {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try { handle = fs.openSync(this.lockPath, 'wx'); break } catch (error) {
          if (error.code !== 'EEXIST') throw error
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
        }
      }
      if (!handle) throw new Error('Product workbook is busy')
      return operation()
    } finally {
      if (handle) fs.closeSync(handle)
      if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath)
    }
  }

  write(products) {
    const worksheet = XLSX.utils.json_to_sheet(products, { header: HEADERS })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    XLSX.writeFile(workbook, temporaryPath, { bookType: 'xlsx' })
    fs.renameSync(temporaryPath, this.filePath)
  }

  create(input) {
    const now = new Date().toISOString()
    const record = { id: randomUUID(), ...input, created_at: now, updated_at: now }
    this.withLock(() => this.write([...this.read(), record]))
    return record
  }

  update(id, changes) {
    let updated
    this.withLock(() => {
      const products = this.read()
      const index = products.findIndex((product) => product.id === id)
      if (index < 0) return
      updated = { ...products[index], ...changes, id, updated_at: new Date().toISOString() }
      products[index] = updated
      this.write(products)
    })
    return updated || null
  }

  delete(id) {
    let deleted = false
    this.withLock(() => {
      const products = this.read()
      const remaining = products.filter((product) => product.id !== id)
      deleted = remaining.length !== products.length
      if (deleted) this.write(remaining)
    })
    return deleted
  }
}