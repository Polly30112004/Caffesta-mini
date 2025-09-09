// cashier/js/home.js

let allDishes = [];
let allCustomers = [];

async function initHome() {
    console.log('Home page initialized');
    await loadTables();
    await loadDishes();
    await loadCustomers();
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

async function loadDishes() {
    try {
        const data = await SupabaseClient.getDishes();
        allDishes = data || [];
        console.log('Dishes loaded:', allDishes);
    } catch (error) {
        console.error('Ошибка загрузки блюд:', error);
        allDishes = [];
    }
}

async function loadCustomers() {
    try {
        const { data, error } = await SupabaseClient.getCustomers();
        if (error) throw error;
        allCustomers = data || [];
        console.log('Customers loaded:', allCustomers);
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
        allCustomers = [];
    }
}

function renderTables(count, activeOrders) {
    const grid = document.getElementById('tables-grid');
    if (!grid) {
        console.error('Tables grid not found!');
        return;
    }
    
    grid.innerHTML = '';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    
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
            if (e.target.classList.contains('complete-btn') || e.target.classList.contains('cancel-btn')) return;
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

async function findDishById(dishId) {
    // Сначала проверяем локальный кэш
    if (allDishes.length) {
        const dish = allDishes.find(d => d.id === dishId);
        if (dish) {
            console.log(`Dish found in cache: ${dish.name} (ID: ${dishId})`);
            return dish;
        }
    }

    // Если блюдо не найдено в кэше, делаем запрос к Supabase
    try {
        console.log(`Fetching dish with ID: ${dishId}`);
        const { data, error } = await SupabaseClient.getDishes().eq('id', dishId).single();
        if (error || !data) {
            console.warn(`Dish not found or error: ${error?.message || 'No data'}`);
            return { name: `Неизвестное блюдо (ID: ${dishId})`, price: 0 };
        }
        console.log(`Dish fetched from Supabase: ${data.name} (ID: ${dishId})`);
        return data;
    } catch (error) {
        console.error('Error fetching dish:', error);
        return { name: `Неизвестное блюдо (ID: ${dishId})`, price: 0 };
    }
}

async function showOrderReceipt(order) {
    try {
        console.log('Showing receipt for order:', order);
        
        // Если блюда не загружены, пытаемся загрузить их
        if (!allDishes.length) {
            console.warn('No dishes loaded, attempting to reload');
            await loadDishes();
        }
        
        // Если клиенты не загружены, пытаемся загрузить их
        if (!allCustomers.length) {
            console.warn('No customers loaded, attempting to reload');
            await loadCustomers();
        }

        // Парсим id_dishes из заказа
        const dishIds = (order.id_dishes || '').split(',').filter(id => id.trim() !== '').map(id => parseInt(id));
        if (!dishIds.length) {
            console.warn('No valid dish IDs found in order:', order.id_dishes);
        }

        // Подсчитываем количество каждого блюда
        const dishCounts = {};
        dishIds.forEach(id => {
            if (!isNaN(id)) {
                dishCounts[id] = (dishCounts[id] || 0) + 1;
            } else {
                console.warn('Invalid dish ID:', id);
            }
        });

        // Получаем данные о блюдах
        const orderItems = await Promise.all(Object.entries(dishCounts).map(async ([dishId, quantity]) => {
            const dish = await findDishById(parseInt(dishId));
            const customer = allCustomers.find(c => c.id === order.id_customer) || null;
            return { dish, quantity, customer };
        }));

        // Генерируем HTML для чека
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
        <div class="receipt-content receipt-content-home">
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

async function completeOrder(orderId, tableNumber) {
    try {
        console.log(`Completing order ${orderId} for table ${tableNumber}`);
        const { data, error } = await SupabaseClient.updateOrderStatus(orderId, 'completed');
        if (error) throw error;
        console.log(`Order ${orderId} completed successfully`);
        await loadTables(); // Перерисовываем столы
    } catch (error) {
        console.error('Ошибка завершения заказа:', error);
        alert('Ошибка при завершении заказа');
    }
}

async function cancelOrder(orderId, tableNumber, customerId) {
    try {
        console.log(`Canceling order ${orderId} for table ${tableNumber}`);
        await SupabaseClient.deleteOrder(orderId);
        console.log(`Order ${orderId} canceled successfully`);
        await loadTables(); // Перерисовываем столы
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        alert('Ошибка при отмене заказа');
    }
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
