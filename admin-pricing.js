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

        // Fetch pricing from Supabase or API
        async fetchPricingData() {
            try {
                // Example Supabase fetch logic:
                // const { data, error } = await supabase.from('services').select('*');
                // if (error) throw error;
                // this.services = data;
                
                this.filterServices();
            } catch (err) {
                this.showToast(err.message || 'Failed to load services', 'error');
            }
        },

        // Filter Logic
        filterServices() {
            if (!this.searchQuery.trim()) {
                this.filteredServices = { ...this.services };
                return;
            }
            
            const q = this.searchQuery.toLowerCase();
            const filtered = {};

            Object.keys(this.services).forEach(key => {
                const service = this.services[key];
                if (key.toLowerCase().includes(q) || (service.name && service.name.toLowerCase().includes(q))) {
                    filtered[key] = service;
                }
            });

            this.filteredServices = filtered;
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
