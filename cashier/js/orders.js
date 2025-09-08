var currentOrder = {
    items: [],
    customer: null,
    total: 0,
    discount: 0,
    discountReason: '',
    table: null,
    existingOrder: null
};

allDishes = [];
allCustomers = [];
currentPage = 1;
dishesPerPage = 10;

async function initOrders() {
    const tableNumber = sessionStorage.getItem('currentTable');
    const savedOrder = sessionStorage.getItem('currentOrder');
    
    if (tableNumber) {
        document.getElementById('orders-title').textContent = `Заказ стола ${tableNumber}`;
        currentOrder.table = parseInt(tableNumber); 
    }
    
    if (savedOrder) {
        currentOrder.existingOrder = JSON.parse(savedOrder);
        loadExistingOrder(currentOrder.existingOrder);
    }
    
    await loadDishes();
    await loadCustomers();
    setupEventListeners();
}

async function loadDishes() {
    try {
        allDishes = await SupabaseClient.getDishes();
        displayDishes(allDishes);
        setupPagination();
    } catch (error) {
        console.error('Ошибка загрузки блюд:', error);
        document.getElementById('products-grid').innerHTML = '<div class="error">Ошибка загрузки блюд</div>';
    }
}

async function loadCustomers() {
    try {
        allCustomers = await SupabaseClient.getCustomers();
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
    }
}

function goBack() {
    sessionStorage.removeItem('currentTable');
    sessionStorage.removeItem('currentOrder');
    window.navigateTo('home');
}

function displayDishes(dishes = allDishes) {
    const grid = document.getElementById('products-grid');
    if (!grid) {
        console.error('Products grid not found!');
        return;
    }
    
    const start = (currentPage - 1) * dishesPerPage;
    const end = start + dishesPerPage;
    const paginatedDishes = dishes.slice(start, end);
    
    grid.innerHTML = paginatedDishes.map(dish => `
        <div class="product-card" data-id="${dish.id}">
            <h4>${dish.name}</h4>
            <div class="category">${dish.category}</div>
            <div class="price">${dish.price} руб.</div>
            <button class="add-btn" onclick="addToOrder(${dish.id})">Добавить</button>
        </div>
    `).join('');
}

function setupPagination() {
    const totalPages = Math.ceil(allDishes.length / dishesPerPage);
    const paginationContainer = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            ← Назад
        </button>
        <span class="page-info">Страница ${currentPage} из ${totalPages}</span>
        <button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Вперед →
        </button>
    `;
}

window.changePage = function(page) {
    const totalPages = Math.ceil(allDishes.length / dishesPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayDishes();
        setupPagination();
    }
};

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const customerSearch = document.getElementById('customer-search');
    const newCustomerBtn = document.getElementById('new-customer-btn');
    const printBtn = document.getElementById('print-btn');
    const clearCustomerBtn = document.getElementById('clear-customer-btn');

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchDishes(e.target.value);
        });
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            filterDishesByCategory(e.target.value);
        });
    }
    if (customerSearch) {
        customerSearch.addEventListener('input', function(e) {
            searchCustomers(e.target.value);
        });
    }
    if (newCustomerBtn) {
        newCustomerBtn.addEventListener('click', showNewCustomerModal);
    }
    if (printBtn) {
        printBtn.addEventListener('click', printReceipt);
    }
    if (clearCustomerBtn) {
        clearCustomerBtn.addEventListener('click', clearCustomer);
    }
}

async function addToOrder(dishId) {
    try {
        const dish = allDishes.find(d => d.id === dishId);
        if (!dish) {
            console.error('Dish not found:', dishId);
            return;
        }
        
        const existingItem = currentOrder.items.find(item => item.dish.id === dishId);
        
        if (existingItem) {
            existingItem.quantity++;
        } else {
            currentOrder.items.push({
                dish: dish,
                quantity: 1,
                price: dish.price
            });
        }
        
        updateOrderDisplay();
    } catch (error) {
        console.error('Ошибка добавления блюда:', error);
    }
}

function updateOrderDisplay() {
    const itemsList = document.getElementById('order-items-list');
    const totalElement = document.getElementById('total-amount');
    
    if (!itemsList || !totalElement) return;
    
    itemsList.innerHTML = currentOrder.items.map(item => `
        <div class="order-item">
            <span class="item-name">${item.dish.name}</span>
            <div class="item-controls">
                <button class="quantity-btn" onclick="changeQuantity(${item.dish.id}, -1)">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="changeQuantity(${item.dish.id}, 1)">+</button>
                <span class="item-price">${item.price * item.quantity} руб.</span>
                <button class="remove-btn" onclick="removeFromOrder(${item.dish.id})">✕</button>
            </div>
        </div>
    `).join('');
    
    currentOrder.total = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalElement.textContent = currentOrder.total;
    
    document.getElementById('print-btn').disabled = currentOrder.items.length === 0;
}

function calculateDiscounts(total, orderCount) {
    let discount = 0;
    let reason = '';
    const today = new Date();
    const isWednesday = today.getDay() === 3;

    if (orderCount === 9) {
        discount = total * 0.3;
        reason = 'Скидка 30% на 10 заказ';
    } else if (orderCount === 5) {
        discount = total * 0.2;
        reason = 'Скидка 20% на 6 заказ';
    } else if (orderCount === 2) {
        discount = total * 0.1;
        reason = 'Скидка 10% на 3 заказ';
    }

    if (isWednesday) {
        const wednesdayDiscount = total * 0.2;
        if (wednesdayDiscount > discount) {
            discount = wednesdayDiscount;
            reason = 'Скидка 20% за среду';
        }
    }

    return { discount: Math.round(discount), reason };
}

function changeQuantity(dishId, delta) {
    const item = currentOrder.items.find(item => item.dish.id === dishId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromOrder(dishId);
        } else {
            updateOrderDisplay();
        }
    }
}

window.removeFromOrder = function(dishId) {
    currentOrder.items = currentOrder.items.filter(item => item.dish.id !== dishId);
    updateOrderDisplay();
};

async function searchDishes(searchTerm) {
    if (searchTerm.trim() === '') {
        displayDishes(allDishes);
        return;
    }

    try {
        const foundDishes = await SupabaseClient.searchDishes(searchTerm);
        displayDishes(foundDishes);
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

async function filterDishesByCategory(category) {
    if (category === '') {
        displayDishes(allDishes);
        return;
    }

    try {
        const filteredDishes = await SupabaseClient.getDishesByCategory(category);
        displayDishes(filteredDishes);
    } catch (error) {
        console.error('Ошибка фильтрации:', error);
    }
}

async function searchCustomers(searchTerm) {
    const resultsContainer = document.getElementById('customer-results');
    
    if (searchTerm.trim() === '') {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
    }

    try {
        const foundCustomers = await SupabaseClient.searchCustomers(searchTerm);
        
        if (foundCustomers.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Клиенты не найдены</div>';
        } else {
            resultsContainer.innerHTML = foundCustomers.map(customer => `
                <div class="customer-result" onclick="selectCustomer(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                    <strong>${customer.name}</strong> - ${customer.phone}
                    ${customer.address ? `<br><small>${customer.address}</small>` : ''}
                </div>
            `).join('');
        }
        resultsContainer.classList.remove('hidden');
    } catch (error) {
        console.error('Ошибка поиска клиентов:', error);
        resultsContainer.innerHTML = '<div class="no-results">Ошибка поиска</div>';
        resultsContainer.classList.remove('hidden');
    }
}

window.selectCustomer = function(customer) {
    currentOrder.customer = customer;
    
    const customerSearch = document.getElementById('customer-search');
    customerSearch.value = `${customer.name} (${customer.phone})`;
    
    document.getElementById('customer-info').classList.remove('hidden');
    document.getElementById('customer-phone').textContent = customer.phone;
    document.getElementById('customer-address').textContent = customer.address || 'Не указан';
    
    const orderCountElement = document.getElementById('customer-order-count');
    if (orderCountElement) {
        orderCountElement.textContent = customer.promo || 0;
    }
    
    document.getElementById('customer-results').classList.add('hidden');
    
    updateOrderDisplay();
};

function clearCustomer() {
    currentOrder.customer = null;
    document.getElementById('customer-search').value = '';
    document.getElementById('customer-info').classList.add('hidden');
    document.getElementById('customer-results').classList.add('hidden');
}

function showNewCustomerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Добавить нового клиента</h3>
            <div class="form-group">
                <label>Имя: *</label>
                <input type="text" id="new-customer-name" required>
            </div>
            <div class="form-group">
                <label>Телефон: *</label>
                <input type="tel" id="new-customer-phone" required>
            </div>
            <div class="form-group">
                <label>Адрес:</label>
                <input type="text" id="new-customer-address">
            </div>
            <div class="modal-buttons">
                <button class="btn" onclick="saveNewCustomer()">Сохранить</button>
                <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closeModal = function() {
    document.querySelector('.modal')?.remove();
};

window.saveNewCustomer = async function() {
    const name = document.getElementById('new-customer-name').value.trim();
    const phone = document.getElementById('new-customer-phone').value.trim();
    const address = document.getElementById('new-customer-address').value.trim();

    if (!name || !phone) {
        alert('Заполните обязательные поля: имя и телефон');
        return;
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    if (cleanPhone.length < 7) {
        alert('Номер телефона слишком короткий');
        return;
    }

    try {
        const phoneExists = await SupabaseClient.checkPhoneExists(cleanPhone);
        if (phoneExists) {
            alert('Клиент с таким телефоном уже существует!');
            return;
        }

        const newCustomer = await SupabaseClient.addCustomer({
            name: name,
            phone: cleanPhone,
            address: address
        });

        allCustomers.push(newCustomer);
        selectCustomer(newCustomer);
        closeModal();
        alert('Клиент успешно добавлен!');
        
    } catch (error) {
        console.error('Ошибка сохранения клиента:', error);
        if (error.message.includes('уже существует')) {
            alert(error.message);
        } else {
            alert('Ошибка при сохранении клиента');
        }
    }
};

async function printReceipt() {
    if (currentOrder.items.length === 0) {
        alert('Добавьте товары в заказ');
        return;
    }

    try {
        const dishIds = currentOrder.items.flatMap(item => 
            Array(item.quantity).fill(item.dish.id)
        ).join(',');

        // Отладочный лог для проверки данных
        console.log('Current order data:', currentOrder);

        const orderData = {
            id_customer: currentOrder.customer ? currentOrder.customer.id : null,
            id_dishes: dishIds,
            price: currentOrder.total,
            status: currentOrder.table ? 'active' : 'completed',
            table_number: currentOrder.table || null,
            created_at: new Date().toISOString()
        };

        console.log('Order data sent to Supabase:', orderData);

        const newOrder = await SupabaseClient.createOrder(orderData);

        if (currentOrder.customer && currentOrder.customer.id) {
            try {
                const newPromoCount = await SupabaseClient.incrementCustomerOrderCount(currentOrder.customer.id);
                if (currentOrder.customer) {
                    currentOrder.customer.promo = newPromoCount;
                }
            } catch (error) {
                console.error('Не удалось обновить счетчик заказов:', error);
            }
        }

        const receiptContent = generateReceiptContent();
        printReceiptContent(receiptContent);

        // Сбрасываем текущий заказ и переходим на "Столы", если заказ привязан к столу
        currentOrder = { items: [], customer: null, total: 0, discount: 0, discountReason: '', table: null, existingOrder: null };
        updateOrderDisplay();
        clearCustomer();
        if (newOrder.table_number) {
            window.navigateTo('home'); // Переход на "Столы" если table_number задан
        }
    } catch (error) {
        console.error('Ошибка сохранения заказа:', error);
        alert('Ошибка при сохранении заказа');
    }
}

function generateReceiptContent() {
    const customer = currentOrder.customer;
    const today = new Date();
    const isWednesday = today.getDay() === 3;
    const orderCount = customer ? customer.promo || 0 : 0;
    
    return `
        <div style="font-family: Arial, sans-serif; max-width: 300px; margin: 0 auto; padding: 15px;">
            <h2 style="text-align: center; margin-bottom: 15px;">ЗАВЕДЕНИЕ Вилки&Ложки</h2>
            <p><strong>Дата:</strong> ${today.toLocaleString('ru-RU')}</p>
            <p style="color: #e74c3c; font-weight: bold;"> СРЕДА - СКИДКА 20%!</p>
            
            ${customer ? `
                <p><strong>Клиент:</strong> ${customer.name}</p>
                <p><strong>Телефон:</strong> ${customer.phone}</p>
                <p><strong>Адрес:</strong> ${customer.address || 'Не указан'}</p>
                <p><strong>Было заказов:</strong> ${orderCount}</p>
                ${orderCount === 2 ? '<p style="color: #27ae60;">▶ Следующий заказ получит 10% скидку!</p>' : ''}
                ${orderCount === 5 ? '<p style="color: #27ae60;">▶ Следующий заказ получит 20% скидку!</p>' : ''}
                ${orderCount === 9 ? '<p style="color: #27ae60;">▶ Следующий заказ получит 30% скидку!</p>' : ''}
            ` : '<p><strong>Клиент:</strong> Гость</p>'}
            
            <hr style="margin: 15px 0;">
            
            <h3 style="margin-bottom: 10px;">Заказ:</h3>
            ${currentOrder.items.map(item => `
                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                    <span>${item.dish.name} x${item.quantity}</span>
                    <span>${item.price * item.quantity} руб.</span>
                </div>
            `).join('')}
            ${currentOrder.discount > 0 ? `
                <hr style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; color: #27ae60;">
                    <span>${currentOrder.discountReason}:</span>
                    <span>-${currentOrder.discount} руб.</span>
                </div>
            ` : ''}
            
            <hr style="margin: 15px 0;">
            
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
                <span>ИТОГО:</span>
                <span>${currentOrder.total} руб.</span>
            </div>
            
            <p style="text-align: center; margin-top: 20px; color: #666;">Спасибо за заказ!</p>
        </div>
    `;
}

function printReceiptContent(content) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Чек</title>
                <style>
                    body { margin: 20px; font-family: Arial, sans-serif; }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function loadExistingOrder(order) {
    document.getElementById('order-items-list').innerHTML = 'Загрузка...';
}

window.initOrders = initOrders;