/**
 * Database Wrapper for Ganesh Bhel POS
 * Abstraction layer to switch between Mock (LocalStorage) and Firebase Firestore.
 */

const DB = {
    useFirebase: false, // Set to true after configuring Firebase

    init() {
        if (this.useFirebase && window.firebase) {
            try {
                const app = firebase.initializeApp(window.firebaseConfig);
                this.db = firebase.firestore();
                console.log('Firebase initialized');
            } catch (e) {
                console.error('Firebase init error', e);
                this.useFirebase = false; // Fallback
            }
        }
        console.log(`DB Initialized. Mode: ${this.useFirebase ? 'FIREBASE' : 'LOCAL MOCK'}`);
    },

    // --- Order Methods ---

    // Create a new order for a table
    // Returns Promise<{ orderId }>
    async createOrder(tableId, items = []) {
        const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = {
            id: orderId,
            tableId: String(tableId),
            createdAt: new Date().toISOString(),
            status: 'OPEN',
            items: items,
            totals: this.calculateTotals(items),
            flags: { kotPrinted: false, couponsPrinted: false, billPrinted: false }
        };

        if (this.useFirebase) {
            await this.db.collection('orders').doc(orderId).set(order);
        } else {
            const orders = this.getMockOrders();
            orders.push(order);
            this.saveMockOrders(orders);
        }
        return order;
    },

    // Get active order for a table
    async getOrderForTable(tableId) {
        if (this.useFirebase) {
            const snapshot = await this.db.collection('orders')
                .where('tableId', '==', String(tableId))
                .where('status', '==', 'OPEN')
                .limit(1)
                .get();
            if (snapshot.empty) return null;
            return snapshot.docs[0].data();
        } else {
            const orders = this.getMockOrders();
            return orders.find(o => String(o.tableId) === String(tableId) && o.status === 'OPEN') || null;
        }
    },

    // Upsert (Create or Update) an order
    async upsertOrder(order) {
        if (!order || !order.id) return;
        
        if (this.useFirebase) {
             await this.db.collection('orders').doc(order.id).set(order, { merge: true });
        } else {
             const orders = this.getMockOrders();
             const idx = orders.findIndex(o => o.id === order.id);
             if (idx >= 0) {
                 orders[idx] = order;
             } else {
                 orders.push(order);
             }
             this.saveMockOrders(orders);
        }
    },

    // Update an order (items, flags, etc)
    async updateOrder(orderId, updates) {
        if (this.useFirebase) {
            // Recalculate totals if items changed
            if (updates.items) {
                updates.totals = this.calculateTotals(updates.items);
            }
            await this.db.collection('orders').doc(orderId).update(updates);
        } else {
            const orders = this.getMockOrders();
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx >= 0) {
                if (updates.items) {
                    updates.totals = this.calculateTotals(updates.items);
                }
                orders[idx] = { ...orders[idx], ...updates };
                this.saveMockOrders(orders);
            }
        }
    },

    // Close order (move to history)
    async closeOrder(orderId, paymentDetails = {}) {
        const updates = {
            status: 'CLOSED',
            closedAt: new Date().toISOString(),
            payment: paymentDetails
        };
        await this.updateOrder(orderId, updates);
        
        // Return final order data for printing/syncing
        return this.getOrderById(orderId);
    },

    async getOrderById(orderId) {
        if (this.useFirebase) {
            const doc = await this.db.collection('orders').doc(orderId).get();
            return doc.exists ? doc.data() : null;
        } else {
            return this.getMockOrders().find(o => o.id === orderId) || null;
        }
    },

    // Get all open orders
    async getOpenOrders() {
        if (this.useFirebase) {
            const snapshot = await this.db.collection('orders').where('status', '==', 'OPEN').get();
            return snapshot.docs.map(d => d.data());
        } else {
            return this.getMockOrders().filter(o => o.status === 'OPEN');
        }
    },

    // Sync helper: Merge cloud orders into local mock DB
    mergeCloudOrders(cloudOrders) {
        if (this.useFirebase) return;
        
        const local = this.getMockOrders();
        let changed = false;
        
        cloudOrders.forEach(cloudOrder => {
            const existingIdx = local.findIndex(o => o.id === cloudOrder.id);
            if (existingIdx === -1) {
                local.push(cloudOrder);
                changed = true;
            } else {
                // Optional: Update local if cloud is newer? 
                // For now, assume cloud is source of truth for "Open" status on init
                // local[existingIdx] = cloudOrder; 
            }
        });
        
        if(changed) {
            this.saveMockOrders(local);
            console.log('Merged cloud orders into local DB');
        }
    },

    // --- Utility ---

    calculateTotals(items) {
        const amount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        return {
            amount: amount,
            tax: 0, // Add tax logic if needed
            net: amount
        };
    },

    // MOCK HELPERS
    getMockOrders() {
        try {
            return JSON.parse(localStorage.getItem('pos_orders_mock')) || [];
        } catch (e) { return []; }
    },
    saveMockOrders(orders) {
        localStorage.setItem('pos_orders_mock', JSON.stringify(orders));
    }
};

window.DB = DB;
