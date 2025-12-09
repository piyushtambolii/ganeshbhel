/* Google Apps Script API URL - USER MUST REPLACE THIS */
// DEPLOY YOUR CODE.GS AS WEB APP AND PASTE URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbwtF2t6pkIpOdwg1IwREsyUb76vxJ9cU0RoCMwQydo-d4GNeCdDIY5bzfKHSbdRIlz2/exec';

// App State
const state = {
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
        // Set date
        const dateEl = document.getElementById('bill-date');
        if(dateEl) dateEl.textContent = new Date().toLocaleDateString();
    },

    checkLogin() {
        // Simple mock login check
        const user = localStorage.getItem('ganesh_user');
        if (user) {
            state.user = JSON.parse(user);
            this.showMain();
        } else {
            const ls = document.getElementById('login-screen');
            if (ls) ls.classList.remove('hidden');
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
        if (logoutBtn) logoutBtn.addEventListener('click', () => { 
            localStorage.removeItem('ganesh_user'); 
            window.location.reload(); 
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => { 
                e.preventDefault(); 
                this.navTo(item.dataset.target); 
            });
        });

        // POS Search
        const posSearch = document.getElementById('pos-search');
        if (posSearch) {
            posSearch.addEventListener('input', (e) => {
                this.renderMenu(e.target.value.trim());
            });
        }
        
        // Category Filter
        const catContainer = document.getElementById('category-filters');
        if(catContainer) {
            catContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if(btn) {
                    document.querySelectorAll('#category-filters button').forEach(b => {
                        b.classList.remove('bg-orange-600', 'text-white');
                        b.classList.add('bg-gray-100', 'text-gray-600');
                    });
                    btn.classList.remove('bg-gray-100', 'text-gray-600');
                    btn.classList.add('bg-orange-600', 'text-white');
                    this.renderMenu(document.getElementById('pos-search')?.value || '', btn.dataset.cat);
                }
            });
        }

        // Create Invoice
        const createBtn = document.getElementById('create-invoice-btn');
        if (createBtn) createBtn.addEventListener('click', () => {
             if (state.currentBill.length === 0) return alert('Bill is empty');
             
             const total = state.currentBill.reduce((s, it) => s + (it.price * it.qty), 0);
             const custInput = document.getElementById('cust-name-opt');
             const customer = custInput && custInput.value ? custInput.value : 'Walk-in';
             const billNo = 'BILL' + Math.floor(Math.random() * 100000);
             
             const invoiceData = {
                 action: 'createInvoice',
                 id: billNo,
                 total: total,
                 customerName: customer,
                 items: JSON.stringify(state.currentBill), // Backend expects stringified JSON
             };

             // 1. Direct Print
             this.handlePrint(state.currentBill, { id: billNo, total, customer, date: new Date() });
             
                 // 2. Send to Backend
                 this.apiCall(invoiceData).then(res => {
                     console.log('Saved to Sheet', res);
                     // After save, clear bill and reset for next customer
                     state.currentBill = [];
                     this.renderBill();
                     if(custInput) custInput.value = '';
                     // Focus on billing section for next customer
                     this.navTo('billing');
                     // Optionally, focus the search box for speed
                     setTimeout(() => {
                         document.getElementById('pos-search')?.focus();
                     }, 200);
                 }).catch(err => {
                     console.error('Save failed', err);
                     alert('Failed to save invoice. Please try again.');
                 });
        });
    },

    showMain() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('user-display').textContent = state.user ? state.user.name : 'Staff';
        this.loadData();
    },

    navTo(targetId) {
        // Update Nav State
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.remove('active', 'text-orange-600', 'bg-orange-50');
            if(n.dataset.target === targetId) n.classList.add('active', 'text-orange-600', 'bg-orange-50');
        });

        // Update Section Visibility
        document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${targetId}-section`)?.classList.remove('hidden');
        
        // Update Title
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);
    },

    async loadData() {
        if (API_URL.includes('REPLACE')) { 
            console.warn('Using Mock Data. Configure API_URL in script.js'); 
            this.mockData(); 
            return; 
        }

        try {
            // Fetch History (GET)
            const res = await fetch(`${API_URL}?action=getHistory`);
            const data = await res.json();
            state.history = Array.isArray(data) ? data : [];
            
            // Still verify dishes from mock or fetching
            this.mockData(true); // Populate dishes locally for now
            this.renderHistory();
        } catch (e) {
            console.error('Data load error', e);
            this.mockData();
        }
    },
    
    // Send data to GAS (POST)
    async apiCall(data) {
        if (API_URL.includes('REPLACE')) return Promise.resolve({ status: 'mock_success' });
        
        // Use FormData for POST to GAS
        const formData = new FormData();
        for (const k in data) {
            formData.append(k, data[k]);
        }
        
        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    },

    mockData(onlyDishes = false) {
        state.dishes = [
            { code: '101', name: 'Bhel Puri', price: 60, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
            { code: '102', name: 'Sev Puri', price: 70, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
            { code: '103', name: 'Pani Puri', price: 40, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/706/706195.png' },
            { code: '104', name: 'Dahi Puri', price: 80, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
            { code: '105', name: 'Samosa Chaat', price: 90, type: 'Hot', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014520.png' },
            { code: '106', name: 'Vada Pav', price: 25, type: 'Hot', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046857.png' },
            { code: '201', name: 'Masala Chai', price: 20, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/751/751621.png' },
            { code: '202', name: 'Cold Coffee', price: 50, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/924/924514.png' },
            { code: '203', name: 'Lassi', price: 60, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png' }
        ];
        
        if (!onlyDishes) {
            state.history = [{ id: 'MOCK1', date: new Date().toISOString(), total: 120, customer: 'Test' }];
        }
        
        this.renderUI();
    },

    renderUI() {
        // Render Dashboard Stats
        document.getElementById('dash-dishes-count').textContent = state.dishes.length;
        // Render Sales (Mock logic)
        const sales = state.history.reduce((acc, curr) => acc + (parseFloat(curr.total)||0), 0);
        document.getElementById('dash-sales-total').textContent = sales;
        
        // Render Categories
        const cats = ['All', ...new Set(state.dishes.map(d => d.type))];
        const catContainer = document.getElementById('category-filters');
        if(catContainer) {
            catContainer.innerHTML = cats.map((c, i) => `
                <button data-cat="${c}" class="${i===0 ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'} px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition hover:bg-orange-500 hover:text-white">
                    ${c}
                </button>
            `).join('');
        }

        this.renderMenu();
        this.renderHistory();
    },

    renderMenu(search = '', activeCat = null) {
        if (!activeCat) {
            // Find active cat from DOM if not passed (fallback)
             const btn = document.querySelector('#category-filters button.bg-orange-600');
             activeCat = btn ? btn.dataset.cat : 'All';
        }

        let filtered = state.dishes;
        if (activeCat !== 'All') filtered = filtered.filter(d => d.type === activeCat);
        if (search) filtered = filtered.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.includes(search));

        const grid = document.getElementById('billing-menu-grid');
        grid.innerHTML = filtered.map(d => `
            <div onclick="app.addToBill('${d.code}')" class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-orange-200 transition group relative overflow-hidden">
                <div class="h-24 mb-2 overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                    <img src="${d.image}" class="h-16 w-16 object-contain group-hover:scale-110 transition duration-300">
                </div>
                <div>
                   <h4 class="font-bold text-gray-800 text-sm truncate">${d.name}</h4>
                   <div class="flex justify-between items-center mt-1">
                       <span class="text-xs text-gray-400">#${d.code}</span>
                       <span class="text-orange-600 font-bold">₹${d.price}</span>
                   </div>
                </div>
                <div class="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <ion-icon name="add" class="text-3xl text-orange-600 bg-white rounded-full p-1 shadow-sm"></ion-icon>
                </div>
            </div>
        `).join('');
    },
    
    addToBill(code) {
        const dish = state.dishes.find(d => d.code === code);
        if(!dish) return;
        
        const existing = state.currentBill.find(i => i.code === code);
        if(existing) existing.qty++;
        else state.currentBill.push({...dish, qty: 1});
        
        this.renderBill();
    },
    
    renderBill() {
        const container = document.getElementById('current-bill-items');
        if (state.currentBill.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 mt-10">
                    <ion-icon name="cart-outline" class="text-4xl mb-2 text-gray-300"></ion-icon>
                    <p class="text-sm">Order is empty</p>
                </div>`;
            document.getElementById('bill-total-amount').textContent = '₹0';
            return;
        }

        let total = 0;
        container.innerHTML = state.currentBill.map((item, index) => {
            const itemTotal = item.price * item.qty;
            total += itemTotal;
            return `
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <div>
                        <div class="font-bold text-sm text-gray-800">${item.name}</div>
                        <div class="text-xs text-gray-400">₹${item.price} x ${item.qty}</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-orange-600">₹${itemTotal}</div>
                        <button onclick="app.removeFromBill(${index})" class="text-red-400 text-xs hover:text-red-600">Remove</button>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('bill-total-amount').textContent = '₹' + total;
    },

    removeFromBill(index) {
        state.currentBill.splice(index, 1);
        this.renderBill();
    },

    renderHistory() {
        const list = document.getElementById('invoice-list');
        if(!list) return;
        list.innerHTML = state.history.map(h => `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <div class="font-bold text-gray-800">Bill #${h.id}</div>
                    <div class="text-xs text-gray-400">${new Date(h.date).toLocaleDateString()}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-lg text-green-600">₹${h.total}</div>
                    <div class="text-xs text-gray-500">${h.customer || 'Walk-in'}</div>
                </div>
            </div>
        `).join('');
    },

    handlePrint(items, meta) {
        const printWindow = window.open('', '_blank');
        const style = `
            body { font-family: monospace; padding: 20px; text-align: center; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 5px 0; }
            .total { font-weight: bold; font-size: 1.2em; border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; }
        `;
        const itemRows = items.map(i => `
            <div class="row">
                <span>${i.qty} x ${i.name}</span>
                <span>${i.qty * i.price}</span>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
            <head><style>${style}</style></head>
            <body>
                <h3>GANESH BHEL</h3>
                <p>${meta.date.toLocaleString()}</p>
                <div style="text-align:left; margin-top:20px;">
                    ${itemRows}
                </div>
                <div class="row total">
                    <span>TOTAL</span>
                    <span>₹${meta.total}</span>
                </div>
                <p style="margin-top:20px;">Thank You!</p>
                <script>window.print(); window.close();<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

// --- Items CRUD Logic ---
app.renderItems = function() {
    const list = document.getElementById('items-list');
    if (!list) return;
    if (state.dishes.length === 0) {
        list.innerHTML = '<div class="text-gray-400">No items found.</div>';
        return;
    }
    list.innerHTML = state.dishes.map((item, idx) => `
        <div class="bg-white p-3 rounded-xl shadow flex justify-between items-center">
            <div>
                <div class="font-bold text-gray-800">${item.name}</div>
                <div class="text-xs text-gray-400">Code: ${item.code} | ₹${item.price} | ${item.type}</div>
            </div>
            <div class="flex gap-2">
                <button class="text-blue-600 hover:underline" onclick="app.editItem(${idx})">Edit</button>
                <button class="text-red-600 hover:underline" onclick="app.deleteItem(${idx})">Delete</button>
            </div>
        </div>
    `).join('');
};

app.addItem = function(item) {
    state.dishes.push(item);
    this.renderItems();
    this.renderUI();
};

app.editItem = function(idx) {
    const item = state.dishes[idx];
    document.getElementById('item-id').value = idx;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-code').value = item.code;
    document.getElementById('item-price').value = item.price;
    document.getElementById('item-type').value = item.type;
    document.getElementById('item-image').value = item.image || '';
};

app.deleteItem = function(idx) {
    if (confirm('Delete this item?')) {
        state.dishes.splice(idx, 1);
        this.renderItems();
        this.renderUI();
    }
};

app.saveItem = function(e) {
    e.preventDefault();
    const idx = document.getElementById('item-id').value;
    const item = {
        name: document.getElementById('item-name').value,
        code: document.getElementById('item-code').value,
        price: parseFloat(document.getElementById('item-price').value),
        type: document.getElementById('item-type').value,
        image: document.getElementById('item-image').value
    };
    if (idx === '') {
        this.addItem(item);
    } else {
        state.dishes[idx] = item;
        this.renderItems();
        this.renderUI();
    }
    document.getElementById('item-form').reset();
    document.getElementById('item-id').value = '';
};

app.cancelItemEdit = function() {
    document.getElementById('item-form').reset();
    document.getElementById('item-id').value = '';
};

// Bind item form events after DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('item-form');
    if (form) form.addEventListener('submit', (e) => app.saveItem(e));
    const cancelBtn = document.getElementById('item-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => app.cancelItemEdit());
    app.renderItems();
});
