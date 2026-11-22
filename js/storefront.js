(() => {
  const $ = id => document.getElementById(id);
  const money = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const placeholder = brand => brand === 'jewelry'
    ? 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&auto=format&fit=crop&q=85'
    : 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=900&auto=format&fit=crop&q=85';
  let catalog = [], settings = { delivery_fee: 0 }, cart = {}, filters = { clothing: 'All', jewelry: 'All' };
  let productsChannel = null;

  const client = () => {
    if (!window.sb) throw Error('Supabase is not configured. Add the project URL and publishable key in js/config.js.');
  };
  const toast = message => {
    const el = $('toast'); el.textContent = message; el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2200);
  };
  const productPrice = p => Number(p.sale_price ?? p.price);

  function renderFilters(brand) {
    const categories = ['All', ...new Set(catalog.filter(p => p.brand === brand).map(p => p.category).filter(Boolean))];
    const el = $(`${brand}Filters`);
    el.innerHTML = categories.map(category => `<button class="category ${filters[brand] === category ? 'active' : ''}" data-filter-brand="${brand}" data-filter="${esc(category)}">${esc(category)}</button>`).join('');
    el.querySelectorAll('[data-filter-brand]').forEach(button => button.onclick = () => {
      filters[brand] = button.dataset.filter; renderFilters(brand); renderProducts(brand);
    });
  }
  function renderProducts(brand) {
    const search = ($(`${brand}Search`).value || '').trim().toLowerCase();
    const sort = $(`${brand}Sort`).value;
    let items = catalog.filter(p => p.brand === brand && (filters[brand] === 'All' || p.category === filters[brand]));
    if (search) items = items.filter(p => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search));
    items.sort((a, b) => sort === 'low' ? productPrice(a) - productPrice(b) : sort === 'high' ? productPrice(b) - productPrice(a) : sort === 'newest' ? new Date(b.created_at) - new Date(a.created_at) : Number(b.featured) - Number(a.featured));
    $(`${brand}Products`).innerHTML = items.length ? items.map(p => `<article class="product-card" data-detail="${p.id}">
      <div class="product-photo"><img loading="lazy" src="${esc(p.image_url || placeholder(brand))}" alt="${esc(p.name)}"><span class="badge">${p.sale_price ? 'Limited price' : p.featured ? 'Featured' : esc(p.category)}</span></div>
      <div class="product-info"><h3>${esc(p.name)}</h3><p>${esc(p.description || 'A considered piece for your everyday collection.')}</p>
      <div class="product-bottom"><span class="price">${money(productPrice(p))}${p.sale_price ? `<del class="old-price">${money(p.price)}</del>` : ''}</span><button class="add" data-add="${p.id}" aria-label="Add ${esc(p.name)}">+</button></div></div></article>`).join('') : '<div class="empty">No pieces match this selection yet.</div>';
    $(`${brand}Products`).querySelectorAll('[data-add]').forEach(button => button.onclick = () => {
      const id = button.dataset.add; cart[id] = (cart[id] || 0) + 1; renderCart(); toast('Added to your bag');
    });
    $(`${brand}Products`).querySelectorAll('[data-detail]').forEach(card => card.onclick = event => {
      if (event.target.closest('[data-add]')) return;
      const product = catalog.find(item => item.id === card.dataset.detail); if (!product) return;
      $('productDetailContent').innerHTML = `<p class="kicker">${product.brand === 'jewelry' ? 'Aarish Jewelry' : 'Aarish Co.'}</p><h2>${esc(product.name)}</h2><img class="detail-image" src="${esc(product.image_url || placeholder(product.brand))}" alt="${esc(product.name)}"><p class="muted">${esc(product.description || '')}</p><p class="price">${money(productPrice(product))}${product.sale_price ? ` <del class="old-price">${money(product.price)}</del>` : ''}</p><p class="muted small">${product.category ? `${esc(product.category)} · ` : ''}${product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Available while stocks last'}</p><button class="button button-dark full" id="detailAdd">Add to bag</button>`;
      $('detailAdd').onclick = () => { cart[product.id] = (cart[product.id] || 0) + 1; renderCart(); toggle('productDetailModal', false); toast('Added to your bag'); };
      toggle('productDetailModal', true);
    });
  }
  function totals() {
    let subtotal = 0, count = 0;
    Object.entries(cart).forEach(([id, quantity]) => { const p = catalog.find(item => item.id === id); if (p) { subtotal += productPrice(p) * quantity; count += quantity; } });
    return { subtotal, count, delivery: Number(settings.delivery_fee || 0) };
  }
  function renderCart() {
    const total = totals();
    $('cartCount').textContent = total.count; $('drawerCount').textContent = total.count ? `· ${total.count} items` : '';
    $('subtotal').textContent = money(total.subtotal); $('delivery').textContent = money(total.delivery); $('grand').textContent = money(total.subtotal + total.delivery); $('checkoutTotal').textContent = money(total.subtotal + total.delivery);
    const lines = Object.entries(cart).filter(([id]) => catalog.some(p => p.id === id));
    $('cartLines').innerHTML = lines.length ? lines.map(([id, quantity]) => { const p = catalog.find(item => item.id === id); return `<div class="cart-line"><div><strong>${esc(p.name)}</strong><small>${money(productPrice(p))} each · ${p.brand === 'jewelry' ? 'Aarish Jewelry' : 'Aarish Co.'}</small></div><div class="qty"><button data-dec="${id}">−</button><b>${quantity}</b><button data-inc="${id}">+</button></div></div>`; }).join('') : '<div class="empty"><b>Your bag is waiting.</b>Add a piece from either collection.</div>';
    $('cartLines').querySelectorAll('[data-inc]').forEach(button => button.onclick = () => { cart[button.dataset.inc]++; renderCart(); });
    $('cartLines').querySelectorAll('[data-dec]').forEach(button => button.onclick = () => { const id = button.dataset.dec; cart[id]--; if (cart[id] <= 0) delete cart[id]; renderCart(); });
  }
  const toggle = (id, on) => $(id).classList.toggle('open', on);
  $('menuToggle').onclick = () => $('mainNav').classList.toggle('open');
  $('mainNav').querySelectorAll('a').forEach(link => link.onclick = () => $('mainNav').classList.remove('open'));
  $('cartOpen').onclick = () => toggle('drawer', true); $('cartClose').onclick = () => toggle('drawer', false);
  $('drawer').onclick = event => { if (event.target.id === 'drawer') toggle('drawer', false); };
  $('checkoutClose').onclick = () => toggle('checkoutModal', false); $('checkoutModal').onclick = event => { if (event.target.id === 'checkoutModal') toggle('checkoutModal', false); };
  $('productDetailClose').onclick = () => toggle('productDetailModal', false); $('productDetailModal').onclick = event => { if (event.target.id === 'productDetailModal') toggle('productDetailModal', false); };
  $('checkoutBtn').onclick = () => { if (!totals().count) return toast('Your bag is empty'); toggle('checkoutModal', true); toggle('drawer', false); };
  ['clothing', 'jewelry'].forEach(brand => { $(`${brand}Search`).oninput = () => renderProducts(brand); $(`${brand}Sort`).onchange = () => renderProducts(brand); });
  $('checkoutForm').onsubmit = async event => {
    event.preventDefault(); const button = $('placeOrder'), error = $('checkoutError'); button.disabled = true; error.textContent = 'Placing your order…';
    try {
      client(); const form = new FormData(event.currentTarget);
      const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
      const { data, error: rpcError } = await sb.rpc('place_order', { p_customer_name: form.get('name'), p_customer_phone: form.get('phone'), p_customer_email: form.get('email') || '', p_delivery_address: form.get('address'), p_delivery_notes: form.get('notes') || '', p_items: items });
      if (rpcError) throw rpcError; cart = {}; renderCart();
      $('checkoutContent').innerHTML = `<div class="success"><div class="check">✓</div><p class="kicker">Order received</p><h2>Thank you for choosing Aarish.</h2><p class="muted">Your order number is <b>#${esc(data.order_number)}</b>. We will contact you to confirm delivery.</p><p class="muted">Payment: Cash on delivery.</p><button class="button button-dark" id="done">Back to shopping</button></div>`;
      $('done').onclick = () => location.reload();
    } catch (ex) { error.textContent = ex.message || 'Could not place your order. Please try again.'; } finally { button.disabled = false; }
  };
  async function load() {
    try {
      client();
      const [products, store] = await Promise.all([
        sb.from('products').select('id,name,description,category,price,sale_price,image_url,available,featured,brand,stock_quantity,created_at').eq('available', true).order('featured', { ascending: false }).order('created_at', { ascending: false }),
        sb.from('store_settings').select('delivery_fee,phone,address').eq('id', 1).single()
      ]);
      if (products.error) throw products.error; if (store.error) throw store.error;
      catalog = products.data || []; settings = store.data || settings;
      $('footPhone').textContent = settings.phone || 'Questions? Send us a message.'; $('footAddress').textContent = settings.address || '';
      renderFilters('clothing'); renderFilters('jewelry'); renderProducts('clothing'); renderProducts('jewelry'); renderCart();
    } catch (error) {
      document.querySelectorAll('.product-grid').forEach(el => { el.innerHTML = `<div class="empty">${esc(error.message || 'Could not load the collections.')}</div>`; });
    }
  }
  function subscribeToProducts() {
    if (!sb.channel || productsChannel) return;
    productsChannel = sb.channel('storefront-products-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => load()).subscribe();
  }
  load().finally(subscribeToProducts);
})();
