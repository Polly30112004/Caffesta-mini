// cashier/js/supabase-client.js
const SUPABASE_URL = 'https://iixqxefjcnbxfvkweddr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHF4ZWZqY25ieGZ2a3dlZGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDA5OTUsImV4cCI6MjA3MjM3Njk5NX0.W1Nr0JNEe80ITCMcudZLTBjAVPNRa7ERB0i39jNUnZM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

class SupabaseClient {
    static async getDishes() {
        const { data, error } = await supabase
            .from('dishes')
            .select('*')
            .eq('available_for_sale', true);
        if (error) throw error;
        return data;
    }

    static async searchDishes(searchTerm) {
        const { data, error } = await supabase
            .from('dishes')
            .select('*')
            .ilike('name', `%${searchTerm}%`)
            .eq('available_for_sale', true);
        if (error) throw error;
        return data;
    }

    static async getDishesByCategory(category) {
        const { data, error } = await supabase
            .from('dishes')
            .select('*')
            .eq('category', category)
            .eq('available_for_sale', true);
        if (error) throw error;
        return data;
    }

    static async getProducts() {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        return data;
    }

    static async getCustomers() {
        console.log('SupabaseClient.getCustomers: Initiating request');
        const { data, error } = await supabase.from('customers').select('*');
        console.log('SupabaseClient.getCustomers: Response', { data, error });
        if (error) throw error;
        return { data, error };
         
    }

    static async createOrder(orderData) {
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select();
        if (error) throw error;
        return data[0];
    }

    static async searchCustomers(searchTerm) {
        if (!searchTerm.trim()) return [];
        
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
            
            if (error) {
                console.log('ILIKE поиск не сработал, используем альтернативный метод');
                const { data: altData, error: altError } = await supabase
                    .from('customers')
                    .select('*');
                
                if (altError) throw altError;
                
                return altData.filter(customer => {
                    const phoneString = customer.phone.toString();
                    return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           phoneString.includes(searchTerm);
                });
            }
            return data;
        } catch (error) {
            console.error('Ошибка поиска клиентов:', error);
            return [];
        }
    }

    static async addCustomer(customerData) {
        try {
            const phoneExists = await this.checkPhoneExists(customerData.phone);
            if (phoneExists) {
                throw new Error('Клиент с таким телефоном уже существует');
            }

            const { data, error } = await supabase
                .from('customers')
                .insert([customerData])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Ошибка добавления клиента:', error);
            throw error;
        }
    }

 static async updateCustomer(customerData) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .update(customerData)
                .eq('id', customerData.id)
                .select();
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Ошибка обновления клиента:', error);
            throw error;
        }
    }

 static async deleteCustomer(id) {
        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Ошибка удаления клиента:', error);
            throw error;
        }
    }    

    static async deleteOrder(orderId) {
    try {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);
        if (error) throw error;
        console.log('Order deleted successfully:', orderId);
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        throw error;
    }
}

    static async incrementCustomerOrderCount(customerId) {
        try {
            const { data: customer, error: fetchError } = await supabase
                .from('customers')
                .select('promo')
                .eq('id', customerId)
                .single();
            
            if (fetchError) throw fetchError;

            const newPromoCount = (customer.promo || 0) + 1;
            
            const { error: updateError } = await supabase
                .from('customers')
                .update({ promo: newPromoCount })
                .eq('id', customerId);
            
            if (updateError) throw updateError;
            
            return newPromoCount;
        } catch (error) {
            console.error('Ошибка увеличения счетчика заказов:', error);
            throw error;
        }
    }

    static async checkPhoneExists(phone) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('phone')
                .eq('phone', phone)
                .maybeSingle();
            
            return !!data;
        } catch (error) {
            console.error('Ошибка проверки телефона:', error);
            return false;
        }
    }

 static async getTablesCount() {
        try {
            const { data, error } = await supabase
                .from('stuff')
                .select('tables')
                .limit(1); 
            if (error) throw error;
            return data.length > 0 ? data[0].tables || 12 : 12; 
        } catch (error) {
            console.error('Ошибка получения количества столов:', error);
            return 12;
        }
    }

    static async updateTablesCount(count) {
        const { error } = await supabase
            .from('stuff')
            .update({ tables: count })
            .eq('id', 1);
        if (error) throw error;
    }

static async getActiveOrders() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'active'); // Ищем заказы со статусом 'active'
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Ошибка получения активных заказов:', error);
            return [];
        }
    }

static async updateOrderStatus(orderId, status) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .select();
        console.log('Update response:', { data, error }); 
        return { data, error };
    } catch (error) {
        console.error('Supabase error:', error);
        return { error };
    }
}

}

window.SupabaseClient = SupabaseClient;