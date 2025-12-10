/**
 * Printing Utility for Thermal Printers (80mm)
 * Layouts match specific user requirements.
 */

const Printer = {
    // Current shop details
    shopName: "GANESH BHEL",
    shopAddress: "SHOP NO. 2 FORTUNE PLAZA,\nBAAWDHAN, PUNE.",
    
    // 1. KOT (Kitchen Order Ticket) - Matches "DOSAS" Image
    printKOT(order) {
        const container = document.getElementById('print-kot');
        if (!container) return;

        // Group items by category? The image shows "DOSAS" as a big header.
        // If the order has multiple categories, we might need multiple headers or just "KOT"
        // For now, we will assume standard KOT but formatted like the image.
        
        const date = new Date();
        const dateStr = date.toLocaleDateString('en-GB').replace(/\//g, '-'); // 10-12-2025
        const timeStr = date.toLocaleTimeString('en-GB');
        
        // Filter only unprinted items? For now print all.
        
        const html = `
            <div class="thermal-ticket">
                <div class="kot-header">
                    <div style="text-align:right; font-weight:bold; font-size:1.2em; margin-bottom:10px;">KOT</div>
                    <div style="font-weight:bold; font-size:1.4em; border-bottom:1px solid #000; padding-bottom:5px; margin-bottom:5px;">ALL ITEMS</div>
                    <div style="font-size:1.1em; font-weight:bold;">${dateStr} ${timeStr}</div>
                </div>
                
                <div class="kot-meta" style="border-bottom:1px solid #000; padding: 5px 0; margin-bottom:5px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>Section : REGULAR</span>
                    </div>
                     <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>Kot No. : ${order.id.slice(-4)}</span>
                        <span>Table No. : ${order.tableId}</span>
                    </div>
                </div>
                
                <table class="kot-table" style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid #000;">
                            <th style="text-align:left; padding:5px 0;">Item Name</th>
                            <th style="text-align:right; padding:5px 0;">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td style="padding:5px 0; font-weight:bold; font-size:1.2em;">${item.name}</td>
                                <td style="text-align:right; padding:5px 0; font-weight:bold; font-size:1.2em;">${item.qty}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                 <hr style="border-top:1px solid #000; margin-top:5px;">
            </div>
        `;
        
        this.executePrint(container, html);
    },

    // 2. Token / Coupon
    printCoupons(order) {
        // Reuse KOT logic or separate? User asked for Token. 
        // Let's make a simple Token per item.
        const container = document.getElementById('print-coupon');
        if (!container) return;
        
        const html = order.items.map(item => `
            <div class="thermal-ticket" style="page-break-after: always; text-align:center; padding:10px;">
                <h3 style="margin:0;">TOKEN</h3>
                <div style="font-size:2em; font-weight:bold; margin:10px 0;">${item.qty}</div>
                <div style="font-size:1.5em; font-weight:bold;">${item.name}</div>
                <div style="margin-top:10px;">Table: ${order.tableId}</div>
            </div>
        `).join('');
        
        this.executePrint(container, html);
    },

    // 3. Final Bill - Matches "GANESH BHEL" Image
    printBill(order) {
        const container = document.getElementById('print-bill');
        if (!container) return;

        const date = new Date();
        const dateStr = date.toLocaleDateString('en-GB').replace(/\//g, '-');
        const timeStr = date.toLocaleTimeString('en-GB', { hour12: true }); // 12:15:04 PM
        
        // Group items by Category (as seen in image: BHEL, PANI PURI, DOSAS etc)
        const categories = {};
        order.items.forEach(item => {
            const cat = item.type || 'OTHERS';
            if(!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });
        
        let itemsHtml = '';
        for(const cat in categories) {
            // Category Header
            itemsHtml += `
                <tr style="font-weight:bold; font-size:1.1em; text-transform:uppercase;">
                    <td colspan="4" style="padding-top:10px;">${cat}</td>
                </tr>
            `;
            // Items
            categories[cat].forEach(item => {
                const amt = (item.price * item.qty).toFixed(2);
                itemsHtml += `
                    <tr>
                        <td style="padding:2px 0;">${item.name}</td>
                        <td style="text-align:center;">${item.qty}</td>
                        <td style="text-align:right;">${item.price.toFixed(2)}</td>
                        <td style="text-align:right;">${amt}</td>
                    </tr>
                `;
            });
        }
        
        const total = order.totals.net.toFixed(2);

        const html = `
            <div class="thermal-ticket" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; max-width: 380px; margin: 0 auto;">
                <div style="border:1px solid #000; padding:10px;">
                    <div style="text-align:center; font-weight:bold; font-size:1.4em; text-transform:uppercase;">${this.shopName}</div>
                    <div style="text-align:center; font-size:0.9em; white-space:pre-wrap;">${this.shopAddress}</div>
                    
                    <div style="border-top:1px solid #000; margin-top:10px; padding-top:5px; font-weight:bold;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>BillNo : ${order.id.slice(-6)}</span>
                            <span>Date : ${dateStr}</span>
                        </div>
                        <div style="margin-top:2px;">Time : ${timeStr}</div>
                    </div>
                    
                    <div style="border-top:1px solid #000; border-bottom:1px solid #000; margin:5px 0; padding:5px 0; font-weight:bold;">
                        Section : REGULAR
                    </div>
                    
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid #000;">
                                <th style="text-align:left; width:50%;">ITEM</th>
                                <th style="text-align:center; width:10%;">QTY</th>
                                <th style="text-align:right; width:20%;">RATE</th>
                                <th style="text-align:right; width:20%;">AMT.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div style="border-top:1px solid #000; margin-top:10px; padding-top:5px; display:flex; justify-content:space-between; font-weight:bold; font-size:1.4em;">
                        <span>Net Total :</span>
                        <span>${total}</span>
                    </div>
                    
                    <div style="text-align:center; margin-top:15px; font-weight:bold;">
                        THANK YOU!!!<br>VISIT AGAIN
                    </div>
                </div>
            </div>
        `;

        this.executePrint(container, html);
    },
    
    // 4. Category Report (New) - Matches "Category Wise Report" Image
    printCategoryReport(summaryData) {
        // summaryData should be list of items sold today
        // We will construct this from state.history or a passed aggregate
        const container = document.getElementById('print-bill'); // Reuse bill container
        if (!container) return;
        
        const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        
        // Group by category
        const categories = {};
        let grandTotal = 0;
        
        summaryData.forEach(item => {
            const cat = item.type || 'OTHERS';
            if(!categories[cat]) categories[cat] = { items: [], total: 0 };
            
            // Check if item already exists in cat (aggregate)
            const existing = categories[cat].items.find(i => i.name === item.name);
            if(existing) {
                existing.qty += item.qty;
                existing.amount += item.amount;
            } else {
                categories[cat].items.push({ name: item.name, qty: item.qty, price: item.price, amount: item.amount });
            }
            categories[cat].total += item.amount;
            grandTotal += item.amount;
        });
        
        let catsHtml = '';
        for(const cat in categories) {
             catsHtml += `
                <tr style="font-weight:bold; font-size:1.1em; background:#eee;">
                    <td colspan="4" style="padding-top:10px; text-transform:uppercase;">${cat}</td>
                </tr>
            `;
            categories[cat].items.forEach(i => {
                catsHtml += `
                    <tr>
                        <td style="padding:2px 0;">${i.name}</td>
                        <td style="text-align:center;">${i.qty}</td>
                        <td style="text-align:right;">${i.price}</td>
                        <td style="text-align:right;">${i.amount.toFixed(2)}</td>
                    </tr>
                `;
            });
            catsHtml += `
                 <tr style="font-weight:bold; border-top:1px dashed #000;">
                    <td colspan="3">Sub Total:-</td>
                    <td style="text-align:right;">${categories[cat].total.toFixed(2)}</td>
                </tr>
            `;
        }
        
        const html = `
            <div class="thermal-ticket" style="font-family: 'Courier New', Courier, monospace; max-width: 380px; margin: 0 auto;">
                 <div style="text-align:center; font-weight:bold; font-size:1.2em;">
                    Category Wise Report<br>
                    ${dateStr}<br>
                    TO<br>
                    ${dateStr}
                 </div>
                 <hr>
                 <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid #000;">
                            <th style="text-align:left;">Item Name</th>
                            <th style="text-align:center;">Qty</th>
                            <th style="text-align:right;">Price</th>
                            <th style="text-align:right;">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${catsHtml}
                    </tbody>
                 </table>
                 <hr>
                 <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.3em;">
                    <span>Total:-</span>
                    <span>${grandTotal.toFixed(2)}</span>
                 </div>
            </div>
        `;
        
        this.executePrint(container, html);
    },

    executePrint(container, html) {
        container.innerHTML = html;
        document.body.classList.add('printing-mode');
        container.style.display = 'block';
        
        // Ensure styles are applied before print
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-mode');
                container.style.display = 'none';
                container.innerHTML = '';
            }, 500);
        }, 300); // Increased delay for rendering
    }
};

window.Printer = Printer;
