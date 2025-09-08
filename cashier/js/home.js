// cashier/js/home.js
async function initHome() {
    console.log('Home page initialized');
    await loadTables();
}

async function loadTables() {
    try {
        console.log('Loading tables...');
        const tablesCount = await SupabaseClient.getTablesCount();
        console.log('Tables count from DB:', tablesCount);
        
        const activeOrders = await SupabaseClient.getActiveOrders();
        console.log('Active orders:', activeOrders);
        
        renderTables(tablesCount, activeOrders);
    } catch (error) {
        console.error('Ошибка загрузки столов:', error);
        renderTables(12, []);
    }
}

function renderTables(count, activeOrders) {
    const grid = document.getElementById('tables-grid');
    if (!grid) {
        console.error('Tables grid not found!');
        return;
    }
    
    grid.innerHTML = '';
    grid.style.display = 'grid'; // Восстанавливаем сетку
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))'; // Восстанавливаем колонки
    
    for (let i = 1; i <= count; i++) {
        const tableOrder = activeOrders.find(order => order.table_number === i);
        const status = tableOrder ? 'occupied' : 'free';
        
        const tableCard = document.createElement('div');
        tableCard.className = `table-card ${status}`;
        tableCard.innerHTML = `
            <div class="table-number">${i}</div>
            <div class="table-status">${status === 'occupied' ? 'Занят' : 'Свободен'}</div>
            ${status === 'occupied' ? `
                <div class="order-amount">${tableOrder.price} ₽</div>
                <div class="table-actions">
                    <button class="complete-btn" onclick="event.stopPropagation(); completeOrder(${tableOrder.id}, ${i});">Завершить заказ</button>
                    <button class="cancel-btn" onclick="event.stopPropagation(); cancelOrder(${tableOrder.id}, ${i}, ${tableOrder.id_customer});">Отменить заказ</button>
                </div>
            ` : ''}
        `;
        
        tableCard.addEventListener('click', (e) => {
            if (e.target.classList.contains('complete-btn') || e.target.classList.contains('cancel-btn')) return; // Игнорируем клик на кнопках
            handleTableClick(i, status, tableOrder);
        });
        grid.appendChild(tableCard);
    }
}

function handleTableClick(tableNumber, status, tableOrder) {
    if (status === 'occupied' && tableOrder) {
        showOrderReceipt(tableOrder);
    } else {
        console.log('Opening table for order:', tableNumber);
        sessionStorage.setItem('currentTable', tableNumber);
        window.navigateTo('orders');
    }
}

async function completeOrder(orderId, tableNumber) {
    console.log('Attempting to complete order:', orderId, tableNumber);
    try {
        const response = await SupabaseClient.updateOrderStatus(orderId, 'completed');
        console.log('Response from updateOrderStatus:', response); // Детальная отладка
        if (!response || (response.error && response.error.message)) {
            console.error('Ошибка обновления статуса заказа:', response?.error?.message || 'Неизвестная ошибка');
            throw new Error(response?.error?.message || 'Неизвестная ошибка');
        }
        console.log(`Order ${orderId} completed for table ${tableNumber}`);
        await loadTables();
    } catch (error) {
        console.error('Ошибка завершения заказа:', error);
        alert('Ошибка завершения заказа: ' + error.message);
    }
}

async function cancelOrder(orderId, tableNumber, customerId) {
    console.log('Attempting to cancel order:', orderId, tableNumber, 'for customer:', customerId);
    try {
        // Проверяем, является ли клиент гостем
        if (!customerId) {
            console.log('Canceling order for guest, promo will not be updated');
            await SupabaseClient.deleteOrder(orderId);
            await loadTables();
            return;
        }

        // Получаем текущего клиента
        const { data: customers, error: fetchError } = await SupabaseClient.getCustomers();
        if (fetchError) throw fetchError;

        const customer = customers.find(c => c.id === customerId);
        if (!customer) throw new Error('Клиент не найден');

        let newPromo = (customer.promo || 0) - 1;
        if (newPromo < 0) newPromo = 0;
        if (newPromo > 10) newPromo = 0; 

        // Обновляем promo клиента
        await SupabaseClient.updateCustomer({ id: customerId, promo: newPromo });

        // Удаляем заказ
        await SupabaseClient.deleteOrder(orderId);

        console.log(`Order ${orderId} canceled for table ${tableNumber}, customer promo updated to ${newPromo}`);
        await loadTables(); 
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        alert('Ошибка отмены заказа: ' + error.message);
    }
}

async function showOrderReceipt(order) {
    try {
        const allDishes = await SupabaseClient.getDishes();
        const allCustomers = await SupabaseClient.getCustomers();
        
        const dishCounts = {};
        order.id_dishes.split(',').forEach(id => {
            dishCounts[id] = (dishCounts[id] || 0) + 1;
        });
        
        const orderItems = Object.entries(dishCounts).map(([dishIdStr, quantity]) => {
            const dishId = parseInt(dishIdStr);
            const dish = allDishes.find(d => d.id === dishId);
            const customer = allCustomers.find(c => c.id === order.id_customer);
            return {
                dish: dish || { name: 'Неизвестное блюдо', price: 0 },
                quantity,
                customer
            };
        });
        
        const receiptContent = generateReceiptContentForOrder(orderItems, order);
        
        document.getElementById('content-area').innerHTML = receiptContent;
    } catch (error) {
        console.error('Ошибка показа чека:', error);
        document.getElementById('content-area').innerHTML = '<div class="error">Ошибка загрузки чека</div>';
    }
}

function generateReceiptContentForOrder(orderItems, order) {
    const customer = orderItems[0]?.customer;
    const today = new Date(order.created_at).toLocaleString('ru-RU');
    
    return `
        <div class="receipt-content receipt-content-home"> <!-- Специфический класс для вкладки "Столы" -->
            <div class="orders-header">
                <h2>Чек для стола ${order.table_number}</h2>
                <button class="back-btn" onclick="closeReceipt()">← Назад</button>
            </div>
            <div class="order-system">
                <div class="order-panel">
                    <div class="customer-section">
                        ${customer ? `
                            <h3>Клиент</h3>
                            <p><strong>${customer.name}</strong> - ${customer.phone}</p>
                            <p>Адрес: ${customer.address || 'Не указан'}</p>
                            <p>Заказов: ${customer.promo || 0}</p>
                        ` : '<h3>Клиент: Гость</h3>'}
                    </div>
                    <div class="order-items">
                        <h3>Заказ</h3>
                        ${orderItems.map(item => `
                            <div class="order-item">
                                <span class="item-name">${item.dish.name} x${item.quantity}</span>
                                <span class="item-price">${item.dish.price * item.quantity} руб.</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="order-summary">
                        <h3>Итого: <span>${order.price} руб.</span></h3>
                    </div>
                </div>
            </div>
            <p style="text-align: center; color: #666; margin-top: 20px;">Спасибо за заказ!</p>
        </div>
    `;
}

window.closeReceipt = function() {
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = '<div id="tables-grid"></div>'; 
        loadTables();
    } else {
        console.error('content-area not found!');
    }
};

window.completeOrder = completeOrder;
window.cancelOrder = cancelOrder; 

window.initHome = initHome;