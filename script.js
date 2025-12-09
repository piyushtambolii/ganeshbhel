/* Google Apps Script API URL - USER MUST REPLACE THIS */
// Placeholder - User needs to deploy GAS and update this
const API_URL = 'REPLACE_WITH_YOUR_DEPLOYED_WEB_APP_URL';

// App State
const state = {
    inventory: [],
    dishes: [],
    history: [],
    currentBill: [],
    user: null,
    tempInvoice: null
};

// Main app object
const app = {
    init() {
        this.checkLogin();
        this.bindEvents();
        this.registerSW();
    },

    registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('SW Registered'))
                .catch(err => console.warn('SW Error', err));
        }
    },

    checkLogin() {
        const user = localStorage.getItem('ganesh_user');
        if (user) {
            state.user = JSON.parse(user);
            this.showMain();
        } else {
            const ls = document.getElementById('login-screen');
            const ml = document.getElementById('main-layout');
            if (ls) ls.classList.add('active');
            if (ml) ml.classList.add('hidden');
        }
    },

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email')?.value;
                const password = document.getElementById('password')?.value;
                if (email === 'franchise1@shop.com' && password === 'fran123') {
                    const user = { email, name: 'Franchise 1' };
                    localStorage.setItem('ganesh_user', JSON.stringify(user));
                    state.user = user;
                    this.showMain();
                } else {
                    alert('Invalid Credentials');
                }
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('ganesh_user'); window.location.reload(); });

        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => { e.preventDefault(); this.navTo(item.dataset.target); }));

        const invForm = document.getElementById('inventory-form');
        if (invForm) {
            invForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const item = {
                    action: 'addInventory',
                    name: document.getElementById('inv-name')?.value,
                    qty: document.getElementById('inv-qty')?.value,
                    unit: document.getElementById('inv-unit')?.value,
                    cost: document.getElementById('inv-cost')?.value,
                    price: document.getElementById('inv-price')?.value
                };
                this.apiCall(item).then(() => { alert('Stock Added!'); this.loadData(); e.target.reset(); }).catch(() => { alert('Add failed'); });
            });
        }

        const addIngBtn = document.getElementById('add-ingredient-btn');
        if (addIngBtn) addIngBtn.addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'ingredient-row';
            div.innerHTML = `
                <select class="inv-select" required>${this.getInvOptions()}</select>
                <input type="number" class="ing-qty" placeholder="Qty" step="0.01" required>
            `;
            document.getElementById('ingredients-inputs')?.appendChild(div);
        });

        const dishForm = document.getElementById('dish-form');
        if (dishForm) dishForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const dish = {
                action: 'addDish',
                name: document.getElementById('dish-name')?.value,
                code: document.getElementById('dish-code')?.value,
                price: parseFloat(document.getElementById('dish-price')?.value) || 0,
                type: document.getElementById('dish-type')?.value,
                subtype: document.getElementById('dish-subtype')?.value
            };
            // If code exists in local state, treat as update in mock mode
            const existingIdx = state.dishes.findIndex(d => d.code === dish.code);
            if (API_URL.includes('REPLACE')) {
                if (existingIdx > -1) {
                    state.dishes[existingIdx] = { ...state.dishes[existingIdx], ...dish };
                    alert('Dish updated (mock)');
                    this.renderUI();
                    e.target.reset();
                } else {
                    state.dishes.push(dish);
                    alert('Dish added (mock)');
                    this.renderUI();
                    e.target.reset();
                }
                return;
            }

            // For real API, send add or update action (backend must support)
            const actionName = existingIdx > -1 ? 'updateDish' : 'addDish';
            dish.action = actionName;
            this.apiCall(dish).then(() => {
                alert(existingIdx > -1 ? 'Dish updated' : 'Dish added');
                this.loadData();
                e.target.reset();
            }).catch(() => { alert('Add/update dish failed'); });
        });

        // Invoice modal actions
        const modal = document.getElementById('invoice-modal');
        const modalClose = document.getElementById('modal-close-btn');
        if (modalClose) modalClose.addEventListener('click', () => modal?.classList.remove('active'));

        const createBtn = document.getElementById('create-invoice-btn');
        if (createBtn) createBtn.addEventListener('click', () => {
            if (state.currentBill.length === 0) return alert('Bill is empty');
            const total = state.currentBill.reduce((s, it) => s + (it.price * it.qty), 0);
            const dateStr = new Date().toLocaleDateString();
            const custInput = document.getElementById('cust-name-opt');
            const customer = custInput && custInput.value ? custInput.value : 'Walk-in';
            const billNo = 'BILL' + Math.floor(Math.random() * 100000);
            document.getElementById('modal-date') && (document.getElementById('modal-date').textContent = dateStr);
            document.getElementById('modal-bill-no') && (document.getElementById('modal-bill-no').textContent = billNo);
            document.getElementById('modal-customer') && (document.getElementById('modal-customer').textContent = customer);
            document.getElementById('modal-total') && (document.getElementById('modal-total').textContent = `₹${total}`);
            modal?.classList.add('active');
            state.tempInvoice = { total, customer, billNo, items: JSON.parse(JSON.stringify(state.currentBill)), date: new Date().toISOString() };
        });

        document.getElementById('modal-print-thermal-btn')?.addEventListener('click', () => this.handlePrint('thermal'));
        document.getElementById('modal-print-a4-btn')?.addEventListener('click', () => this.handlePrint('a4'));

        // POS Search (by name, code, type)
        const posSearch = document.getElementById('pos-search');
        if (posSearch) {
            posSearch.addEventListener('input', (e) => {
                const v = e.target.value || '';
                this.renderMenu(v.trim());
            });
            posSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        }

        // Category / Subcategory clicks (delegated)
        document.addEventListener('click', (ev) => {
            const target = ev.target.closest && ev.target.closest('.cat-tab');
            if (target) {
                document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                target.classList.add('active');
                // re-render subcategories and menu
                this.renderSubcategories();
                this.renderMenu(document.getElementById('pos-search')?.value || '');
            }
            const st = ev.target.closest && ev.target.closest('.subcat-tab');
            if (st) {
                document.querySelectorAll('.subcat-tab').forEach(t => t.classList.remove('active'));
                st.classList.add('active');
                this.renderMenu(document.getElementById('pos-search')?.value || '');
            }
            const del = ev.target.closest && ev.target.closest('.delete-btn');
            if (del && del.dataset && del.dataset.code) {
                const code = del.dataset.code;
                if (confirm('Delete item ' + code + ' ?')) this.deleteDish(code);
            }
        });
    },

    handlePrint(type) {
        if (!state.tempInvoice) return alert('No invoice data');
        this.printInvoice(state.tempInvoice.items, {
            total: state.tempInvoice.total,
            customer: state.tempInvoice.customer,
            id: state.tempInvoice.billNo,
            date: state.tempInvoice.date
        }, type);

        const invoice = {
            action: 'createInvoice',
            id: state.tempInvoice.billNo,
            total: state.tempInvoice.total,
            customerName: state.tempInvoice.customer,
            items: JSON.stringify(state.tempInvoice.items),
            date: state.tempInvoice.date
        };
        this.apiCall(invoice).then(() => {
            state.currentBill = [];
            this.renderBill();
            this.loadData();
            document.getElementById('invoice-modal')?.classList.remove('active');
            const custInput = document.getElementById('cust-name-opt'); if (custInput) custInput.value = '';
        }).catch(() => { /* ignore in mock mode */ });
    },

    navTo(targetId) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${targetId}-section`)?.classList.add('active');
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);
    },

    showMain() {
        document.getElementById('login-screen')?.classList.remove('active');
        document.getElementById('main-layout')?.classList.remove('hidden');
        this.loadData();
    },

    async loadData() {
        if (API_URL.includes('REPLACE')) { console.warn('API URL not set. Using mock data.'); this.mockData(); return; }
        try {
            const [inv, dishes, hist] = await Promise.all([
                this.apiCall({ action: 'getInventory' }),
                this.apiCall({ action: 'getDishes' }),
                this.apiCall({ action: 'getHistory' })
            ]);
            state.inventory = inv || [];
            state.dishes = dishes || [];
            state.history = hist || [];
            this.renderUI();
        } catch (e) { console.error('Data load failed', e); }
    },

    async apiCall(data) {
        if (API_URL.includes('REPLACE')) return Promise.resolve(null);
        const params = new URLSearchParams(data);
        const res = await fetch(`${API_URL}?${params.toString()}`);
        return await res.json();
    },

    renderUI() {
        document.getElementById('dash-dishes-count') && (document.getElementById('dash-dishes-count').textContent = state.dishes.length);
        document.getElementById('dash-stock-count') && (document.getElementById('dash-stock-count').textContent = state.inventory.length);
        if (document.getElementById('dash-bills-count')) {
            const todayCount = state.history.filter(h => { const d = new Date(h.date); const now = new Date(); return d.getDate() === now.getDate() && d.getMonth() === now.getMonth(); }).length;
            document.getElementById('dash-bills-count').textContent = todayCount;
        }

        const invList = document.getElementById('inventory-list');
        if (invList) invList.innerHTML = state.inventory.map(i => `
            <div class="list-item">
                <div>
                    <div class="list-item-title">${i.name}</div>
                    <div class="list-item-subtitle">${i.qty} ${i.unit} available</div>
                </div>
            </div>
        `).join('');

        const dishList = document.getElementById('dishes-list');
        if (dishList) dishList.innerHTML = state.dishes.map(d => `
            <div class="list-item">
                <div>
                    <div class="list-item-title">${d.name} (${d.code || 'N/A'})</div>
                    <div class="list-item-subtitle">${d.type || ''} - ${d.subtype || ''}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="list-item-price">₹${d.price}</div>
                    <button class="edit-btn" onclick="app.editDish('${d.code}')" style="padding:6px 8px;">Edit</button>
                    <button class="delete-btn" data-code="${d.code}" style="padding:6px 8px; background:#e74c3c; color:#fff; border:none; border-radius:6px; cursor:pointer;">Delete</button>
                </div>
            </div>
        `).join('');

        const categories = ['All', ...new Set(state.dishes.map(d => d.type).filter(Boolean))];
        const catContainer = document.getElementById('category-filters');
        if (catContainer) catContainer.innerHTML = categories.map((c, i) => `<button class="cat-tab ${i===0?'active':''}" data-cat="${c}">${c}</button>`).join('');
        this.renderSubcategories();
        this.renderMenu(document.getElementById('pos-search')?.value || '');

        const histList = document.getElementById('invoice-list');
        if (histList) histList.innerHTML = state.history.map(h => `
            <div class="list-item">
                <div>
                    <div class="list-item-title">#${h.id ? h.id.substring(0,6) : 'N/A'} - ₹${h.total}</div>
                    <div class="list-item-subtitle">${new Date(h.date).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    },

    renderMenu(searchTerm = '') {
        let filtered = state.dishes.slice();
        const activeCat = document.querySelector('.cat-tab.active')?.dataset.cat || 'All';
        if (activeCat !== 'All') filtered = filtered.filter(d => d.type === activeCat);
        // If a subcategory is active, filter by it
        const activeSub = document.querySelector('.subcat-tab.active')?.dataset.sub || 'All';
        if (activeSub && activeSub !== 'All') filtered = filtered.filter(d => d.subtype === activeSub);
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(d => (d.name || '').toLowerCase().includes(lower) || (d.code || '').toLowerCase().includes(lower) || (d.type || '').toLowerCase().includes(lower));
        }
        const menuGrid = document.getElementById('billing-menu-grid');
        if (!menuGrid) return;
        menuGrid.innerHTML = filtered.map(d => `
            <div class="dish-card" onclick="app.addToBill('${(d.name||'').replace(/'/g, "\\'")}')">
                <div class="dish-info">
                    <div class="dish-title">${d.name}</div>
                    <div class="dish-price">#${d.code || ''} | ₹${d.price}</div>
                </div>
                <div class="add-overlay">
                    <ion-icon name="add-circle"></ion-icon>
                </div>
            </div>
        `).join('');
    },

    editDish(code) {
        const dish = state.dishes.find(d => d.code === code);
        if (!dish) return;
        this.navTo('dishes');
        document.getElementById('dish-name') && (document.getElementById('dish-name').value = dish.name);
        document.getElementById('dish-price') && (document.getElementById('dish-price').value = dish.price);
        document.getElementById('dish-code') && (document.getElementById('dish-code').value = dish.code);
        document.getElementById('dish-type') && (document.getElementById('dish-type').value = dish.type);
        document.getElementById('dish-subtype') && (document.getElementById('dish-subtype').value = dish.subtype);
        alert('Dish loaded into form. Modify and submit to save.');
    },

    deleteDish(code) {
        // Remove from local state (mock mode) or call API if available
        const idx = state.dishes.findIndex(d => d.code === code);
        if (idx === -1) return alert('Item not found');
        if (API_URL.includes('REPLACE')) {
            state.dishes.splice(idx, 1);
            this.renderUI();
            return;
        }
        // If real API exists, send delete request (backend handler required)
        this.apiCall({ action: 'deleteDish', code }).then(() => this.loadData()).catch(() => alert('Delete failed'));
    },

    getInvOptions() {
        return '<option value="">Select Ingredient</option>' + state.inventory.map(i => `<option value="${i.name}">${i.name} (${i.unit})</option>`).join('');
    },

    renderBill() {
        const list = document.getElementById('current-bill-items');
        if (!list) return;
        if (state.currentBill.length === 0) {
            list.innerHTML = '<p class="empty-msg">No items added.</p>';
            document.getElementById('bill-total-amount') && (document.getElementById('bill-total-amount').textContent = '₹0');
            return;
        }
        let total = 0;
        list.innerHTML = state.currentBill.map(item => {
            const itemTotal = item.price * item.qty;
            total += itemTotal;
            return `
                <div class="bill-item">
                    <span>${item.name} x ${item.qty}</span>
                    <span>₹${itemTotal}</span>
                </div>
            `;
        }).join('');
        document.getElementById('bill-total-amount') && (document.getElementById('bill-total-amount').textContent = `₹${total}`);
    },

    printInvoice(billItems, metaData = {}, type = 'a4') {
        const total = metaData.total || billItems.reduce((s, i) => s + (i.price * i.qty), 0);
        const dateStr = metaData.date ? new Date(metaData.date).toLocaleDateString() : new Date().toLocaleDateString();
        const customer = metaData.customer || 'Walk-in';
        const billNo = metaData.id || 'BILL000';
        const printWindow = window.open('', '', 'width=800,height=600');
        let style = '', content = '';
        if (type === 'thermal') {
            style = `body{font-family:monospace;padding:0;margin:0;width:72mm;font-size:12px}.header{text-align:center;font-weight:bold}.divider{border-top:1px dashed #000;margin:5px 0}.row{display:flex;justify-content:space-between}`;
            content = `<div class="header">GANESH BHEL</div><div class="divider"></div><div>Date: ${dateStr}</div><div>Bill: ${billNo}</div><div class="divider"></div>`;
            billItems.forEach(item => { content += `<div>${item.name}</div><div class="row"><span>${item.qty} x ${item.price}</span><span>₹${item.qty * item.price}</span></div>`; });
            content += `<div class="divider"></div><div class="row"><strong>TOTAL</strong><strong>₹${total}</strong></div>`;
        } else {
            style = `body{font-family:Arial;padding:20px}.header{text-align:center}.store-name{font-size:22px;font-weight:700}.meta-row{display:flex;justify-content:space-between}.right{text-align:right}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #eee}`;
            content = `<div class="header"><div class="store-name">Franchise Store</div></div><div class="meta-row"><div><b>Bill No:</b> ${billNo}<br><b>Customer:</b> ${customer}</div><div class="right"><b>Date:</b> ${dateStr}</div></div><table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr></thead><tbody>`;
            billItems.forEach(item => content += `<tr><td>${item.name}</td><td class="right">${item.qty}</td><td class="right">₹${item.price}</td><td class="right">₹${item.qty * item.price}</td></tr>`);
            content += `</tbody></table><div style="display:flex;justify-content:space-between;font-weight:700">Grand Total<span>₹${total}</span></div>`;
        }
        printWindow.document.write(`<html><head><title>Invoice</title><style>${style}</style></head><body>${content}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script></body></html>`);
        printWindow.document.close();
    },

    printReceipt(billItems, metaData) { this.printInvoice(billItems, metaData, 'a4'); },

    addToBill(dishName) {
        const dish = state.dishes.find(d => d.name === dishName);
        if (!dish) return;
        const existing = state.currentBill.find(i => i.name === dishName);
        if (existing) existing.qty += 1; else state.currentBill.push({ ...dish, qty: 1 });
        this.renderBill();
    },

    mockData() {
        state.inventory = [ { name: 'Puffed Rice', qty: 10, unit: 'kg', cost: 50, price: 60 } ];
        state.dishes = [
            { code: '101', name: 'Bhel Puri', price: 50, type: 'Chaat', subtype: 'Dry' },
            { code: '102', name: 'Sev Puri', price: 60, type: 'Chaat', subtype: 'Dry' },
            { code: '201', name: 'Masala Chai', price: 20, type: 'Beverages', subtype: 'Hot' }
        ];
        this.renderUI();
    },

    // Render subcategories for active category
    renderSubcategories() {
        const activeCat = document.querySelector('.cat-tab.active')?.dataset.cat || 'All';
        const subContainer = document.getElementById('subcategory-filters');
        if (!subContainer) return;
        if (activeCat === 'All') {
            subContainer.innerHTML = '';
            return;
        }
        const subs = ['All', ...new Set(state.dishes.filter(d => d.type === activeCat).map(d => d.subtype).filter(Boolean))];
        subContainer.innerHTML = subs.map((s, i) => `<button class="subcat-tab ${i===0?'active':''}" data-sub="${s}">${s}</button>`).join('');
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

