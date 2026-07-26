const supabaseUrl = "https://kzxdxnxgouthsywbsnvl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eGR4bnhnb3V0aHN5d2JzbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTczMzIsImV4cCI6MjA4MTg5MzMzMn0.nqzn89vmTFKVNuZPHfGRxdTg6UHT6GMud238rr49qag";
const sb = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('alpine:init', () => {
    Alpine.data('verifyPage', () => ({
        loading: true,
        notFound: false,
        tech: null,

        async init() {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');
            if (!id) { this.loading = false; this.notFound = true; return; }

            try {
                const { data, error } = await sb
                    .from('technicians')
                    .select('tech_id, name, phone, category, experience, area, status, image_url, created_at, aadhaar, pan_card, police_verification_status')
                    .eq('tech_id', id)
                    .single();

                if (error || !data) { this.notFound = true; }
                else { this.tech = data; }
            } catch (err) {
                console.error(err);
                this.notFound = true;
            } finally {
                this.loading = false;
            }
        },

        maskedPhone() {
            if (!this.tech?.phone) return '-';
            const p = this.tech.phone;
            return p.slice(0, -4).replace(/\d/g, 'X') + p.slice(-4);
        },

        maskedAadhaar() {
            if (!this.tech?.aadhaar) return 'Not on file';
            const a = this.tech.aadhaar;
            return 'xxxx xxxx ' + a.slice(-4);
        },

        maskedPan() {
            if (!this.tech?.pan_card) return 'Not on file';
            const p = this.tech.pan_card;
            if (p.length <= 4) return p;
            return 'X'.repeat(p.length - 4) + p.slice(-4);
        },

        formattedDate() {
            if (!this.tech?.created_at) return '-';
            try {
                return new Date(this.tech.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch {
                return this.tech.created_at;
            }
        },

        policeStatusLabel() {
            const s = this.tech?.police_verification_status || 'pending';
            return s.charAt(0).toUpperCase() + s.slice(1);
        }
    }));
});
