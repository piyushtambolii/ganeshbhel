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
        
        // Dish Form Submit
        const dishForm = document.getElementById('dish-form');
        if (dishForm) {
            dishForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const dish = {
                    name: document.getElementById('dish-name').value,
                    code: document.getElementById('dish-code').value,
                    price: parseFloat(document.getElementById('dish-price').value),
                    type: document.getElementById('dish-type').value,
                    image: document.getElementById('dish-image').value || 'https://cdn-icons-png.flaticon.com/512/2619/2619574.png'
                };
                
                // Add to local state (for now) logic - real app should send to API
                const existingIdx = state.dishes.findIndex(d => d.code === dish.code);
                if (existingIdx >= 0) state.dishes[existingIdx] = dish;
                else state.dishes.push(dish);
                
                // PERSIST
                localStorage.setItem('ganesh_dishes', JSON.stringify(state.dishes));

                alert('Dish Saved!');
                dishForm.reset();
                this.renderUI(); // Re-render everything
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
             }).catch(err => console.error('Save failed', err));

             // 3. Clear Logic
             state.currentBill = [];
             this.renderBill();
             if(custInput) custInput.value = '';
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
            
            // DISHES: Check LocalStorage first to persist edits
            const localDishes = localStorage.getItem('ganesh_dishes');
            if (localDishes) {
                state.dishes = JSON.parse(localDishes);
                this.renderUI();
            } else {
                this.mockData(true); // Populate default if empty
            }
            this.renderHistory();
        } catch (e) {
            console.error('Data load error', e);
            // Fallback
            const localDishes = localStorage.getItem('ganesh_dishes');
            if(localDishes) {
                 state.dishes = JSON.parse(localDishes);
                 this.renderUI();
            } else {
                this.mockData();
            }
        }
    },
    
    // Mobile Cart Toggle
    toggleCart() {
        const panel = document.getElementById('cart-panel');
        if(!panel) return;
        
        // Check current transform state or class
        // We use a simple class toggle logic for simplicity if css supports it, 
        // or direct style manipulation. 
        // Based on the HTML, it uses translate-y class. 
        // Let's toggle a 'open' class and handle CSS or just swap classes.
        
        if (panel.classList.contains('translate-y-0')) {
             // Close it (go back to bottom)
             panel.classList.remove('translate-y-0');
             panel.classList.add('translate-y-[calc(100%-80px)]');
        } else {
             // Open it
             panel.classList.remove('translate-y-[calc(100%-80px)]');
             panel.classList.add('translate-y-0');
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
            { code: '1', name: 'Bhel Puri', price: 60, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/10/bhel-puri-recipe.jpg' },
            { code: '2', name: 'Sev Puri', price: 70, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/12/sev-puri-recipe.jpg' },
            { code: '3', name: 'Pani Puri', price: 40, type: 'Chaat', image: 'https://vaya.in/recipes/wp-content/uploads/2018/02/Pani-Puri.jpg' },
            { code: '4', name: 'Masala Puri', price: 50, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2019/11/masala-puri-500x375.jpg' },
            { code: '5', name: 'Dahi Puri', price: 80, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/08/dahi-puri-recipe.jpg' },
            { code: '6', name: 'Sukha Bhel', price: 50, type: 'Chaat', image: 'https://www.tarladalal.com/members/9306/big/big_sukha_bhel-14336.jpg' },
            { code: '7', name: 'Wet Bhel', price: 60, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/10/bhel-puri-recipe.jpg' },
            { code: '8', name: 'Mumbai Bhel', price: 70, type: 'Chaat', image: 'https://www.cookwithmanali.com/wp-content/uploads/2014/05/Bhel-Puri-500x500.jpg' },
            { code: '9', name: 'Kolkata Jhal Muri', price: 60, type: 'Chaat', image: 'https://www.archanaskitchen.com/images/archanaskitchen/1-Author/Shaheen_Ali/Jhal_Muri__Kolkata_Street_Food.jpg' },
            { code: '10', name: 'Churmuri', price: 50, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2022/03/chugum-churmuri-recipe.jpg' },
            { code: '11', name: 'Ragda Pattice', price: 80, type: 'Hot', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2014/11/ragda-patties-recipe.jpg' },
            { code: '12', name: 'Aloo Tikki Chaat', price: 70, type: 'Hot', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2014/06/aloo-tikki-chaat-500x375.jpg' },
            { code: '13', name: 'Samosa Chaat', price: 90, type: 'Hot', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/12/samosa-chaat-recipe.jpg' },
            { code: '14', name: 'Kachori Chaat', price: 80, type: 'Hot', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2022/02/khasta-kachori-chaat-recipe.jpg' },
            { code: '15', name: 'Papdi Chaat', price: 70, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/12/papdi-chaat-recipe.jpg' },
            { code: '16', name: 'Dahi Bhalla', price: 90, type: 'Chaat', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/09/dahi-vada-recipe.jpg' },
            { code: '17', name: 'Tokri Basket Chaat', price: 120, type: 'Chaat', image: 'https://files.yummly.com/cc1a2176-7a76-4648-9da3-0b0b8d96333c/4ea4d872-466d-4959-99ce-4277b949a60e.jpg' },
            { code: '18', name: 'Corn Bhel', price: 70, type: 'Chaat', image: 'https://www.tarladalal.com/members/9306/big/big_corn_bhel-1268.jpg' },
            { code: '19', name: 'Sprouts Bhel', price: 60, type: 'Healthy', image: 'https://www.indianhealthyrecipes.com/wp-content/uploads/2021/03/sprouts-chaat-recipe.jpg' }
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
        
        // Render Admin List
        const adminList = document.getElementById('dishes-list-admin');
        if (adminList) {
             adminList.innerHTML = state.dishes.map(d => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div class="flex items-center gap-3">
                        <img src="${d.image}" class="w-10 h-10 rounded-lg object-cover bg-white">
                        <div>
                            <div class="font-bold text-gray-800 text-sm">${d.name}</div>
                            <div class="text-xs text-gray-500">#${d.code} | ₹${d.price}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.editDish('${d.code}')" class="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg hover:bg-orange-100">Edit</button>
                        <button onclick="app.deleteDish('${d.code}')" class="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100">Delete</button>
                    </div>
                </div>
            `).join('');
        }
    },
    
    deleteDish(code) {
        if(!confirm('Are you sure you want to delete this item?')) return;
        state.dishes = state.dishes.filter(d => d.code !== code);
        localStorage.setItem('ganesh_dishes', JSON.stringify(state.dishes));
        this.renderUI();
    },

    editDish(code) {
        const d = state.dishes.find(x => x.code === code);
        if(!d) return;
        document.getElementById('dish-name').value = d.name;
        document.getElementById('dish-code').value = d.code;
        document.getElementById('dish-price').value = d.price;
        document.getElementById('dish-type').value = d.type;
        document.getElementById('dish-image').value = d.image;
        document.querySelector('#dishes-section').scrollTop = 0; // consistent scroll
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
        // Open a completely new window for the print job
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        // Define clean print styles (Aadhar/Receipt style)
        const style = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            body { 
                font-family: 'Roboto', sans-serif; 
                padding: 40px; 
                margin: 0; 
                color: #333;
            }
            .container {
                max-width: 80mm; /* Standard Thermal Width or adjust for A4 */
                margin: 0 auto;
                border: 1px solid #ddd;
                padding: 20px;
                text-align: center;
            }
            h3 { margin: 0; color: #E65100; font-size: 24px; text-transform: uppercase; }
            .meta { font-size: 12px; margin-bottom: 15px; color: #666; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
            .row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; }
            .item-name { text-align: left; font-weight: 500; }
            .total { 
                margin-top: 15px; 
                padding-top: 10px; 
                border-top: 2px solid #333; 
                font-weight: 700; 
                font-size: 18px; 
                display: flex; 
                justify-content: space-between;
            }
            .footer { margin-top: 20px; font-size: 10px; color: #888; }
            @media print {
                body { padding: 0; }
                .container { border: none; width: 100%; max-width: 100%; }
            }
        `;

        const itemRows = items.map(i => `
            <div class="row">
                <span class="item-name">${i.name} <span style="font-size:0.8em; color:#666;">x${i.qty}</span></span>
                <span>₹${i.qty * i.price}</span>
            </div>
        `).join('');

        const content = `
            <html>
            <head>
                <title>Print Invoice - Ganesh Bhel</title>
                <style>${style}</style>
            </head>
            <body>
                <div class="container">
                    <h3>Ganesh Bhel</h3>
                    <div style="font-size:12px; margin-bottom:10px;">Premium Chaat & Snacks</div>
                    
                    <div class="meta">
                        <div>Bill No: ${meta.id}</div>
                        <div>Date: ${meta.date.toLocaleString()}</div>
                        <div>Customer: ${meta.customer}</div>
                    </div>

                    <div style="text-align:left;">
                        ${itemRows}
                    </div>

                    <div class="total">
                        <span>TOTAL PAYABLE</span>
                        <span>₹${meta.total}</span>
                    </div>

                    <div class="footer">
                        <p>Thank you for visiting!</p>
                        <p>For Franchise Enquiry: franchise@ganeshbhel.com</p>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.focus();
                        setTimeout(() => { 
                            window.print(); 
                            // Optional: Close after print (delayed to allow dialog to open)
                            // window.close(); 
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
