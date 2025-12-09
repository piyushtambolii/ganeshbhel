/* Google Apps Script API URL - USER MUST REPLACE THIS */
// Placeholder - User needs to deploy GAS and update this
const API_URL = 'REPLACE_WITH_YOUR_DEPLOYED_WEB_APP_URL';

// App State
const state = {
    inventory: [],
    dishes: [],
    history: [],
    currentBill: [],
    user: null
};

// DOM Elements
const app = {
    init: () => {
        app.checkLogin();
        app.bindEvents();
        app.registerSW();
    },

    registerSW: () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.log('SW Error', err));
        }
    },

    checkLogin: () => {
        const user = localStorage.getItem('ganesh_user');
        if (user) {
            state.user = JSON.parse(user);
            app.showMain();
        } else {
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('main-layout').classList.add('hidden');
        }
    },

    bindEvents: () => {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Backend handles auth ideally, but for now matching reqs:
            if(email === 'franchise1@shop.com' && password === 'fran123') {
                const user = { email, name: 'Franchise 1' };
                localStorage.setItem('ganesh_user', JSON.stringify(user));
                state.user = user;
                app.showMain();
            } else {
                alert('Invalid Credentials');
            }
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('ganesh_user');
            window.location.reload();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                app.navTo(target);
            });
        });

        // Inventory Form
        document.getElementById('inventory-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const item = {
                action: 'addInventory',
                name: document.getElementById('inv-name').value,
                qty: document.getElementById('inv-qty').value,
                unit: document.getElementById('inv-unit').value,
                cost: document.getElementById('inv-cost').value,
                price: document.getElementById('inv-price').value
            };
            app.apiCall(item).then(() => {
                alert('Stock Added!');
                app.loadData();
                e.target.reset();
            });
        });

        // Dish Form - Add Ingredient Row
        document.getElementById('add-ingredient-btn').addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'ingredient-row';
            div.innerHTML = `
                <select class="inv-select" required>${app.getInvOptions()}</select>
                <input type="number" class="ing-qty" placeholder="Qty" step="0.01" required>
            `;
            document.getElementById('ingredients-inputs').appendChild(div);
        });

        // Dish Form Submit
        document.getElementById('dish-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const ingredients = [];
            document.querySelectorAll('#ingredients-inputs .ingredient-row').forEach(row => {
                ingredients.push({
                    item: row.querySelector('.inv-select').value,
                    qty: row.querySelector('.ing-qty').value
                });
            });
            
            const dish = {
                action: 'addDish',
                name: document.getElementById('dish-name').value,
                price: document.getElementById('dish-price').value,
                ingredients: JSON.stringify(ingredients)
            };

            app.apiCall(dish).then(() => {
                alert('Dish Added!');
                app.loadData();
                e.target.reset();
                document.getElementById('ingredients-inputs').innerHTML = `
                    <div class="ingredient-row">
                       <select class="inv-select" required>${app.getInvOptions()}</select>
                       <input type="number" class="ing-qty" placeholder="Qty" step="0.01" required>
                   </div>`;
            });
        });

        // Create Invoice
        document.getElementById('create-invoice-btn').addEventListener('click', () => {
            if(state.currentBill.length === 0) return alert('Bill is empty');
            
            const invoice = {
                action: 'createInvoice',
                customerName: document.getElementById('cust-name').value || 'Walk-in',
                customerMobile: document.getElementById('cust-mobile').value || '',
                items: JSON.stringify(state.currentBill),
                total: state.currentBill.reduce((sum, item) => sum + (item.price * item.qty), 0),
                date: new Date().toISOString()
            };

            app.apiCall(invoice).then(() => {
                alert('Invoice Created & PDF Downloaded!');
                // Generate PDF
                app.generatePDF(invoice);
                
                state.currentBill = [];
                app.renderBill();
                document.getElementById('cust-name').value = '';
                document.getElementById('cust-mobile').value = '';
                app.loadData(); // Refresh stock
            });
        });
    },

    navTo: (targetId) => {
        // Update Nav UI
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');

        // Update Sections
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${targetId}-section`)?.classList.add('active');
        
        // Update Title
        document.getElementById('page-title').textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);
    },

    showMain: () => {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-layout').classList.remove('hidden');
        app.loadData();
    },

    loadData: async () => {
        // Mock data if API_URL is placeholder (so user can see UI)
        if(API_URL.includes('REPLACE')) {
            console.warn('API URL not set. Using mock data.');
            app.mockData();
            return;
        }

        try {
            const [inv, dishes, hist] = await Promise.all([
                app.apiCall({ action: 'getInventory' }),
                app.apiCall({ action: 'getDishes' }),
                app.apiCall({ action: 'getHistory' })
            ]);
            
            state.inventory = inv || [];
            state.dishes = dishes || [];
            state.history = hist || [];
            
            app.renderUI();
        } catch(e) {
            console.error('Data load failed', e);
        }
    },

    apiCall: async (data) => {
        if(API_URL.includes('REPLACE')) return null; // Skip if no API
        
        // Use no-cors for simple GET/POST to GAS if needed, but GAS usually requires redirect handling
        // A common pattern for GAS API is using standard fetch with redirect: 'follow'
        const params = new URLSearchParams(data);
        const res = await fetch(`${API_URL}?${params.toString()}`);
        return await res.json();
    },

    renderUI: () => {
        // Dashboard Stats
        document.getElementById('dash-dishes-count').textContent = state.dishes.length;
        document.getElementById('dash-stock-count').textContent = state.inventory.length;
        document.getElementById('dash-bills-count').textContent = state.history.filter(h => {
            const d = new Date(h.date);
            const now = new Date();
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
        }).length;

        // Inventory List
        const invList = document.getElementById('inventory-list');
        invList.innerHTML = state.inventory.map(i => `
            <div class="list-item">
                <div>
                    <div class="list-item-title">${i.name}</div>
                    <div class="list-item-subtitle">${i.qty} ${i.unit} available</div>
                </div>
            </div>
        `).join('');

        // Dish List
        const dishList = document.getElementById('dishes-list');
        dishList.innerHTML = state.dishes.map(d => `
            <div class="list-item">
                 <div>
                    <div class="list-item-title">${d.name}</div>
                </div>
                <div class="list-item-price">₹${d.price}</div>
            </div>
        `).join('');

        // Billing Menu Grid
        const menuGrid = document.getElementById('billing-menu-grid');
        menuGrid.innerHTML = state.dishes.map(d => `
            <div class="dish-card" onclick="app.addToBill('${d.name}')">
                <img src="${d.image || 'https://via.placeholder.com/150'}">
                <div class="dish-info">
                    <div class="dish-title">${d.name}</div>
                    <div class="dish-price">₹${d.price}</div>
                </div>
                <div class="add-overlay">
                    <ion-icon name="add-circle"></ion-icon>
                </div>
            </div>
        `).join('');
        
        // Update Ingredient Selects
        document.querySelectorAll('.inv-select').forEach(sel => {
            if(sel.options.length <= 1) sel.innerHTML = app.getInvOptions();
        });

        // History List
        const histList = document.getElementById('invoice-list');
        histList.innerHTML = state.history.map(h => `
             <div class="list-item">
                 <div>
                    <div class="list-item-title">#${h.id.substring(0,6)}... - ${h.customerName}</div>
                    <div class="list-item-subtitle">${new Date(h.date).toLocaleDateString()}</div>
                </div>
                <div class="list-item-price">₹${h.total}</div>
            </div>
        `).join('');
    },

    getInvOptions: () => {
        return '<option value="">Select Ingredient</option>' + 
            state.inventory.map(i => `<option value="${i.name}">${i.name} (${i.unit})</option>`).join('');
    },

    renderBill: () => {
        const list = document.getElementById('current-bill-items');
        if(state.currentBill.length === 0) {
            list.innerHTML = '<p class="empty-msg">No items added.</p>';
            document.getElementById('bill-total-amount').textContent = '₹0';
            return;
        }

        let total = 0;
        list.innerHTML = state.currentBill.map((item, idx) => {
            const itemTotal = item.price * item.qty;
            total += itemTotal;
            return `
                <div class="bill-item">
                    <span>${item.name} x ${item.qty}</span>
                    <span>₹${itemTotal}</span>
                </div>
            `;
        }).join('');
        
        document.getElementById('bill-total-amount').textContent = `₹${total}`;
    },

    generatePDF: (invoice) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Colors
        const primaryColor = [230, 81, 0]; // #e65100
        const black = [0, 0, 0];
        const gray = [100, 100, 100];

        // Header
        doc.setTextColor(...primaryColor);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("Ganesh Bhel", 105, 20, { align: "center" });

        doc.setTextColor(...gray);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Pune, Maharashtra", 105, 26, { align: "center" });
        doc.text("Ph: +91 98765 43210", 105, 31, { align: "center" });

        doc.setDrawColor(200, 200, 200);
        doc.line(10, 35, 200, 35);

        // Invoice Details
        doc.setTextColor(...black);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 15, 45);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice No: ${invoice.id ? invoice.id.substring(0, 8).toUpperCase() : 'N/A'}`, 15, 52);
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()} ${new Date(invoice.date).toLocaleTimeString()}`, 15, 57);

        doc.text(`Customer: ${invoice.customerName}`, 140, 52);
        doc.text(`Mobile: ${invoice.customerMobile || 'N/A'}`, 140, 57);

        // Table
        const tableColumn = ["Item", "Price", "Qty", "Total"];
        const tableRows = [];

        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        items.forEach(item => {
            const itemData = [
                item.name,
                `Rs. ${item.price}`,
                item.qty,
                `Rs. ${item.price * item.qty}`
            ];
            tableRows.push(itemData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 65,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 },
                3: { cellWidth: 40, halign: 'right' }
            }
        });

        // Total
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.text(`Grand Total: Rs. ${invoice.total}`, 195, finalY, { align: "right" });

        // Footer
        doc.setTextColor(...gray);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("Thank you for visiting Ganesh Bhel!", 105, 280, { align: "center" });

        // Save
        doc.save(`Invoice_${invoice.customerName}_${Date.now()}.pdf`);
    },

    addToBill: (dishName) => {
        const dish = state.dishes.find(d => d.name === dishName);
        if(!dish) return;

        // Check if already in bill
        const existing = state.currentBill.find(i => i.name === dishName);
        if(existing) {
            existing.qty += 1;
        } else {
            state.currentBill.push({ ...dish, qty: 1 });
        }
        app.renderBill();
    },

    mockData: () => {
        // For demonstration before API is connected
        state.inventory = [
            { name: 'Puffed Rice', qty: 10, unit: 'kg' },
            { name: 'Onions', qty: 5, unit: 'kg' },
            { name: 'Sev', qty: 2, unit: 'kg' }
        ];
        state.dishes = [
            { 
                name: 'Bhel Puri', 
                price: 50, 
                image: 'https://img.freepik.com/premium-photo/bhel-puri-is-savoury-snack-chaat-which-is-also-type-puffed-rice-from-india-served-bowl_466689-76678.jpg'
            },
            { 
                name: 'Sev Puri', 
                price: 60, 
                image: 'https://img.freepik.com/premium-photo/sev-puri-indian-snack-street-food_57665-9279.jpg' 
            },
            { 
                name: 'Pani Puri', 
                price: 40, 
                image: 'https://img.freepik.com/premium-photo/pani-puri-golgappa-indian-snack_57665-2882.jpg' 
            },
            { 
                name: 'Dahi Puri', 
                price: 70, 
                image: 'https://t3.ftcdn.net/jpg/04/18/72/72/360_F_418727282_M3c8c9z4Lg9c8c9z4Lg9c8c9z4Lg9c8.jpg' 
            },
            { 
                name: 'Ragda Pattice', 
                price: 60, 
                image: 'https://t4.ftcdn.net/jpg/02/69/27/36/360_F_269273669_gqI6yJ5g1v7p4yJ5g1v7p4yJ5g1v7p4.jpg' 
            },
             { 
                name: 'SPDP', 
                price: 80, 
                image: 'https://content.jdmagicbox.com/comp/mumbai/j9/022pxx22.xx22.190305133646.m6j9/catalogue/shree-ganesh-bhel-and-snacks-kandivali-west-mumbai-quick-bite-outlets-10d2s7c4u5.jpg' 
            }
        ];
        app.renderUI();
    }
};

window.addEventListener('DOMContentLoaded', app.init);
