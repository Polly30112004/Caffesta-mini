// cashier/js/customers.js

// Переменные состояния
 allCustomers = []; 
 currentPage = 1; 
 customersPerPage = 10; 
 isEditing = false;
 currentEditingCustomer = null;
 pendingAction = null;

// Элементы DOM
 customersTableBody = document.getElementById('customers-table-body');
 addCustomerBtn = document.getElementById('add-customer-btn');
 customerFormContainer = document.getElementById('customer-form-container');
 saveCustomerBtn = document.getElementById('save-customer-btn');
 cancelCustomerBtn = document.getElementById('cancel-customer-btn');
 customerNameInput = document.getElementById('customer-name');
 customerPhoneInput = document.getElementById('customer-phone');
 customerAddressInput = document.getElementById('customer-address');
 customerCountInput = document.getElementById('customer-count');
 formTitle = document.getElementById('form-title');
 searchInput = document.getElementById('search-input');
 searchBtn = document.getElementById('search-btn');
 paginationContainer = document.getElementById('pagination');

function createConfirmationDialog() {
    let dialog = document.getElementById('confirmation-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'confirmation-dialog';
        dialog.className = 'modal hidden';
        dialog.innerHTML = `
            <div class="modal-content">
                <h3>Подтверждение изменения</h3>
                <p id="confirmation-message">Вы уверены, что хотите внести эти изменения?</p>
                <div class="modal-buttons">
                    <button id="confirm-yes" class="btn">Да</button>
                    <button id="confirm-no" class="btn btn-secondary">Нет</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
    }
    return dialog;
}

async function initCustomers() {
    console.log('initCustomers: Starting initialization');
    const dialog = createConfirmationDialog();
    if (dialog) dialog.classList.add('hidden');
    await loadDataFromServer();
    setupEventListeners();
    setupPagination();
    console.log('initCustomers: Initialization complete');
}

async function loadDataFromServer() {
    console.log('loadDataFromServer: Loading customers data');
    try {
        const { data, error } = await SupabaseClient.getCustomers();
        if (error) throw error;
        allCustomers = data || [];
        console.log('loadDataFromServer: Customers loaded', allCustomers);
        displayCustomers(allCustomers);
    } catch (error) {
        console.error('loadDataFromServer: Error loading customers:', error);
        customersTableBody.innerHTML = '<tr><td colspan="5">Ошибка загрузки покупателей</td></tr>';
    }
}

function displayCustomers(customers = allCustomers) {
    console.log('displayCustomers: Displaying customers', customers);
    customersTableBody.innerHTML = '';

    const start = (currentPage - 1) * customersPerPage;
    const end = start + customersPerPage;
    const paginatedCustomers = customers.slice(start, end);

    if (paginatedCustomers.length === 0) {
        customersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных о покупателях</td></tr>';
        return;
    }

    paginatedCustomers.forEach(customer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.name || 'Нет имени'}</td>
            <td>${customer.phone || 'Нет телефона'}</td>
            <td>${customer.address || 'Не указан'}</td>
            <td>
                <div class="count-controls">
                    <button class="count-btn decrease-btn" data-id="${customer.id}">-</button>
                    <span class="count-value">${customer.promo !== null ? customer.promo : 0}</span>
                    <button class="count-btn increase-btn" data-id="${customer.id}">+</button>
                </div>
                ${customer.promo !== null && (customer.promo + 1) % 3 === 0 ? '<div class="promotion">На следующий заказ - акция!</div>' : ''}
            </td>
            <td>
                <button class="edit-btn" data-id="${customer.id}">Редактировать</button>
                <button class="delete-btn" data-id="${customer.id}">Удалить</button>
            </td>
        `;
        customersTableBody.appendChild(row);
    });

    attachEventHandlers();
}

function setupPagination() {
    console.log('setupPagination: Setting up pagination');
    const totalPages = Math.ceil(allCustomers.length / customersPerPage);
    if (paginationContainer) {
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
}

window.changePage = function(page) {
    console.log('changePage: Changing to page', page);
    const totalPages = Math.ceil(allCustomers.length / customersPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayCustomers();
        setupPagination();
    }
};

function setupEventListeners() {
    console.log('setupEventListeners: Setting up event listeners');
    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => showCustomerForm());
    if (saveCustomerBtn) saveCustomerBtn.addEventListener('click', saveCustomer);
    if (cancelCustomerBtn) cancelCustomerBtn.addEventListener('click', hideCustomerForm);
    if (customerPhoneInput) customerPhoneInput.addEventListener('input', validatePhoneInput);
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    const dialog = document.getElementById('confirmation-dialog');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');
    const confirmationMessage = document.getElementById('confirmation-message');

    if (confirmYesBtn) confirmYesBtn.addEventListener('click', confirmAction);
    if (confirmNoBtn) confirmNoBtn.addEventListener('click', cancelAction);
    if (dialog) dialog.addEventListener('click', (e) => e.target === dialog && cancelAction());
}

function validatePhoneInput(e) {
    let input = e.target.value;
    input = input.replace(/[^0-9]/g, '');
    if (input.length > 12) input = input.slice(0, -1);
    e.target.value = input;
    console.log('validatePhoneInput: Input value', input);
}

function isValidPhone(phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    console.log('isValidPhone: Checking phone', phone, 'Cleaned:', cleanPhone);
    return cleanPhone.length === 12;
}

function showCustomerForm(customer = null) {
    console.log('showCustomerForm: Showing form for customer', customer);
    isEditing = !!customer;
    currentEditingCustomer = customer;

    if (formTitle && customerNameInput && customerPhoneInput && customerAddressInput && customerCountInput) {
        formTitle.textContent = isEditing ? 'Редактировать покупателя' : 'Добавить нового покупателя';
        customerNameInput.value = customer ? customer.name || '' : '';
        customerPhoneInput.value = customer ? customer.phone || '' : '';
        customerAddressInput.value = customer ? customer.address || '' : '';
        customerCountInput.value = customer ? (customer.promo !== null ? customer.promo : 0) : '';
        customerFormContainer.classList.remove('hidden');
    }
}

function hideCustomerForm() {
    console.log('hideCustomerForm: Hiding form');
    if (customerFormContainer) customerFormContainer.classList.add('hidden');
    currentEditingCustomer = null;
}

async function saveCustomer() {
    console.log('saveCustomer: Attempting to save customer');
    const name = customerNameInput?.value.trim();
    const phone = customerPhoneInput?.value.trim();
    const address = customerAddressInput?.value.trim();
    const count = parseInt(customerCountInput?.value);

    console.log('saveCustomer: Input values - name:', name, 'phone:', phone, 'address:', address, 'count:', count, 'isNaN(count):', isNaN(count));

    // Обязательные поля: имя, телефон, количество заказов
    if (!name || !phone || isNaN(count)) {
        console.log('saveCustomer: Missing required fields');
        alert('Заполните обязательные поля: имя, телефон и количество заказов');
        return;
    }

    if (!isValidPhone(phone)) {
        console.log('saveCustomer: Invalid phone number');
        alert('Номер телефона должен содержать ровно 12 цифр');
        return;
    }

    const customerData = { name, phone, address: address || null, promo: count };

    if (isEditing && currentEditingCustomer) {
        customerData.id = currentEditingCustomer.id;
        displayConfirmationDialog('Вы уверены, что хотите изменить данные покупателя?', async () => {
            try {
                console.log('saveCustomer: Updating customer', customerData);
                const { data, error } = await SupabaseClient.updateCustomer(customerData);
                if (error) throw error;
                await loadDataFromServer();
                hideCustomerForm();
            } catch (error) {
                console.error('saveCustomer: Error updating customer:', error);
                alert('Ошибка при сохранении изменений: ' + error.message);
            }
        });
    } else {
        displayConfirmationDialog('Вы уверены, что хотите добавить нового покупателя?', async () => {
            try {
                console.log('saveCustomer: Adding new customer', customerData);
                const { data, error } = await SupabaseClient.addCustomer(customerData);
                if (error) throw error;
                await loadDataFromServer();
                hideCustomerForm();
            } catch (error) {
                console.error('saveCustomer: Error adding customer:', error);
                alert('Ошибка при добавлении покупателя: ' + error.message);
            }
        });
    }
}

function attachEventHandlers() {
    console.log('attachEventHandlers: Attaching event handlers');
    if (customersTableBody) {
        customersTableBody.removeEventListener('click', handleTableClick);
        customersTableBody.addEventListener('click', handleTableClick);
    }
}

function handleTableClick(event) {
    console.log('handleTableClick: Click event triggered on', event.target);
    const target = event.target;
    const id = target.dataset.id; 

    if (!id) {
        console.log('handleTableClick: No data-id found');
        return;
    }

    const customer = allCustomers.find(c => c.id.toString() === id); 
    if (!customer) {
        console.log('handleTableClick: Customer not found for id', id, 'allCustomers IDs:', allCustomers.map(c => c.id));
        return;
    }

    if (target.classList.contains('edit-btn')) {
        console.log('handleTableClick: Edit button clicked for customer', customer);
        showCustomerForm(customer);
    } else if (target.classList.contains('delete-btn')) {
        console.log('handleTableClick: Delete button clicked for customer', customer);
        deleteCustomer(id);
    } else if (target.classList.contains('count-btn')) {
        console.log('handleTableClick: Count button clicked for customer', customer, 'Increase:', target.classList.contains('increase-btn'));
        const isIncrease = target.classList.contains('increase-btn');
        changeCount(id, isIncrease ? 1 : -1);
    }
}

async function changeCount(id, delta) {
    console.log('changeCount: Changing count for id', id, 'by', delta);
    const customer = allCustomers.find(c => c.id.toString() === id);
    if (customer) {
        let newCount = (customer.promo || 0) + delta;
        if (newCount < 0) {
            console.log('changeCount: New count would be negative, aborted');
            return;
        }
        // Ограничиваем максимум 10 и обнуляем при превышении
        if (newCount > 10) {
            newCount = 0;
            console.log('changeCount: Promo count exceeded 10, resetting to 0');
        }

        try {
            console.log('changeCount: Updating customer with new count', newCount);
            const { data, error } = await SupabaseClient.updateCustomer({ id: parseInt(id), promo: newCount });
            if (error) throw error;
            await loadDataFromServer(); // Синхронизируем с БД
        } catch (error) {
            console.error('changeCount: Error updating count:', error);
            alert('Ошибка при обновлении количества заказов: ' + error.message);
        }
    }
}

async function deleteCustomer(id) {
    console.log('deleteCustomer: Deleting customer with id', id);
    const customer = allCustomers.find(c => c.id.toString() === id);
    if (!customer) return;
    displayConfirmationDialog('Вы уверены, что хотите удалить этого покупателя?', async () => {
        try {
            console.log('deleteCustomer: Confirming deletion');
            const result = await SupabaseClient.deleteCustomer(parseInt(id)); // Получаем результат
            if (result && result.error) throw result.error; // Проверяем наличие ошибки
            console.log('deleteCustomer: Deletion successful');
            // Обновляем allCustomers, удаляя клиента локально
            allCustomers = allCustomers.filter(c => c.id !== parseInt(id));
            await loadDataFromServer(); // Синхронизируем с БД
        } catch (error) {
            console.error('deleteCustomer: Error deleting customer:', error);
            alert('Ошибка при удалении покупателя: ' + (error.message || 'Неизвестная ошибка'));
        }
    });
}

function handleSearch() {
    console.log('handleSearch: Searching with term', searchInput?.value);
    const searchTerm = searchInput?.value.trim().toLowerCase();
    if (!searchTerm) {
        console.log('handleSearch: Search term empty, displaying all customers');
        displayCustomers(allCustomers);
        return;
    }

    const filteredCustomers = allCustomers.filter(customer => {
        const name = (customer.name || '').toLowerCase();
        const phone = (customer.phone || '').toString().toLowerCase();
        return name.includes(searchTerm) || phone.includes(searchTerm);
    });
    console.log('handleSearch: Filtered customers', filteredCustomers);
    displayCustomers(filteredCustomers);
}

function displayConfirmationDialog(message, callback) {
    console.log('displayConfirmationDialog: Showing dialog with message', message);
    const dialog = createConfirmationDialog();
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');
    const confirmationMessage = document.getElementById('confirmation-message');

    if (confirmationMessage && dialog) {
        confirmationMessage.textContent = message;
        dialog.classList.remove('hidden');
        pendingAction = callback;
    }
}

function confirmAction() {
    console.log('confirmAction: Confirming action');
    const dialog = document.getElementById('confirmation-dialog');
    if (dialog) dialog.classList.add('hidden');
    if (pendingAction && typeof pendingAction === 'function') pendingAction();
    pendingAction = null;
}

function cancelAction() {
    console.log('cancelAction: Canceling action');
    const dialog = document.getElementById('confirmation-dialog');
    if (dialog) dialog.classList.add('hidden');
    pendingAction = null;
}

// Экспорт для main.js
window.initCustomers = initCustomers;