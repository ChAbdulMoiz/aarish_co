(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
  let orders = [], products = [], settings = {}, orderFilter = 'all', editingBrand = 'clothing', productsChannel = null;
  const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const client = () => { if (!window.sb) throw Error('Configure Supabase URL and publishable key in js/config.js first.'); };
  const toast = message => { $('toast').textContent = message; $('toast').classList.remove('hidden'); setTimeout(() => $('toast').classList.add('hidden'), 2200); };
  const note = message => $('message').textContent = message || '';
  async function session() { client(); const { data } = await sb.auth.getSession(); $('loginScreen').classList.toggle('hidden', !!data.session); $('dashboard').classList.toggle('hidden', !data.session); if (data.session) { await load(); subscribeToProducts(); } }
  $('loginForm').onsubmit = async event => { event.preventDefault(); $('loginError').textContent = ''; $('loginButton').disabled = true; try { client(); const form = new FormData(event.currentTarget); const { error } = await sb.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') }); if (error) throw error; await session(); } catch (error) { $('loginError').textContent = error.message; } finally { $('loginButton').disabled = false; } };
  $('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  function show(view) { document.querySelectorAll('.view').forEach(el => el.classList.toggle('hidden', el.id !== view)); document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view)); $('pageTitle').textContent = ({ overview: 'Overview', orders: 'Orders', products: 'Products', inventory: 'Inventory', settings: 'Store settings' })[view]; location.hash = view; if (view === 'inventory' && sb.auth?.getSession) load(); }
  document.querySelectorAll('[data-view]').forEach(link => link.onclick = event => { event.preventDefault(); show(link.dataset.view); });
  document.querySelectorAll('[data-jump]').forEach(button => button.onclick = () => show(button.dataset.jump));
  function orderCard(order) { const items = order.order_items || []; return `<article class="order"><div class="orderhead"><div><h3>Order #${esc(order.order_number)} · ${esc(order.customer_name)}</h3><div class="notice">${new Date(order.created_at).toLocaleString()}</div></div><span class="status">${esc(order.status)}</span></div><p>☎ ${esc(order.customer_phone)} · ${esc(order.customer_email || 'No email')}<br>⌖ ${esc(order.delivery_address)}</p><div class="orderitems">${items.map(item => `${esc(item.quantity)} × ${esc(item.product_name)} <small>(${esc(item.brand)})</small> — ${money(item.line_total)}`).join('<br>')}</div><div class="orderfoot"><b>${money(order.total)}</b><select data-status="${order.id}">${statuses.map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div></article>`; }
  function render() {
    const sales = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total || 0), 0);
    const lineSales = brand => orders.filter(o => o.status !== 'cancelled').flatMap(o => o.order_items || []).filter(i => i.brand === brand).reduce((sum, i) => sum + Number(i.line_total || 0), 0);
    $('sOrders').textContent = orders.length; $('sSales').textContent = money(sales); $('sPending').textContent = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length; $('sProducts').textContent = products.length; $('sClothing').textContent = money(lineSales('clothing')); $('sJewelry').textContent = money(lineSales('jewelry')); $('sDelivered').textContent = orders.filter(o => o.status === 'delivered').length; $('sLow').textContent = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 3).length;
    $('recent').innerHTML = orders.slice(0, 4).map(orderCard).join('') || '<div class="empty">No orders yet.</div>'; renderOrders(); renderProducts(); renderInventory();
    Object.keys(settings).forEach(key => { if ($('settingsForm').elements[key]) $('settingsForm').elements[key].value = settings[key] ?? ''; });
  }
  function renderOrders() {
    let rows = orders;
    if (orderFilter === 'clothing' || orderFilter === 'jewelry') rows = rows.filter(o => (o.order_items || []).some(item => item.brand === orderFilter));
    if (orderFilter === 'pending') rows = rows.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status));
    if (orderFilter === 'delivered') rows = rows.filter(o => o.status === 'delivered');
    $('ordersList').innerHTML = rows.map(orderCard).join('') || '<div class="empty">No orders in this view.</div>';
    document.querySelectorAll('[data-status]').forEach(select => select.onchange = async () => { select.disabled = true; try { const { error } = await sb.from('orders').update({ status: select.value, updated_at: new Date().toISOString() }).eq('id', select.dataset.status); if (error) throw error; toast('Order status updated'); await load(); } catch (error) { toast(error.message); select.disabled = false; } });
  }
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { orderFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(el => el.classList.toggle('active', el === button)); renderOrders(); });
  function renderProducts() {
    $('productRows').innerHTML = products.map(product => `<tr><td><div class="product-cell"><img class="thumb" src="${esc(product.image_url || '')}" alt=""><b>${esc(product.name)}</b></div></td><td>${product.brand === 'jewelry' ? 'Aarish Jewelry' : 'Aarish Co.'}</td><td>${esc(product.category)}</td><td>${money(product.sale_price ?? product.price)}</td><td>${product.stock_quantity ?? 0}</td><td><button class="action" data-edit="${product.id}">Edit</button>${product.available ? `<button class="action" data-archive="${product.id}">Archive</button>` : `<button class="action" data-restore="${product.id}">Restore</button>`}<button class="action danger" data-delete="${product.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No products yet.</td></tr>';
    document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editProduct(button.dataset.edit));
    document.querySelectorAll('[data-archive]').forEach(button => button.onclick = () => archiveProduct(button.dataset.archive));
    document.querySelectorAll('[data-restore]').forEach(button => button.onclick = () => restoreProduct(button.dataset.restore));
    document.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => permanentlyDeleteProduct(button.dataset.delete));
  }
  function inventoryRow(p) { return `<tr><td><b>${esc(p.name)}</b></td><td>${p.brand === 'jewelry' ? 'Aarish Jewelry' : 'Aarish Co.'}</td><td>${p.stock_quantity ?? 0}</td><td>${p.available ? 'Available' : 'Hidden'}</td></tr>`; }
  function renderInventory() {
    const active = products.filter(p => p.available === true);
    const archived = products.filter(p => p.available === false);
    $('inventoryRows').innerHTML = active.map(inventoryRow).join('') || '<tr><td colspan="4">No active inventory.</td></tr>';
    $('archivedInventoryRows').innerHTML = archived.map(inventoryRow).join('') || '<tr><td colspan="4">No archived products.</td></tr>';
  }
  function openProduct(brand, product = null) {
    editingBrand = brand; const form = $('productForm'); form.reset(); form.elements.id.value = product?.id || ''; form.elements.brand.value = brand; form.elements.available.checked = product ? product.available : true; form.elements.featured.checked = product?.featured || false;
    if (product) ['name', 'description', 'category', 'price', 'sale_price', 'stock_quantity', 'image_url', 'material', 'dimensions'].forEach(key => { if (form.elements[key]) form.elements[key].value = product[key] ?? ''; });
    form.elements.sizes.value = Array.isArray(product?.sizes) ? product.sizes.join(', ') : ''; form.elements.color.value = product?.color || ''; form.elements.jewelry_color.value = product?.color || '';
    $('productBrandLabel').textContent = brand === 'jewelry' ? 'Aarish Jewelry' : 'Aarish Co.'; $('productModalTitle').textContent = product ? 'Edit product' : brand === 'jewelry' ? 'Add jewelry product' : 'Add clothing product'; $('productError').textContent = ''; $('clothingFields').classList.toggle('hidden', brand !== 'clothing'); $('jewelryFields').classList.toggle('hidden', brand !== 'jewelry'); $('productModal').classList.add('open');
  }
  document.querySelectorAll('[data-new-product]').forEach(button => button.onclick = () => openProduct(button.dataset.newProduct));
  function editProduct(id) { const product = products.find(item => item.id === id); if (product) openProduct(product.brand, product); }
  async function archiveProduct(id) { const product = products.find(item => item.id === id); if (!product || !confirm(`Archive ${product.name}?`)) return; const { error } = await sb.from('products').update({ available: false, updated_at: new Date().toISOString() }).eq('id', id); if (error) return toast(error.message); toast('Product archived'); await load(); }
  async function restoreProduct(id) { const product = products.find(item => item.id === id); if (!product) return; const { error } = await sb.from('products').update({ available: true, updated_at: new Date().toISOString() }).eq('id', id); if (error) return toast(error.message); toast('Product restored'); await load(); }
  async function permanentlyDeleteProduct(id) {
    const product = products.find(item => item.id === id);
    if (!product || !confirm(`Permanently delete ${product.name}? This cannot be undone.`)) return;
    try {
      const oldImages = await sb.from('product_images').select('storage_path').eq('product_id', id);
      if (oldImages.error) throw oldImages.error;
      if (oldImages.data?.length) {
        const removedFiles = await sb.storage.from('product-images').remove(oldImages.data.map(image => image.storage_path));
        if (removedFiles.error) throw removedFiles.error;
      }
      const removed = await sb.from('products').delete().eq('id', id).select('id').single();
      if (removed.error) throw removed.error;
      toast('Product permanently deleted');
      await load();
    } catch (error) { toast(error.message); }
  }
  $('modalClose').onclick = () => $('productModal').classList.remove('open'); $('productModal').onclick = event => { if (event.target === $('productModal')) $('productModal').classList.remove('open'); };
  $('productForm').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget, button = $('saveProduct'), error = $('productError'); button.disabled = true; error.textContent = 'Saving…';
    try {
      const data = new FormData(form); const files = [...form.elements.files.files]; if (files.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) throw Error('Each image must be JPG, PNG or WEBP and smaller than 5 MB.');
      const body = { brand: data.get('brand'), name: data.get('name'), description: data.get('description') || '', category: data.get('category'), price: Number(data.get('price')), sale_price: data.get('sale_price') ? Number(data.get('sale_price')) : null, stock_quantity: Number(data.get('stock_quantity')), image_url: data.get('image_url') || '', color: data.get('brand') === 'jewelry' ? data.get('jewelry_color') : data.get('color'), material: data.get('material') || '', dimensions: data.get('dimensions') || '', sizes: data.get('brand') === 'clothing' ? String(data.get('sizes') || '').split(',').map(s => s.trim()).filter(Boolean) : [], available: form.elements.available.checked, featured: form.elements.featured.checked, updated_at: new Date().toISOString() };
      const uploadedPaths = [];
      for (const file of files) { const path = `${body.brand}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const upload = await sb.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type }); if (upload.error) throw upload.error; uploadedPaths.push(path); if (!body.image_url) body.image_url = sb.storage.from('product-images').getPublicUrl(path).data.publicUrl; }
      const result = form.elements.id.value ? await sb.from('products').update(body).eq('id', form.elements.id.value).select('id').single() : await sb.from('products').insert(body).select('id').single(); if (result.error) throw result.error;
      if (form.elements.id.value && uploadedPaths.length) { const oldImages = await sb.from('product_images').select('storage_path').eq('product_id', result.data.id); if (oldImages.error) throw oldImages.error; if (oldImages.data?.length) { const removedFiles = await sb.storage.from('product-images').remove(oldImages.data.map(image => image.storage_path)); if (removedFiles.error) throw removedFiles.error; } const removedRows = await sb.from('product_images').delete().eq('product_id', result.data.id); if (removedRows.error) throw removedRows.error; }
      if (uploadedPaths.length) { const imageRows = uploadedPaths.map((storage_path, sort_order) => ({ product_id: result.data.id, storage_path, sort_order })); const images = await sb.from('product_images').insert(imageRows); if (images.error) throw images.error; }
      $('productModal').classList.remove('open'); toast('Product saved'); await load();
    } catch (ex) { error.textContent = ex.message; } finally { button.disabled = false; }
  };
  $('settingsForm').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.currentTarget); const { error } = await sb.from('store_settings').upsert({ id: 1, store_name: data.get('store_name'), tagline: data.get('tagline'), owner_email: data.get('owner_email'), phone: data.get('phone'), address: data.get('address'), delivery_fee: Number(data.get('delivery_fee')) }); if (error) return note(error.message); toast('Settings saved'); await load(); };
  async function load() { try { note('Loading workspace…'); const [ordersResult, productsResult, settingsResult] = await Promise.all([sb.from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(200), sb.from('products').select('*').order('created_at', { ascending: false }), sb.from('store_settings').select('*').eq('id', 1).single()]); for (const result of [ordersResult, productsResult, settingsResult]) if (result.error) throw result.error; orders = ordersResult.data || []; products = productsResult.data || []; settings = settingsResult.data || {}; render(); note(''); } catch (error) { note(error.message || 'Could not load dashboard.'); } }
  function subscribeToProducts() {
    if (!sb.channel || productsChannel) return;
    productsChannel = sb.channel('owner-products-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => load()).subscribe();
  }
  $('refresh').onclick = load;
  window.onhashchange = () => { const view = location.hash.slice(1); if (['overview', 'orders', 'products', 'inventory', 'settings'].includes(view)) show(view); };
  const initial = location.hash.slice(1); if (['overview', 'orders', 'products', 'inventory', 'settings'].includes(initial)) show(initial); session();
})();
