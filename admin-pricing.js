document.addEventListener('alpine:init', () => {
    Alpine.data('adminPricingManager', () => ({
        // State Properties
        searchQuery: '',
        saving: false,
        toast: { 
            show: false, 
            message: '', 
            type: 'info' 
        },
        services: {},
        filteredServices: {},

        // Initialization Logic
        async init() {
            console.log('adminPricingManager initialized');
            await this.fetchPricingData();
            
            // Re-filter when search query changes
            this.$watch('searchQuery', () => {
                this.filterServices();
            });
        },

        // Fetch pricing from Supabase
        async fetchPricingData() {
            try {
                // Fetch services from your Supabase database table
                const { data, error } = await supabase
                    .from('services')
                    .select('*');

                if (error) throw error;

                // Transform array into a categorized/keyed object if needed, or store directly
                // Assuming data returns an array or structured object:
                if (Array.isArray(data)) {
                    const formatted = {};
                    data.forEach(item => {
                        formatted[item.id || item.key || item.name] = item;
                    });
                    this.services = formatted;
                } else if (data) {
                    this.services = data;
                } else {
                    this.services = {};
                }
                
                // Update filteredServices to render UI
                this.filterServices();
            } catch (err) {
                console.error('Error fetching services:', err);
                this.showToast(err.message || 'Failed to load services', 'error');
            }
        },

        // Filter Logic
        filterServices() {
            if (!this.searchQuery || !this.searchQuery.trim()) {
                this.filteredServices = { ...this.services };
                return;
            }
            
            const q = this.searchQuery.toLowerCase();
            const filtered = {};

            Object.keys(this.services).forEach(key => {
                const service = this.services[key];
                const nameMatch = service.name && service.name.toLowerCase().includes(q);
                const categoryMatch = service.category && service.category.toLowerCase().includes(q);
                const keyMatch = key.toLowerCase().includes(q);

                if (keyMatch || nameMatch || categoryMatch) {
                    filtered[key] = service;
                }
            });

            this.filteredServices = filtered;
        },

        // Save Changes to Supabase
        async saveChanges() {
            this.saving = true;
            try {
                // Convert back to array if your Supabase schema uses table rows
                const updates = Object.values(this.services);

                const { error } = await supabase
                    .from('services')
                    .upsert(updates);

                if (error) throw error;

                this.showToast('Pricing updated successfully!', 'success');
            } catch (err) {
                console.error('Error saving changes:', err);
                this.showToast(err.message || 'Failed to save changes', 'error');
            } finally {
                this.saving = false;
            }
        },

        // Toast Helper
        showToast(message, type = 'info') {
            this.toast = { show: true, message, type };
            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        }
    }));
});
