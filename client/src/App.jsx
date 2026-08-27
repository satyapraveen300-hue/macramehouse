import { useEffect, useState } from 'react'
import { ArrowRight, Camera, Menu, MessageCircle, Plus, Trash2, X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '919999999999'
const collectionCategories = [
  'Classic Mini Bagpack',
  'Tango Mini Bagpack',
  'Classic Medium Bagpack',
  'Campus Duo Backpack',
  'Urban Large Bagpack',
  'Blush Wooden Handle Totte Bags',
  'Sunset Handbags',
  'Rusty Charm Handbags'
]

const fallbackProducts = [
  {
    id: 'sample-tote',
    title: 'The Everyday Tote',
    category: 'Tote Bags',
    price: 2499,
    description: 'A generous, soft-structured carryall for market mornings and slow afternoons.',
    image_url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1000&q=85'
  },
  {
    id: 'sample-sling',
    title: 'Sunset Sling',
    category: 'Sling Bags',
    price: 1899,
    description: 'A light, hands-free companion with an easy shape and a long woven fringe.',
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85'
  },
  {
    id: 'sample-knot',
    title: 'Knotwork Mini',
    category: 'Mini Bags',
    price: 1499,
    description: 'Small enough for the essentials, expressive enough to be remembered.',
    image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=85'
  }
]

function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price)
}

function categorySlug(category) {
  return encodeURIComponent(category.toLowerCase().replace(/\s+/g, '-'))
}

function whatsappLink(product) {
  const message = `Hi! I'm interested in this product:\n\nTitle: ${product.title}\nPrice: ${formatPrice(product.price)}\nPhoto: ${product.image_url}`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem('macrame_admin_token'))
  const [products, setProducts] = useState([])
  const [login, setLogin] = useState({ username: '', password: '' })
  const [form, setForm] = useState({ title: '', category: '', price: '', description: '', image_url: '' })
  const [message, setMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadProducts = () => fetch(`${API_URL}/api/products`).then((response) => response.json()).then(setProducts)
  const [collectionCategories, setCollectionCategories] = useState([])
  const adminCategories = [...new Set([...collectionCategories, ...products.map((product) => product.category).filter(Boolean)])]
  const visibleProducts = categoryFilter === 'all' ? products : products.filter((product) => product.category === categoryFilter)
  useEffect(() => {
    if (!token) return
    loadProducts()
    fetch(`${API_URL}/api/categories`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((categories) => setCollectionCategories(categories.map((category) => category.name)))
      .catch(() => {})
  }, [token])

  const signIn = async (event) => {
    event.preventDefault()
    const response = await fetch(`${API_URL}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) })
    if (!response.ok) return setMessage('That login did not match.')
    const data = await response.json()
    localStorage.setItem('macrame_admin_token', data.token)
    setToken(data.token)
  }

  const addProduct = async (event) => {
    event.preventDefault()
    if (!imageFile) return setMessage('Choose an image before adding this piece.')
    setSaving(true)
    try {
      const uploadData = new FormData()
      uploadData.append('file', imageFile)
      const uploadResponse = await fetch(`${API_URL}/api/admin/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: uploadData })
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json().catch(() => ({}))
        throw new Error(uploadError.upstream_error || uploadError.detail || 'upload')
      }
      const uploadedImage = await uploadResponse.json()
      const response = await fetch(`${API_URL}/api/admin/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...form, price: Number(form.price), image_url: uploadedImage.image_url, cloudinary_public_id: uploadedImage.cloudinary_public_id }) })
      if (!response.ok) throw new Error('product')
      setForm({ title: '', category: '', price: '', description: '', image_url: '' }); setImageFile(null); event.target.reset(); setMessage('Image uploaded and piece added to the collection.'); loadProducts()
    } catch (error) {
      setMessage(error.message === 'upload' ? 'Image upload failed. Check Cloudinary configuration.' : `Image upload failed: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const removeProduct = async (id) => {
    await fetch(`${API_URL}/api/admin/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    loadProducts()
  }

  if (!token) return <main className="admin-page"><a className="admin-back" href="/">← back to shop</a><div className="admin-login"><img src="/logo-macrame.png" alt="Macrame House" /><p className="eyebrow">Studio door</p><h1>Welcome<br /><em>back.</em></h1><form onSubmit={signIn}><label>Username<input value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} required /></label><label>Password<input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required /></label><button className="whatsapp-button" type="submit">Enter studio</button><p className="form-message">{message}</p></form></div></main>

  return <main className="admin-page"><header className="admin-header"><a href="/"><img src="/logo-macrame.png" alt="Macrame House" /></a><div><p className="eyebrow">Private studio</p><h1>Product <em>shelf.</em></h1></div><button className="admin-logout" onClick={() => { localStorage.removeItem('macrame_admin_token'); setToken(null) }}>Log out</button></header><section className="admin-content"><form className="product-form" onSubmit={addProduct}><p className="eyebrow">Add a new piece</p><h2>Bring it<br /><em>to life.</em></h2><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Category<select value={form.category} onChange={(event) => { const category = event.target.value === '__new__' ? window.prompt('New category name')?.trim() : event.target.value; if (category) setForm({ ...form, category }) }} required><option value="">Choose a category</option>{adminCategories.map((category) => <option value={category} key={category}>{category}</option>)}<option value="__new__">Add new category...</option></select></label><label>Price in INR<input type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label>Product image<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} required /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="whatsapp-button" type="submit" disabled={saving}><Plus size={16} /> {saving ? 'Uploading...' : 'Add piece'}</button><p className="form-message">{message}</p></form><div className="admin-list"><div className="list-heading"><p className="eyebrow">Current collection</p><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{adminCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select><span>{visibleProducts.length} pieces</span></div>{visibleProducts.map((product) => <div className="admin-product" key={product.id}><img src={product.image_url} alt="" /><div><strong>{product.title}</strong><small>{product.category} · {formatPrice(product.price)}</small></div><button onClick={() => removeProduct(product.id)} aria-label={`Delete ${product.title}`}><Trash2 size={16} /></button></div>)}</div></section></main>
}

function CategoryPage({ category, products }) {
  const categoryProducts = products.filter((product) => product.category?.toLowerCase() === category.toLowerCase())
  return <div className="site-shell category-page"><header className="site-header"><a className="brand" href="/"><img src="/logo-macrame.png" alt="Macrame House by Yash" /></a><a className="header-mark" href="/"><ArrowRight size={16} /> Back to categories</a></header><main className="category-main"><p className="eyebrow">The collection / {category}</p><h1>{category}<br /><em>in focus.</em></h1><div className="rope-rule"><span /></div><div className="product-grid">{categoryProducts.map((product, index) => <article className={`product-card card-${index + 1}`} key={product.id}><a className="product-image" href={`/product/${encodeURIComponent(product.id)}`}><img src={product.image_url} alt={product.title} /><span className="view-label">View piece <ArrowRight size={14} /></span></a><div className="product-meta"><h3>{product.title}</h3><p>{formatPrice(product.price)}</p></div></article>)}</div>{categoryProducts.length === 0 && <p className="data-note">This category is waiting for its first piece.</p>}</main></div>
}

function ProductPage({ productId }) {
  const [product, setProduct] = useState(fallbackProducts.find((item) => item.id === productId) || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/products/${encodeURIComponent(productId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  if (loading && !product) return <main className="category-main"><p className="data-note">Loading this piece...</p></main>
  if (!product) return <main className="category-main"><p className="data-note">This piece could not be found.</p><a className="text-link" href="/">Back to categories <ArrowRight size={16} /></a></main>
  return <div className="site-shell product-page"><header className="site-header"><a className="brand" href="/"><img src="/logo-macrame.png" alt="Macrame House by Yash" /></a><a className="header-mark" href={`/category/${categorySlug(product.category || 'Uncategorized')}`}><ArrowRight size={16} /> Back to category</a></header><main className="product-detail"><img src={product.image_url} alt={product.title} /><div className="product-detail-copy"><p className="eyebrow">{product.category || 'Handmade piece'}</p><h1>{product.title}</h1><strong>{formatPrice(product.price)}</strong><p>{product.description}</p><a className="whatsapp-button" href={whatsappLink(product)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Order on WhatsApp</a></div></main></div>
}

function App() {
  if (window.location.pathname.startsWith('/admin')) return <AdminPanel />
  const productMatch = window.location.pathname.match(/^\/product\/([^/]+)/)
  if (productMatch) return <ProductPage productId={decodeURIComponent(productMatch[1])} />
  const categoryMatch = window.location.pathname.match(/^\/category\/([^/]+)/)
  const [products, setProducts] = useState(fallbackProducts)
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState('sample')

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { setProducts(data); setStatus('ready') })
      .catch(() => setStatus('sample'))
    fetch(`${API_URL}/api/categories`).then((response) => response.ok ? response.json() : Promise.reject()).then(setCategories).catch(() => setCategories(collectionCategories.map((name) => ({ name, count: 0, image_url: fallbackProducts[0].image_url }))))
  }, [])

  if (categoryMatch) {
    const category = decodeURIComponent(categoryMatch[1]).replace(/-/g, ' ')
    const matchingProduct = products.find((product) => product.category?.toLowerCase() === category.toLowerCase())
    return <CategoryPage category={matchingProduct?.category || category.replace(/\b\w/g, (letter) => letter.toUpperCase())} products={products} />
  }

  return (
    <div className="site-shell">
      <div className="top-note">Every piece is knotted by hand in small batches <span>✳</span></div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Macrame House home">
          <img src="/logo-macrame.png" alt="Macrame House by Yash" />
        </a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#collection" onClick={() => setMenuOpen(false)}>The collection</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>Our story</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Say hello</a>
        </nav>
        <a className="header-mark" href="#collection">Explore <ArrowRight size={16} /></a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Handmade macrame bags</p>
            <h1>Carry a little<br /><em>more meaning.</em></h1>
            <p className="hero-intro">Thoughtful, one-of-a-kind bags made slowly with cotton cord, patient hands, and a love for the everyday.</p>
            <a className="text-link" href="#collection">See the collection <ArrowRight size={16} /></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun-disc" />
            <div className="hero-line line-one" />
            <div className="hero-line line-two" />
            <div className="woven-shape"><span /><span /><span /><span /><span /><span /><span /></div>
            <p className="hero-stamp">made slowly<br />made to last</p>
          </div>
        </section>

        <section className="collection-section" id="collection">
          <div className="section-heading">
            <div><p className="eyebrow">The little shop</p><h2>Made for your<br /><em>every day.</em></h2></div>
            <p className="section-note">No two knots are quite the same.<br />That is where the magic lives.</p>
          </div>
          <div className="rope-rule"><span /></div>
          <div className="category-distribution" aria-label="Shop by category">
            {(categories.length ? categories : [...new Set(products.map((product) => product.category).filter(Boolean))].map((name) => ({ name, count: products.filter((product) => product.category === name).length, image_url: products.find((product) => product.category === name)?.image_url }))).map((category) => <a className="category-card" href={`/category/${categorySlug(category.name)}`} key={category.name}><img src={category.image_url} alt="" /><span><strong>{category.name}</strong><small>{category.count} {category.count === 1 ? 'piece' : 'pieces'}</small></span><ArrowRight size={16} /></a>)}
          </div>
          {status === 'sample' && <p className="data-note">Showing studio samples while the collection is waking up.</p>}
        </section>

        <section className="story-section" id="story">
          <div className="story-thread" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="story-copy"><p className="eyebrow">A note from the maker</p><h2>Made by hand.<br /><em>Made with heart.</em></h2><p>Macrame House began with a few metres of cord, a quiet corner, and the belief that useful things can still feel beautiful. Every bag is patiently knotted by Yash, one loop at a time.</p><a className="text-link" href="#contact">Come say hello <ArrowRight size={16} /></a></div>
          <div className="story-badge"><span>✳</span><strong>slow<br />craft</strong><small>since<br />2024</small></div>
        </section>
      </main>

      <footer id="contact" className="site-footer"><div><img src="/logo-macrame.png" alt="Macrame House" /><p>Small batches. Soft knots. Big feeling.</p></div><div className="footer-contact"><p>Have a question or a custom idea?</p><a href={`https://wa.me/${WHATSAPP_NUMBER}`}><MessageCircle size={16} /> Chat on WhatsApp</a><a href="#collection"><Camera size={16} /> Follow the making</a></div><small>© 2026 Macrame House by Yash</small></footer>

      {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><div className="product-modal" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(event) => event.stopPropagation()}><button className="close-modal" onClick={() => setSelected(null)} aria-label="Close product"><X size={20} /></button><img src={selected.image_url} alt={selected.title} /><div className="modal-copy"><p className="eyebrow">One of a kind</p><h2>{selected.title}</h2><strong>{formatPrice(selected.price)}</strong><p>{selected.description}</p><a className="whatsapp-button" href={whatsappLink(selected)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Order on WhatsApp</a></div></div></div>}
    </div>
  )
}

export default App
