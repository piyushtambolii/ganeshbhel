/* Google Apps Script API URL - USER MUST REPLACE THIS */
// DEPLOY YOUR CODE.GS AS WEB APP AND PASTE URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbxOvEGma9_vdXuR6eqcEkikXu3LnyPrp2m2A5XNTTkqtLUfYMjYL2U1Sz_PFZo4OBZdNg/exec';
const state = {
    dishes: [],
    history: [],
    dailySummaries: [],
    currentOrder: null, // Active order object
    activeTable: null,  // Currently selected table ID (1-15)
    user: null
};

// Main app object
const app = {
    init() {
        // Initialize DB
        DB.init();
        
        // Render Tables
        this.renderTableSelector();
        
        this.checkLogin();
        this.bindEvents();
        // Set date
        const dateEl = document.getElementById('bill-date');
        if(dateEl) dateEl.textContent = new Date().toLocaleDateString();
    },

    renderTableSelector() {
        const container = document.getElementById('table-selector');
        if(!container) return;
        
        let html = '';
        for(let i=1; i<=15; i++) {
            // Check status (mock check, will need real check later)
            // For now just render buttons
            html += `<div class="table-btn ${state.activeTable == i ? 'active' : ''}" onclick="app.selectTable(${i})">T-${i}</div>`;
        }
        // Add "Open Orders" button
        html += `<div class="table-btn" style="min-width:auto; padding:0 15px; background:#e0e7ff; color:#4338ca" onclick="app.showOpenOrders()">All Open</div>`;
        
        container.innerHTML = html;
    },

    async selectTable(tableId) {
        state.activeTable = tableId;
        this.renderTableSelector(); // highlight active
        
        // Fetch open order for this table
        const order = await DB.getOrderForTable(tableId);
        if (order) {
            state.currentOrder = order;
        } else {
            // New empty order state (not created in DB until item added)
            state.currentOrder = { id: null, tableId: tableId, items: [], totals: { amount:0, net:0 } };
        }
        
        this.renderBill();
        this.renderMenu(document.getElementById('pos-search')?.value);
        
        // Update Table Info in UI
        const billDate = document.getElementById('bill-date');
        if(billDate) {
            const label = tableId === 'Quick' ? 'Quick Order (Walk-in)' : `Table-${tableId}`;
            billDate.textContent = `${label} | ${new Date().toLocaleTimeString()}`;
        }
    },

    async showOpenOrders() {
        const modal = document.getElementById('modal-open-orders');
        const list = document.getElementById('open-orders-list');
        modal.classList.remove('hidden');
        
        const orders = await DB.getOpenOrders();
        if (orders.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-400">No open orders.</div>';
            return;
        }
        
        list.innerHTML = orders.map(o => `
            <div class="bg-white border p-4 rounded-xl flex justify-between items-center mb-3 shadow-sm">
                <div>
                    <div class="font-bold text-lg">Table ${o.tableId}</div>
                    <div class="text-sm text-gray-500">Order: ${o.id.slice(-6)} | ₹${o.totals.net}</div>
                    <div class="text-xs text-gray-400">${new Date(o.createdAt).toLocaleTimeString()}</div>
                </div>
                <button onclick="app.selectTable(${o.tableId}); document.getElementById('modal-open-orders').classList.add('hidden')" class="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold">
                    Open
                </button>
            </div>
        `).join('');
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

        // Fast Add Bindings
        document.getElementById('btn-fast-add')?.addEventListener('click', () => this.fastAddItem());
        document.getElementById('fast-code')?.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') document.getElementById('fast-qty').focus(); 
        });
        document.getElementById('fast-qty')?.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') this.fastAddItem();
        });
        
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

        // Print Actions
        const createBtn = document.getElementById('create-invoice-btn');
        if (createBtn) createBtn.addEventListener('click', () => this.handleFinalBill());
        
        // Removed KOT button listener
        
        const couponBtn = document.getElementById('btn-print-coupon');
        if (couponBtn) couponBtn.addEventListener('click', () => this.handlePrintCoupons());
    },

    async handleFinalBill() {
        if (!state.currentOrder || !state.currentOrder.id || state.currentOrder.items.length === 0) {
            return alert('Please select a table and add items first.');
        }
        
        // 1. Get Customer Name
        const custInput = document.getElementById('cust-name-opt');
        const customer = (custInput && custInput.value) || state.currentOrder.customer || 'Walk-in';
        state.currentOrder.customer = customer; // update state
        
        // 2. Print First (Optimistic)
        Printer.printBill({ ...state.currentOrder });
        
        // 3. Mark as CLOSED and Sync
        state.currentOrder.status = 'CLOSED';
        
        // Close in Local Mock DB immediately for UI responsiveness
        await DB.closeOrder(state.currentOrder.id, { method: 'CASH', customer });
        
        // Add to history state and render
        const closedOrder = { ...state.currentOrder, date: new Date().toISOString() };
        state.history.unshift(closedOrder);
        this.persistInvoices();
        this.renderHistory();
        
        // Sync to Sheets (Action: saveOrder with status=CLOSED)
        if (!API_URL.includes('REPLACE')) {
            this.apiCall({ 
                action: 'saveOrder', 
                id: state.currentOrder.id, 
                tableId: state.currentOrder.tableId,
                status: 'CLOSED',
                total: state.currentOrder.totals.net, 
                customer: customer, 
                items: JSON.stringify(state.currentOrder.items) 
            }).catch(e => console.warn('Close sync failed', e));
        }

        // 4. Reset Table State
        state.currentOrder = { id: null, tableId: state.activeTable, items: [], totals: {amount:0, net:0}, customer: '' };
        this.renderBill();
        if(custInput) custInput.value = '';
        saveEndOfDaySummary();
    },

    handlePrintKOT() {
        if (!state.currentOrder || state.currentOrder.items.length === 0) return alert('Order is empty');
        Printer.printKOT(state.currentOrder);
        // Save order as OPEN
        this.saveCurrentOrder();
    },

    handlePrintCoupons() {
        if (!state.currentOrder || state.currentOrder.items.length === 0) return alert('Order is empty');
        Printer.printCoupons(state.currentOrder);
        // Capture Customer Info if present
        const custInput = document.getElementById('cust-name-opt');
        if (custInput && custInput.value) state.currentOrder.customer = custInput.value;
        this.saveCurrentOrder();
    },

    fastAddItem() {
        const codeInput = document.getElementById('fast-code');
        const qtyInput = document.getElementById('fast-qty');
        const code = codeInput.value.trim();
        const qty = parseInt(qtyInput.value) || 1;
        
        if (!code) return;
        
        const item = state.dishes.find(d => d.code === code);
        if (item) {
            this.addItemToOrder(item, qty);
            // Reset for next
            codeInput.value = '';
            qtyInput.value = '1';
            codeInput.focus();
        } else {
            alert('Item code not found!');
            codeInput.select();
        }
    },

    async saveCurrentOrder() {
        if (!state.activeTable) return alert('Select a table first');
        if (state.currentOrder.items.length === 0) return;
        
        // Ensure ID
        if (!state.currentOrder.id) {
            state.currentOrder.id = 'ORD-' + Date.now().toString().slice(-6);
        }
        
        const custInput = document.getElementById('cust-name-opt');
        const customer = (custInput ? custInput.value : '') || state.currentOrder.customer || '';
        state.currentOrder.customer = customer;

        // Save Local (for reliability)
        // Note: DB.createOrder/updateOrder logic mostly handles local array, 
        // we essentially just need validity here.
        
        // Sync to Sheets (Upsert as OPEN)
        if (!API_URL.includes('REPLACE')) {
            // Non-blocking sync
            this.apiCall({
                 action: 'saveOrder',
                 id: state.currentOrder.id,
                 tableId: state.activeTable,
                 customer: customer,
                 status: 'OPEN',
                 total: state.currentOrder.totals.net,
                 items: JSON.stringify(state.currentOrder.items)
            }).then(res => console.log('Cloud Saved:', res)).catch(e => console.error('Cloud Save Error', e));
        } else {
             console.log('Mock Save (No API)');
        }
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

    toggleCollapse(elementId, iconId) {
        const el = document.getElementById(elementId);
        const icon = document.getElementById(iconId);
        if (!el) return;
        
        const isCollapsed = el.style.maxHeight === '0px';
        
        if (isCollapsed) {
            // EXPAND
            el.classList.remove('hidden'); // fail-safe
            el.style.maxHeight = el.scrollHeight + 'px';
            if (icon) icon.classList.add('rotate-180');
            
            // Reset to auto after animation
            el.addEventListener('transitionend', function() {
                if (el.style.maxHeight !== '0px') {
                   el.style.maxHeight = null; 
                }
            }, { once: true });
            
        } else {
            // COLLAPSE
            el.style.maxHeight = el.scrollHeight + 'px';
            el.offsetHeight; // reflow
            el.style.maxHeight = '0px';
            if (icon) icon.classList.remove('rotate-180');
        }
    },

    async loadData() {
        // Load local persistence first
        try {
            const savedInv = localStorage.getItem('ganesh_invoices');
            if (savedInv) state.history = JSON.parse(savedInv);
        } catch (e) { state.history = state.history || []; }
        try {
            const savedDaily = localStorage.getItem('ganesh_daily_summaries');
            if (savedDaily) state.dailySummaries = JSON.parse(savedDaily);
        } catch (e) { state.dailySummaries = state.dailySummaries || []; }

        // Load cached items
        const cachedItems = localStorage.getItem('ganesh_items');
        if (cachedItems) {
            try { state.dishes = JSON.parse(cachedItems); } catch (e) {}
        }
        
        if (state.dishes.length === 0) {
             console.log('No cache, loading default items...');
             // Default Items (Full Menu)
             state.dishes = [
                // Bhel
                { code: '1', name: 'Bhel Puri', price: 60, type: 'Bhel', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '2', name: 'Matki Bhel', price: 70, type: 'Bhel', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '3', name: 'Sukha Bhel', price: 50, type: 'Bhel', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '4', name: 'Oli Bhel', price: 60, type: 'Bhel', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '5', name: 'Jain Bhel', price: 60, type: 'Bhel', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                
                // Chaat
                { code: '11', name: 'Pani Puri', price: 40, type: 'Pani Puri', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046771.png' },
                { code: '12', name: 'SPDP', price: 80, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png' },
                { code: '13', name: 'Dahi Puri', price: 70, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046771.png' },
                { code: '14', name: 'Sev Puri', price: 60, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '15', name: 'Masala Puri', price: 50, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046755.png' },
                { code: '16', name: 'Ragda Pattice', price: 70, type: 'Chaat', image: 'https://cdn-icons-png.flaticon.com/512/123/123284.png' },
                
                // Dosas
                { code: '21', name: 'Sada Dosa', price: 60, type: 'Dosas', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046765.png' },
                { code: '22', name: 'Masala Dosa', price: 80, type: 'Dosas', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046765.png' },
                { code: '23', name: 'Mysore Masala', price: 100, type: 'Dosas', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046765.png' },
                { code: '24', name: 'Cut Dosa', price: 100, type: 'Dosas', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046765.png' },
                { code: '25', name: 'Cheese Dosa', price: 120, type: 'Dosas', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046765.png' },
                
                // Sandwiches
                { code: '31', name: 'Veg Sandwich', price: 60, type: 'Sandwiches', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046759.png' },
                { code: '32', name: 'Cheese Sandwich', price: 80, type: 'Sandwiches', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046759.png' },
                { code: '33', name: 'Toast Sandwich', price: 70, type: 'Sandwiches', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046759.png' },
                { code: '34', name: 'Grill Sandwich', price: 100, type: 'Sandwiches', image: 'https://cdn-icons-png.flaticon.com/512/1046/1046759.png' },
                
                // Others
                { code: '41', name: 'Pizza', price: 150, type: 'Others', image: 'https://cdn-icons-png.flaticon.com/512/1404/1404945.png' },
                { code: '42', name: 'Burger', price: 80, type: 'Others', image: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' },
                { code: '44', name: 'Cold Coffee', price: 60, type: 'Drinks', image: 'https://cdn-icons-png.flaticon.com/512/924/924514.png' }
            ];
            this.persistItems();
        }
        
        this.renderUI();

        if (API_URL.includes('REPLACE')) {
            console.warn('API URL not set. Using offline/mock mode.');
            return;
        }

        try {
            // Fetch live items
            console.log('Fetching items from Sheet...');
            const res = await fetch(`${API_URL}?action=getItems`);
            const items = await res.json();
            
            if (Array.isArray(items) && items.length > 0) {
                state.dishes = items;
                this.persistItems();
                this.renderUI();
                console.log('Items updated from Sheet');
            }
            
            // Fetch remote history
            const histRes = await fetch(`${API_URL}?action=getHistory`);
            const histData = await histRes.json();
            if (Array.isArray(histData)) {
                // Merge history
                const existingIds = new Set((state.history || []).map(h => h.id));
                histData.forEach(d => { if (!existingIds.has(d.id)) state.history.push(d); });
                state.history.sort((a,b) => new Date(b.date) - new Date(a.date));
                this.persistInvoices();
                this.renderHistory();
            }
            
            // Fetch Open Orders (Sync Active State)
            const openRes = await fetch(`${API_URL}?action=getOpenOrders`);
            const openData = await openRes.json();
            if (Array.isArray(openData) && openData.length > 0) {
                 console.log('Synced Open Orders:', openData.length);
                 // hydrate local DB with cloud open orders
                 // We need to bypass DB methods slightly or assume DB is ephemeral?
                 // Let's just update the DB._orders mock array if we are in mock mode, 
                 // or ideally DB should be the one fetching. 
                 // For now, let's just make sure they are discoverable via showOpenOrders
                 // Ideally we should merge them into DB.
                 DB.mergeCloudOrders(openData);
            }
        } catch (e) {
            console.error('Data sync error', e);
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
        // Use currentOrder.items or [] if no table selected
        const currentItems = state.currentOrder ? state.currentOrder.items : [];
        
        grid.innerHTML = filtered.map(d => {
            const inBill = currentItems.find(b => b.code === d.code);
            const qty = inBill ? inBill.qty : 0;
            
            return `
            <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 transition group relative overflow-hidden flex flex-col h-full">
                <div onclick="${qty === 0 ? `app.updateItemQtyByCode('${d.code}', 1)` : ''}" class="cursor-pointer">
                    <div class="h-24 mb-2 overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center relative">
                        <img src="${d.image}" class="h-16 w-16 object-contain ${qty > 0 ? '' : 'group-hover:scale-110'} transition duration-300">
                        ${qty > 0 ? `<div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center font-bold text-2xl text-orange-600 animate-in fade-in zoom-in duration-200">${qty}</div>` : ''}
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm truncate">${d.name}</h4>
                        <div class="flex justify-between items-center mt-1">
                            <span class="text-xs text-gray-400">#${d.code}</span>
                            <span class="text-orange-600 font-bold">₹${d.price}</span>
                        </div>
                    </div>
                </div>
                
                <div class="mt-3 pt-2 border-t border-gray-50">
                    ${qty === 0 ? `
                        <button onclick="app.updateItemQtyByCode('${d.code}', 1)" class="w-full bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold py-2 rounded-xl text-sm transition flex items-center justify-center gap-1">
                            <ion-icon name="add-outline"></ion-icon> Add
                        </button>
                    ` : `
                        <div class="flex items-center justify-between bg-orange-600 rounded-xl p-1">
                             <button onclick="app.updateItemQtyByCode('${d.code}', -1)" class="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center active:bg-orange-700 transition">
                                <ion-icon name="remove"></ion-icon>
                            </button>
                            <span class="font-bold text-white text-sm">${qty}</span>
                            <button onclick="app.updateItemQtyByCode('${d.code}', 1)" class="w-8 h-8 rounded-lg bg-white text-orange-600 flex items-center justify-center active:bg-gray-100 transition shadow-sm">
                                <ion-icon name="add"></ion-icon>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `}).join('');
    },
    
    async updateItemQtyByCode(code, change) {
        if (!state.activeTable) {
            // Auto-select "Quick" table/order if none selected
            await this.selectTable('Quick');
        }
        
        let items = state.currentOrder.items || [];
        const index = items.findIndex(i => i.code === code);
        
        if (index >= 0) {
            const newQty = items[index].qty + change;
            if (newQty <= 0) items.splice(index, 1);
            else items[index].qty = newQty;
        } else if (change > 0) {
             const dish = state.dishes.find(d => d.code === code);
             if(dish) items.push({...dish, qty: 1});
        }
        
        state.currentOrder.items = items;
        // Recalculate totals local
        const net = items.reduce((s, i) => s + (i.price * i.qty), 0);
        state.currentOrder.totals = { amount: net, net: net };
        
        // Save to DB immediately (debounced ideally, but direct for now)
        await this.saveCurrentOrder();
        
        this.renderBill();
        this.renderMenu(document.getElementById('pos-search')?.value);
    },
    
    // Removed old addToBill, use updateItemQtyByCode
    
    renderBill() {
        const container = document.getElementById('current-bill-items');
        // Check if table selected
        if (!state.activeTable) {
             container.innerHTML = `<div class="text-center text-gray-400 mt-10">Select a Table to start ordering</div>`;
             document.getElementById('bill-total-amount').textContent = '₹0';
             return;
        }
        
        const items = state.currentOrder ? state.currentOrder.items : [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 mt-10">
                    <ion-icon name="cart-outline" class="text-4xl mb-2 text-gray-300"></ion-icon>
                    <p class="text-sm">Empty Order (Table ${state.activeTable})</p>
                </div>`;
            document.getElementById('bill-total-amount').textContent = '₹0';
            return;
        }

        let total = 0;
        container.innerHTML = items.map((item, index) => {
            const itemTotal = item.price * item.qty;
            total += itemTotal;
            return `
                <div class="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-sm text-gray-800">${item.name}</div>
                            <div class="text-xs text-gray-400">@ ₹${item.price}</div>
                        </div>
                        <div class="font-bold text-orange-600">₹${itemTotal}</div>
                    </div>
                    
                    <div class="flex justify-between items-center mt-1">
                        <div class="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-gray-200">
                             <button onclick="app.updateItemQtyByCode('${item.code}', -1)" class="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition active:scale-95">
                                ${item.qty === 1 ? '<ion-icon name="trash-outline"></ion-icon>' : '<ion-icon name="remove"></ion-icon>'}
                            </button>
                            <span class="font-bold w-6 text-center text-sm">${item.qty}</span>
                            <button onclick="app.updateItemQtyByCode('${item.code}', 1)" class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition active:scale-95">
                                <ion-icon name="add"></ion-icon>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('bill-total-amount').textContent = '₹' + total;
        
        // Update Print Button state?
    },
    
    // Removed old updateBillItemQty, logic is now centralized in updateItemQtyByCode
    
    removeFromBill(index) {
        // Deprecated
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

    // Old print logic removed. Using Printer.js now.

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
