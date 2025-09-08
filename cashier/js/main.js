// cashier/js/main.js
let currentPage = 'home';

document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'cashier') {
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('current-user').textContent = user.username;
    setupNavigation();

    // Загружаем страницу на основе URL или по умолчанию 'home'
    const urlParams = new URLSearchParams(window.location.search);
    const pageFromUrl = urlParams.get('page');
    const page = pageFromUrl || 'home'; // Устанавливаем 'home' как значение по умолчанию
    loadPage(page);
});

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page && page !== currentPage) {
                currentPage = page;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadPage(page);
                // Обновляем URL без перезагрузки страницы
                history.pushState({ page }, '', `?page=${page}`);
            }
        });
    });

    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('user');
        window.location.href = '../index.html';
    });

    // Поддержка навигации "назад/вперед" в браузере
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.page) {
            currentPage = event.state.page;
            loadPage(event.state.page);
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`[data-page="${currentPage}"]`).classList.add('active');
        }
    });
}

async function loadPage(pageName) {
    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        document.getElementById('content-area').innerHTML = html;
        
        // Загружаем и инициализируем скрипт для страницы
        await loadPageScript(pageName);
        
    } catch (error) {
        showError(`Ошибка загрузки страницы: ${pageName}`);
    }
}

async function loadPageScript(pageName) {
    try {
        // Удаляем старый скрипт, если он существует
        const oldScript = document.querySelector(`script[data-page="${pageName}"]`);
        if (oldScript) oldScript.remove();

        // Создаем новый скрипт
        const script = document.createElement('script');
        script.src = `js/${pageName}.js`;
        script.dataset.page = pageName;
        document.body.appendChild(script);

        // Ждем загрузки скрипта
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: js/${pageName}.js`));
        });

        // Вызываем функцию инициализации страницы
        if (pageName === 'home' && typeof window.initHome === 'function') {
            await window.initHome();
        } else if (pageName === 'orders' && typeof window.initOrders === 'function') {
            await window.initOrders();
        } else if (pageName === 'customers' && typeof window.initCustomers === 'function') {
            await window.initCustomers();
        }
    } catch (error) {
        showError(`Ошибка загрузки скрипта для страницы: ${pageName}`);
    }
}

function showError(message) {
    document.getElementById('content-area').innerHTML = `
        <div class="error-message">
            <h3>${message}</h3>
            <button onclick="location.reload()">Перезагрузить</button>
        </div>
    `;
}

window.navigateTo = function(pageName) {
    const btn = document.querySelector(`[data-page="${pageName}"]`);
    if (btn) {
        btn.click();
    } else {
        if (pageName) {
            currentPage = pageName;
            loadPage(pageName);
            history.pushState({ page: pageName }, '', `?page=${pageName}`);
        }
    }
};