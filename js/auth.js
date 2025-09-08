// js/auth.js
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageEl = document.getElementById('auth-message');

    loginBtn.addEventListener('click', handleLogin);

    function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showMessage('Заполните все поля', 'error');
            return;
        }

        // Проверка логина и пароля
        const users = {
            'admin': { password: 'admin123', redirect: 'admin/index.html' },
            'cashier': { password: 'cashier123', redirect: 'cashier/index.html' }
        };

        const user = users[username];
        
        if (user && user.password === password) {
            // Сохраняем в localStorage
            localStorage.setItem('user', JSON.stringify({
                username: username,
                role: username === 'admin' ? 'admin' : 'cashier'
            }));
            
            // Перенаправляем
            window.location.href = user.redirect;
        } else {
            showMessage('Неверные учетные данные', 'error');
        }
    }

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
    }
});