/* Google Apps Script API URL - USER MUST REPLACE THIS */
// DEPLOY YOUR CODE.GS AS WEB APP AND PASTE URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbwtF2t6pkIpOdwg1IwREsyUb76vxJ9cU0RoCMwQydo-d4GNeCdDIY5bzfKHSbdRIlz2/exec';

// App State
const state = {
    dishes: [],
    history: [],
    dailySummaries: [],
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

             // 2. Save locally (persist immediately) so history is permanent even offline
             const invoiceObj = { id: billNo, date: new Date().toISOString(), total, customer, items: invoiceData.items };
             state.history.unshift(invoiceObj);
             this.persistInvoices();
             this.renderHistory();

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

            // 3. Optionally send to backend, but do not rely on it for local persistence
            if (!API_URL.includes('REPLACE')) {
                 this.apiCall(invoiceData).then(res => {
                     console.log('Saved to Sheet', res);
                 }).catch(err => {
                     console.warn('Remote save failed (invoice persisted locally)', err);
                 });
             }
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
        // Load local persistence first (invoices and daily summaries)
        try {
            const savedInv = localStorage.getItem('ganesh_invoices');
            if (savedInv) state.history = JSON.parse(savedInv);
        } catch (e) { state.history = state.history || []; }
        try {
            const savedDaily = localStorage.getItem('ganesh_daily_summaries');
            if (savedDaily) state.dailySummaries = JSON.parse(savedDaily);
        } catch (e) { state.dailySummaries = state.dailySummaries || []; }

        if (API_URL.includes('REPLACE')) {
            console.warn('Using Mock Data for dishes. Configure API_URL in script.js');
            this.mockData(true);
            return;
        }

        try {
            // Fetch remote history (optional) but do not overwrite local persistence
            const res = await fetch(`${API_URL}?action=getHistory`);
            const data = await res.json();
            // merge remote data into local history but keep local first (avoid duplicates)
            if (Array.isArray(data)) {
                const existingIds = new Set((state.history || []).map(h => h.id));
                data.forEach(d => { if (!existingIds.has(d.id)) state.history.unshift(d); });
            }

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
        // Load saved items first (persistent storage)
        const saved = localStorage.getItem('ganesh_items');
        if (saved) {
            try {
                state.dishes = JSON.parse(saved);
            } catch (e) {
                state.dishes = [];
            }
        }

        // If no saved items, fall back to some sensible mock items
        if (!state.dishes || state.dishes.length === 0) {
            state.dishes = [
                { code: '1', name: 'Bhel Puri', price: 60, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
                { code: '2', name: 'Sev Puri', price: 70, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
                { code: '3', name: 'Pani Puri', price: 40, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/706/706195.png' },
                { code: '4', name: 'Dahi Puri', price: 80, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png' },
                { code: '5', name: 'Samosa Chaat', price: 90, type: 'Hot', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014520.png' },
                { code: '6', name: 'Vada Pav', price: 25, type: 'Hot', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046857.png' },
                { code: '7', name: 'Masala Chai', price: 20, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/751/751621.png' },
                { code: '8', name: 'Cold Coffee', price: 50, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/924/924514.png' },
                { code: '9', name: 'Lassi', price: 60, type: 'Beverages', image: 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png' }
            ];
            // persist the initial mock so owner sees them persistently
            localStorage.setItem('ganesh_items', JSON.stringify(state.dishes));
        }
        
        if (!onlyDishes) {
            state.history = [{ id: 'MOCK1', date: new Date().toISOString(), total: 120, customer: 'Test' }];
        }
        
        this.renderUI();
    },

    // Utility: persist dishes to localStorage
    persistItems() {
        localStorage.setItem('ganesh_items', JSON.stringify(state.dishes));
    },

    // Utility: persist invoices (history)
    persistInvoices() {
        try { localStorage.setItem('ganesh_invoices', JSON.stringify(state.history)); } catch (e) { console.error('Persist invoices failed', e); }
    },

    // Utility: persist daily summaries
    persistDailySummaries() {
        try { localStorage.setItem('ganesh_daily_summaries', JSON.stringify(state.dailySummaries)); } catch (e) { console.error('Persist daily summaries failed', e); }
    },

    renderUI() {
        // Render Dashboard Stats
        document.getElementById('dash-dishes-count').textContent = state.dishes.length;
        // Render Sales (Mock logic)
        const sales = state.history.reduce((acc, curr) => acc + (parseFloat(curr.total)||0), 0);
        document.getElementById('dash-sales-total').textContent = sales;
        
        // Render Categories with small thumbnails (first item image for each category)
        const cats = ['All', ...new Set(state.dishes.map(d => d.type).filter(Boolean))];
        const catContainer = document.getElementById('category-filters');
        if(catContainer) {
            catContainer.innerHTML = cats.map((c, i) => {
                const thumb = c === 'All' ? '' : (state.dishes.find(d => d.type === c)?.image || '');
                return `
                <button data-cat="${c}" class="${i===0 ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'} px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition hover:bg-orange-500 hover:text-white flex items-center gap-2">
                    ${thumb ? `<img src="${thumb}" class="w-6 h-6 rounded-full object-cover border" alt="${c}"/>` : `<ion-icon name="grid-outline" class="text-lg"></ion-icon>`}
                    <span class="leading-none">${c}</span>
                </button>
            `}).join('');
        }
        this.renderMenu();
        this.renderHistory();
        // Ensure items list is always rendered in the Items section (main admin area)
        this.renderItems();
        // Refresh category pick-list and datalist used in the form
        this.refreshTypeOptions && this.refreshTypeOptions();
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

        // Render daily summaries first
        const summaries = (state.dailySummaries || []).slice().reverse(); // show recent first
        const summaryHtml = summaries.map(s => `
            <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-3">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold text-gray-800">${new Date(s.date).toLocaleDateString()}</div>
                        <div class="text-xs text-gray-500">${s.invoiceCount || 0} bills</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-lg text-green-600">₹${s.totalSales}</div>
                        <div class="text-xs text-gray-500">${s.totalDishes} dishes</div>
                    </div>
                </div>
            </div>
        `).join('');

        // Render all invoices (most recent first)
        const invoices = (state.history || []).slice().map(h => h).reverse();
        const invoicesHtml = invoices.map(h => `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center mb-2">
                <div>
                    <div class="font-bold text-gray-800">Bill #${h.id}</div>
                    <div class="text-xs text-gray-400">${new Date(h.date).toLocaleString()}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-lg text-green-600">₹${h.total}</div>
                    <div class="text-xs text-gray-500">${h.customer || 'Walk-in'}</div>
                </div>
            </div>
        `).join('');

        list.innerHTML = `
            <div class="mb-4"><h3 class="text-lg font-bold">Daily Summaries</h3>${summaryHtml || '<div class="text-sm text-gray-500">No daily summaries yet.</div>'}</div>
            <div class="mt-6"><h3 class="text-lg font-bold">All Bills</h3>${invoicesHtml || '<div class="text-sm text-gray-500">No bills yet.</div>'}</div>
        `;
    },

    handlePrint(items, meta) {


        const itemRows = items.map(i => `
            <div class="row row-item">
                <span>${i.qty} x ${i.name}</span>
                <span>₹${(i.qty * i.price).toFixed(2)}</span>
            </div>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="color-scheme" content="light">
                <title>Receipt - ${meta.id}</title>
                <style>
                    :root { color-scheme: light; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body { 
                        width: 100%;
                        background-color: #ffffff !important; 
                        color: #000000 !important; 
                        font-family: 'Courier New', monospace;
                    }
                    body { padding: 20px; text-align: center; }
                    .header { font-size: 1.6em; font-weight: bold; margin-bottom: 10px; color: #000000 !important; }
                    .date { font-size: 0.85em; color: #000000 !important; margin-bottom: 20px; border-bottom: 1px solid #000000; padding-bottom: 10px; }
                    .items { text-align: left; margin: 20px 0; }
                    .row { display: flex; justify-content: space-between; padding: 8px 0; color: #000000 !important; }
                    .row span { color: #000000 !important; }
                    .row-item { border-bottom: 1px dashed #333; }
                    .total { font-weight: bold; font-size: 1.1em; border-top: 2px solid #000000; margin-top: 15px; padding-top: 10px; color: #000000 !important; }
                    .footer { margin-top: 20px; font-size: 0.9em; color: #000000 !important; }
                    @media print { 
                        @page { margin: 0; }
                        body { padding: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        html, body {
                            background-color: #ffffff !important;
                            color: #000000 !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">GANESH BHEL</div>
                <div class="date">${meta.date.toLocaleString()}</div>
                <div class="items">${itemRows}</div>
                <div class="row total">
                    <span>TOTAL</span>
                    <span>₹${meta.total.toFixed(2)}</span>
                </div>
                <div class="footer">Thank You! Visit Again</div>
            </body>
            </html>
        `;

        // Create blob and open in new window/tab
        try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            
            if (printWindow) {
                // Trigger print dialog after a delay
                setTimeout(() => {
                    printWindow.print();
                }, 500);
                // Clean up blob URL after timeout
                setTimeout(() => { URL.revokeObjectURL(url); }, 3000);
            } else {
                // Fallback: if popup blocked, use iframe approach
                this.printViaIframe(html);
            }
        } catch (e) {
            console.error('Print error:', e);
            alert('Unable to print. Please try again.');
        }
    },

    printViaIframe(html) {
        // Fallback for popup-blocked browsers
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.write(html);
            doc.close();
            
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => { document.body.removeChild(iframe); }, 1000);
            }, 500);
        } catch (e) {
            console.error('Iframe print error:', e);
            document.body.removeChild(iframe);
            alert('Unable to print. Please try again.');
        }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

// --- End-of-day auto-save to Google Sheet ---
function saveEndOfDaySummary() {
    const todayStr = new Date().toLocaleDateString();
    const todaysHistory = state.history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    const totalSales = todaysHistory.reduce((s, h) => s + (parseFloat(h.total) || 0), 0);
    const totalDishes = todaysHistory.reduce((sum, inv) => {
        try {
            const items = inv.items ? (typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items) : [];
            return sum + items.reduce((a, b) => a + (b.qty || 0), 0);
        } catch (e) {
            return sum;
        }
    }, 0);
    // Build daily summary object
    const summary = {
        date: new Date().toISOString(),
        totalSales: totalSales,
        totalDishes: totalDishes,
        invoiceCount: todaysHistory.length,
    };

    // Persist locally and upsert: update existing summary for today if present, otherwise append
    state.dailySummaries = state.dailySummaries || [];
    const todayKey = new Date().toDateString();
    const existingIndex = state.dailySummaries.findIndex(s => new Date(s.date).toDateString() === todayKey);
    if (existingIndex >= 0) {
        // update existing summary
        state.dailySummaries[existingIndex] = Object.assign({}, state.dailySummaries[existingIndex], summary);
    } else {
        state.dailySummaries.push(summary);
    }
    app.persistDailySummaries();
    app.renderHistory();
    app.renderUI();

    // Also attempt to send to backend but ignore failures (local copy is authoritative)
    if (!API_URL.includes('REPLACE')) {
        const payload = { action: 'saveDailySummary', date: todayStr, totalSales, totalDishes, history: JSON.stringify(todaysHistory) };
        return app.apiCall(payload).then(res => {
            console.log('End of day summary saved remotely', res);
            return res;
        }).catch(err => {
            console.warn('End of day remote save failed, local summary persisted', err);
        });
    }
    return Promise.resolve({ status: 'local_saved' });
}

function scheduleEndOfDaySave() {
    const now = new Date();
    // Schedule for a few seconds after midnight to avoid timezone issues
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const ms = next - now;
    setTimeout(() => {
        saveEndOfDaySummary().finally(() => scheduleEndOfDaySave());
    }, ms);
}

window.addEventListener('DOMContentLoaded', () => {
    scheduleEndOfDaySave();
});

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
            <div class="flex items-center gap-3">
                <img src="${item.image || ''}" alt="${item.name}" class="w-12 h-12 object-cover rounded-md border" onerror="this.style.display='none'" />
                <div>
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-400">Code: ${item.code} | ₹${item.price} | ${item.type}</div>
                </div>
            </div>
            <div class="flex gap-2">
                <button class="text-blue-600 hover:underline" onclick="app.editItem(${idx})">Edit</button>
                <button class="text-red-600 hover:underline" onclick="app.deleteItem(${idx})">Delete</button>
            </div>
        </div>
    `).join('');
};

app.addItem = function(item) {
    // ensure code is numeric and unique; start from 1
    const maxCode = state.dishes.reduce((m, d) => Math.max(m, parseInt(d.code || '0', 10)), 0);
    item.code = String(maxCode + 1);
    // if image is a File object (from upload), convert to data URL (already handled before calling addItem)
    state.dishes.push(item);
    this.persistItems();
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
    const imgInput = document.getElementById('item-image');
    const preview = document.getElementById('item-image-preview');
    if (imgInput) imgInput.value = item.image || '';
    if (preview && item.image) { preview.src = item.image; preview.classList.remove('hidden'); } else if (preview) { preview.src = ''; preview.classList.add('hidden'); }
};

app.deleteItem = function(idx) {
    if (confirm('Delete this item?')) {
        state.dishes.splice(idx, 1);
        this.persistItems();
        this.renderItems();
        this.renderUI();
    }
};

app.saveItem = function(e) {
    e.preventDefault();
    const idx = document.getElementById('item-id').value;
    // Determine category: prefer new input when visible/filled, else select value
    const typeSelect = document.getElementById('item-type-select');
    const typeNew = document.getElementById('item-type-new');
    let chosenType = '';
    if (typeNew && typeNew.value.trim()) chosenType = typeNew.value.trim();
    else if (typeSelect && typeSelect.value && typeSelect.value !== '__new') chosenType = typeSelect.value;

    const item = {
        name: document.getElementById('item-name').value,
        code: document.getElementById('item-code').value,
        price: parseFloat(document.getElementById('item-price').value),
        type: chosenType || 'Uncategorized',
        image: document.getElementById('item-image').value
    };
    if (idx === '') {
        this.addItem(item);
    } else {
        state.dishes[idx] = item;
        this.persistItems();
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
    // Image upload handling + preview and category datalist population
    const fileInput = document.getElementById('item-image-file');
    const preview = document.getElementById('item-image-preview');
    const urlInput = document.getElementById('item-image');
    if (fileInput) {
        fileInput.addEventListener('change', function(e){
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function(ev){
                const dataUrl = ev.target.result;
                // set preview and set hidden URL input for persistence
                if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
                if (urlInput) urlInput.value = dataUrl;
            };
            reader.readAsDataURL(f);
        });
    }

    // Populate type suggestions and select options from existing items
    const datalist = document.getElementById('type-suggestions');
    const typeSelect = document.getElementById('item-type-select');
    const typeNewInput = document.getElementById('item-type-new');

    app.refreshTypeOptions = function(){
        const types = Array.from(new Set(state.dishes.map(d => d.type).filter(Boolean)));
        if(datalist) datalist.innerHTML = types.map(t => `<option value="${t}"></option>`).join('');
        if(typeSelect){
            // preserve current selection
            const cur = typeSelect.value;
            // remove existing dynamic options (keep first two default options)
            while(typeSelect.options.length > 2) typeSelect.remove(2);
            types.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                typeSelect.appendChild(opt);
            });
            try { typeSelect.value = cur || (types[0] || ''); } catch(e){}
        }
    };
    app.refreshTypeOptions();

    // When items change, refresh suggestions (wrap existing addItem)
    const origAddItem = app.addItem.bind(app);
    app.addItem = function(item){ origAddItem(item); app.refreshTypeOptions(); };

    // Show/hide "new category" input when select chooses Add new
    if(typeSelect && typeNewInput){
        typeSelect.addEventListener('change', function(){
            if(this.value === '__new'){
                typeNewInput.classList.remove('hidden');
                typeNewInput.focus();
            } else {
                typeNewInput.classList.add('hidden');
                typeNewInput.value = '';
            }
        });
    }

    // History controls: Run EOD, Export, Import
    const runEodBtn = document.getElementById('run-eod-btn');
    const exportBtn = document.getElementById('export-json-btn');

    if (runEodBtn) runEodBtn.addEventListener('click', function(){
        if (!confirm('Run End of Day summary now? This will append a daily summary based on today\'s invoices.')) return;
        // call the existing function to compute and persist daily summary
        saveEndOfDaySummary();
        alert('End of day summary saved locally.');
    });

    if (exportBtn) exportBtn.addEventListener('click', function(){
        const payload = { items: state.dishes || [], invoices: state.history || [], dailySummaries: state.dailySummaries || [] };
        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ganesh-export-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    // import removed per request
});
