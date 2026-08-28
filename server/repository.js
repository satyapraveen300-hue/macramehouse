import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'

const COLLECTION_CATEGORIES = [
  'Classic Mini Bagpack',
  'Tango Mini Bagpack',
  'Campus Duo Backpack',
  'Urban Large Bagpack',
  'Blush Wooden Handle Totte Bags',
  'Sunset Handbags',
  'Rusty Charm Handbags'
]

function inferredCategory(product) {
  if (product.category) return product.category
  return 'Uncategorized'
}

export class ProductRepository {
  constructor() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is required')
    this.client = new MongoClient(uri)
    this.database = process.env.MONGODB_DB || 'macrame_house'
    this.collectionName = process.env.MONGODB_COLLECTION || 'products'
    this.categoryCollectionName = process.env.MONGODB_CATEGORY_COLLECTION || 'categories'
    this.ready = this.initialize()
  }

  async initialize() {
    await this.client.connect()
    this.collection = this.client.db(this.database).collection(this.collectionName)
    this.categoryCollection = this.client.db(this.database).collection(this.categoryCollectionName)
    await this.collection.createIndex({ id: 1 }, { unique: true })
    await this.categoryCollection.createIndex({ name: 1 }, { unique: true })
    await this.collection.deleteMany({
      $or: [
        { id: { $in: ['sample-tote', 'sample-sling', 'sample-knot'] } },
        { category: { $in: ['Tote Bags', 'Sling Bags', 'Mini Bags'] } }
      ]
    })
  }

  async read() {
    await this.ready
    const products = await this.collection.find({}, { projection: { _id: 0 } }).sort({ created_at: 1 }).toArray()
    return products.map((product) => ({ ...product, category: inferredCategory(product) }))
  }

  async list() { return this.read() }
  async get(id) { return (await this.read()).find((product) => product.id === id) || null }
  async categories() {
    const products = await this.read()
    const coverRecords = await this.categoryCollection.find({}, { projection: { _id: 0 } }).toArray()
    const covers = new Map(coverRecords.map((record) => [record.name, record.cover_product_id]))
    const grouped = new Map()
    for (const name of COLLECTION_CATEGORIES) grouped.set(name, { name, count: 0, image_url: '' })
    for (const product of products) {
      const current = grouped.get(product.category) || { name: product.category, count: 0, image_url: '' }
      current.count += 1
      if (covers.get(product.category) === product.id) current.image_url = product.image_url
      else if (!current.image_url) current.image_url = product.image_url
      current.cover_product_id = covers.get(product.category) || ''
      grouped.set(product.category, current)
    }
    return [...grouped.values()]
  }

  async setCategoryCover(name, productId) {
    await this.ready
    const product = await this.collection.findOne({ id: productId, category: name })
    if (!product) return null
    await this.categoryCollection.updateOne(
      { name },
      { $set: { name, cover_product_id: productId, updated_at: new Date().toISOString() } },
      { upsert: true }
    )
    return { name, cover_product_id: productId, image_url: product.image_url }
  }

  async create(input) {
    await this.ready
    const now = new Date().toISOString()
    const record = { id: randomUUID(), ...input, created_at: now, updated_at: now }
    await this.collection.insertOne(record)
    return record
  }

  async update(id, changes) {
    await this.ready
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...changes, updated_at: new Date().toISOString() } },
      { returnDocument: 'after', projection: { _id: 0 } }
    )
    return result || null
  }

  async delete(id) {
    await this.ready
    const result = await this.collection.deleteOne({ id })
    if (result.deletedCount === 1) await this.categoryCollection.deleteMany({ cover_product_id: id })
    return result.deletedCount === 1
  }
}