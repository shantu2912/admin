/* =========================================================
   FixZenix Assist — Admin Assisted Booking & Operations
   ========================================================= */

const SUPABASE_URL = "https://kzxdxnxgouthsywbsnvl.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eGR4bnhnb3V0aHN5d2JzbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTczMzIsImV4cCI6MjA4MTg5MzMzMn0.nqzn89vmTFKVNuZPHfGRxdTg6UHT6GMud238rr49qag";

const sb = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

const inr = n =>
    '₹' + Number(n || 0).toLocaleString('en-IN');

const lc = s =>
    String(s || 'pending').toLowerCase();

const isToday = d =>
    d && new Date(d).toDateString() === new Date().toDateString();

const val = id =>
    $(id)?.value?.trim() || '';

const label = c =>
    String(c || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, x => x.toUpperCase());


/* =========================================================
   STATE
   ========================================================= */

let jobs = [];
let techs = [];
let customers = [];

let selectedCustomer = null;

let started = false;
let currentJob = null;

const DONE = [
    'completed',
    'done'
];

const ACTIVE = [
    'confirmed',
    'accepted',
    'assigned',
    'in_progress'
];


/* =========================================================
   TOAST
   ========================================================= */

function toast(msg, good = true) {

    const t = $('toast');

    if (!t) return;

    t.textContent = msg;

    t.className =
        `fixed top-20 right-4 z-[250] ${
            good ? 'bg-brand-olive' : 'bg-brand-red'
        } text-white text-sm font-bold px-4 py-3 rounded-xl shadow-xl max-w-sm`;

    clearTimeout(toast.t);

    toast.t = setTimeout(() => {
        t.classList.add('hidden');
    }, 4500);
}


/* =========================================================
   LIVE STATUS
   ========================================================= */

function setLive(ok) {

    if (!$('liveDot') || !$('liveText')) return;

    $('liveDot').className =
        'w-2 h-2 rounded-full ' +
        (ok ? 'bg-green-500' : 'bg-gray-300');

    $('liveText').textContent =
        ok ? 'Live' : 'Offline';
}


/* =========================================================
   STATUS BADGES
   ========================================================= */

function statusClass(s) {

    s = lc(s);

    if (s === 'completed' || s === 'done') {
        return 'bg-green-100 text-green-700';
    }

    if (s === 'cancelled') {
        return 'bg-red-100 text-red-700';
    }

    if (ACTIVE.includes(s)) {
        return 'bg-blue-100 text-blue-700';
    }

    return 'bg-yellow-100 text-yellow-800';
}


/* =========================================================
   TECHNICIANS
   ========================================================= */

async function loadTechs() {

    const {
        data,
        error
    } = await sb
        .from('technicians')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', {
            ascending: false
        });

    if (error) {

        console.error(error);

        toast(
            'Could not load technicians: ' + error.message,
            false
        );

        return;
    }

    techs = data || [];

    const technicianSelect = $('technician');

    if (!technicianSelect) return;

    technicianSelect.innerHTML =
        '<option value="">Dispatch through normal technician availability</option>' +

        techs.map(t => `
            <option value="${esc(t.id)}">
                ${esc(t.name || t.full_name || 'Unnamed')}
                · ${esc(t.category || 'Technician')}
                ${t.is_available === false ? ' · unavailable' : ''}
            </option>
        `).join('');
}


/* =========================================================
   JOBS
   ========================================================= */

async function loadJobs() {

    const {
        data,
        error
    } = await sb
        .from('jobs')
        .select('*')
        .order('created_at', {
            ascending: false
        })
        .limit(500);

    if (error) {

        toast(
            'Could not load jobs: ' + error.message,
            false
        );

        return;
    }

    jobs = (data || []).filter(j =>
        [
            'assisted_call',
            'whatsapp',
            'admin'
        ].includes(
            String(j.booking_source || '')
        )
    );

    renderQueue();
    renderKpis();
}


/* =========================================================
   KPI
   ========================================================= */

function renderKpis() {

    const today =
        jobs.filter(j => isToday(j.created_at));

    if ($('kToday')) {
        $('kToday').textContent = today.length;
    }

    if ($('kActive')) {
        $('kActive').textContent =
            jobs.filter(j =>
                ACTIVE.includes(lc(j.status))
            ).length;
    }

    const collected =
        today.reduce((sum, j) => {

            const amount =
                Number(
                    j.final_amount ||
                    j.customer_price ||
                    j.payable_amount ||
                    j.amount ||
                    0
                );

            const paid =
                String(
                    j.payment_status || ''
                ).toLowerCase() === 'paid';

            return sum + (paid ? amount : 0);

        }, 0);

    if ($('kCollected')) {
        $('kCollected').textContent =
            inr(collected);
    }
}


/* =========================================================
   QUEUE
   ========================================================= */

function renderQueue() {

    if (!$('queue')) return;

    const filter =
        $('queueFilter')?.value || 'all';

    const search =
        $('queueSearch')?.value
            .trim()
            .toLowerCase() || '';

    let arr = jobs
        .filter(j => {

            const s = lc(j.status);

            return (
                filter === 'all' ||

                (
                    filter === 'pending' &&
                    s === 'pending'
                ) ||

                (
                    filter === 'active' &&
                    ACTIVE.includes(s)
                ) ||

                (
                    filter === 'completed' &&
                    DONE.includes(s)
                )
            );
        })
        .filter(j => {

            if (!search) return true;

            return [
                j.customer_name,
                j.phone,
                j.category,
                j.issue,
                j.id
            ]
                .join(' ')
                .toLowerCase()
                .includes(search);
        });

    if ($('queueEmpty')) {
        $('queueEmpty').classList.toggle(
            'hidden',
            arr.length > 0
        );
    }

    $('queue').innerHTML =
        arr.slice(0, 150).map(j => {

            const tech =
                techs.find(t =>
                    String(t.id) ===
                    String(
                        j.tech_id ||
                        j.technician_id ||
                        j.assigned_to
                    )
                );

            const amount =
                Number(
                    j.final_amount ||
                    j.customer_price ||
                    j.payable_amount ||
                    j.amount ||
                    0
                );

            const technicianName =
                tech?.name ||
                tech?.full_name ||
                'Not assigned';

            const paymentStatus =
                String(
                    j.payment_status || ''
                ).toLowerCase();

            return `
                <button
                    data-open="${esc(j.id)}"
                    class="w-full text-left border border-brand-cream rounded-2xl p-4 hover:border-brand-gold hover:shadow-sm transition"
                >

                    <div class="flex justify-between gap-3">

                        <div class="min-w-0">

                            <div class="flex gap-2 items-center">

                                <span
                                    class="font-extrabold text-brand-olive truncate"
                                >
                                    ${esc(
                                        j.customer_name ||
                                        'Customer'
                                    )}
                                </span>

                                <span
                                    class="text-[10px] px-2 py-1 rounded-full ${statusClass(j.status)}"
                                >
                                    ${esc(
                                        label(
                                            j.status ||
                                            'pending'
                                        )
                                    )}
                                </span>

                            </div>

                            <p class="text-xs text-brand-dark/55 mt-1">

                                ${esc(
                                    j.category ||
                                    j.service ||
                                    'Service'
                                )}

                                ·

                                ${esc(
                                    j.phone || ''
                                )}

                            </p>

                        </div>


                        <div class="text-right shrink-0">

                            <div
                                class="font-extrabold text-brand-olive"
                            >
                                ${
                                    amount
                                        ? inr(amount)
                                        : '—'
                                }
                            </div>

                            <div
                                class="text-[10px] text-brand-dark/45"
                            >
                                ${
                                    paymentStatus === 'paid'
                                        ? 'PAID'
                                        : 'PAYMENT PENDING'
                                }
                            </div>

                        </div>

                    </div>


                    <div
                        class="mt-3 text-xs text-brand-dark/65 line-clamp-2"
                    >
                        ${esc(
                            j.issue ||
                            'No issue description'
                        )}
                    </div>


                    <div
                        class="mt-3 pt-3 border-t border-brand-cream/70 flex justify-between text-[11px]"
                    >

                        <span>

                            <i
                                class="fa-solid fa-user-gear mr-1"
                            ></i>

                            ${esc(
                                technicianName
                            )}

                        </span>

                        <span>

                            ${
                                j.created_at
                                    ? new Date(
                                        j.created_at
                                      ).toLocaleString(
                                        'en-IN',
                                        {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }
                                      )
                                    : ''
                            }

                        </span>

                    </div>

                </button>
            `;
        })
        .join('');
}


/* =========================================================
   CUSTOMER SEARCH
   ========================================================= */

async function findCustomers() {

    const p =
        val('phone').replace(/\D/g, '');

    if (p.length < 7) {

        toast(
            'Enter a valid phone number first',
            false
        );

        return;
    }

    if ($('customerResults')) {

        $('customerResults').innerHTML =
            '<p class="text-brand-dark/50">Searching…</p>';
    }

    if ($('customerModal')) {
        $('customerModal').classList.remove('hidden');
    }

    const {
        data,
        error
    } = await sb
        .from('profiles')
        .select('*')
        .ilike(
            'phone',
            `%${p.slice(-7)}%`
        )
        .limit(10);

    if (
        error ||
        !data ||
        !data.length
    ) {

        customers = [];

        if ($('customerResults')) {

            $('customerResults').innerHTML = `
                <p class="p-4 bg-brand-cream/60 rounded-xl">
                    No existing profile found.
                    Continue as a new assisted customer.
                </p>
            `;
        }

        return;
    }

    customers = data;

    $('customerResults').innerHTML =
        data.map((c, i) => `

            <button
                data-customer="${i}"
                class="w-full text-left p-4 rounded-xl bg-brand-cream/50 hover:bg-brand-cream"
            >

                <b>
                    ${esc(
                        c.full_name ||
                        c.name ||
                        c.username ||
                        'Customer'
                    )}
                </b>

                <div
                    class="text-xs text-brand-dark/55 mt-1"
                >

                    ${esc(
                        c.phone || ''
                    )}

                    ·

                    ${esc(
                        c.address ||
                        'No saved address'
                    )}

                </div>

            </button>

        `).join('');
}


/* =========================================================
   SELECT EXISTING CUSTOMER
   ========================================================= */

function chooseCustomer(i) {

    const c = customers[i];

    if (!c) return;

    /*
       IMPORTANT:
       Save the complete selected profile in memory.
       When the job is created, c.id will be written
       into jobs.user_id.
    */

    selectedCustomer = c;

    $('customerName').value =
        c.full_name ||
        c.name ||
        c.username ||
        '';

    $('phone').value =
        c.phone ||
        val('phone');

    if (c.address) {
        $('location').value =
            c.address;
    }

    if ($('customerHint')) {

        $('customerHint').textContent =
            'Existing customer loaded';
    }

    if ($('customerModal')) {
        $('customerModal').classList.add(
            'hidden'
        );
    }

    toast(
        'Existing customer selected'
    );
}


/* =========================================================
   STEP CONTROL
   ========================================================= */

function setStep(n) {

    [1, 2, 3].forEach(i => {

        if ($('panel' + i)) {

            $('panel' + i)
                .classList
                .toggle(
                    'hidden',
                    i !== n
                );
        }

        if ($('step' + i)) {

            $('step' + i).className =
                'w-8 h-8 rounded-full flex items-center justify-center ' +

                (
                    i < n
                        ? 'step-done'
                        : i === n
                            ? 'step-active'
                            : 'bg-brand-cream'
                );
        }

    });

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


/* =========================================================
   REVIEW
   ========================================================= */

function review() {

    if ($('reviewCustomer')) {
        $('reviewCustomer').textContent =
            val('customerName');
    }

    if ($('reviewPhone')) {
        $('reviewPhone').textContent =
            val('phone');
    }

    if ($('reviewService')) {
        $('reviewService').textContent =
            val('category');
    }

    if ($('reviewPriority')) {

        $('reviewPriority').textContent =
            $('urgent').value === 'true'
                ? 'URGENT'
                : 'Normal';
    }

    if ($('reviewVisit')) {

        $('reviewVisit').textContent =
            [
                val('preferredDate'),
                val('preferredTime')
            ]
                .filter(Boolean)
                .join(' · ') ||
            'As soon as available';
    }

    const t =
        techs.find(x =>
            String(x.id) ===
            String(val('technician'))
        );

    if ($('reviewTech')) {

        $('reviewTech').textContent =
            t?.name ||
            t?.full_name ||
            'Normal dispatch';
    }

    if ($('reviewLocation')) {
        $('reviewLocation').textContent =
            val('location');
    }

    if ($('reviewIssue')) {
        $('reviewIssue').textContent =
            val('issue');
    }
}


/* =========================================================
   VALIDATION
   ========================================================= */

function validate1() {

    const required = [
        'customerName',
        'phone',
        'category',
        'issue',
        'location'
    ];

    for (const id of required) {

        if (!val(id)) {

            toast(
                'Please complete all required customer fields',
                false
            );

            $(id)?.focus();

            return false;
        }
    }

    return true;
}


/* =========================================================
   CREATE ASSISTED JOB
   ========================================================= */

async function createJob(e) {

    e.preventDefault();

    if (!validate1()) {
        return;
    }

    if (!$('customerConsent')?.checked) {

        toast(
            'Customer confirmation is required',
            false
        );

        return;
    }

    const btn = $('createBtn');

    if (!btn) return;

    btn.disabled = true;

    btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Creating…';


    const tech =
        val('technician');


    /*
       Main assisted booking payload.
    */

    const payload = {

        customer_name:
            val('customerName'),

        phone:
            val('phone'),

        category:
            val('category'),

        issue:
            val('issue'),

        location:
            val('location'),

        status:
            tech
                ? 'assigned'
                : 'pending',

        urgent:
            $('urgent').value === 'true',

        booking_source:
            val('bookingChannel'),

        assist_notes:
            val('assistNotes'),

        preferred_date:
            val('preferredDate') ||
            null,

        preferred_time:
            val('preferredTime') ||
            null,

        payment_status:
            'pending'
    };


    /*
       IMPORTANT:
       If an existing customer was selected,
       connect the job to profiles.id.
    */

    if (
        selectedCustomer &&
        selectedCustomer.id
    ) {

        payload.user_id =
            selectedCustomer.id;
    }


    /*
       Assign technician if selected.
    */

    if (tech) {
        payload.tech_id = tech;
    }


    /*
       First attempt:
       Normal tech_id schema.
    */

    let {
        data,
        error
    } = await sb
        .from('jobs')
        .insert(payload)
        .select()
        .single();


    /*
       Fallback:
       Some older FixZenix schemas use
       technician_id instead of tech_id.
    */

    if (
        error &&
        error.message &&
        error.message
            .toLowerCase()
            .includes('tech_id')
    ) {

        delete payload.tech_id;

        if (tech) {
            payload.technician_id =
                tech;
        }

        ({
            data,
            error
        } = await sb
            .from('jobs')
            .insert(payload)
            .select()
            .single());
    }


    /*
       If user_id is not present in the current
       jobs schema, retry without user_id.
    */

    if (
        error &&
        payload.user_id &&
        error.message &&
        error.message
            .toLowerCase()
            .includes('user_id')
    ) {

        delete payload.user_id;

        ({
            data,
            error
        } = await sb
            .from('jobs')
            .insert(payload)
            .select()
            .single());
    }


    /*
       Final error.
    */

    if (error) {

        console.error(
            'Assisted booking error:',
            error
        );

        toast(
            'Booking failed: ' +
            error.message,
            false
        );

        btn.disabled = false;

        btn.innerHTML =
            '<i class="fa-solid fa-plus mr-2"></i>Create & dispatch';

        return;
    }


    /*
       Success.
    */

    toast(
        'Assisted booking created successfully'
    );


    /*
       Reset customer selection.
    */

    selectedCustomer = null;


    /*
       Reset form.
    */

    $('assistForm').reset();

    if ($('customerHint')) {
        $('customerHint').textContent = '';
    }


    setStep(1);

    await loadJobs();


    /*
       Open the newly-created job.
    */

    if (data?.id) {
        openJob(data.id);
    }


    btn.disabled = false;

    btn.innerHTML =
        '<i class="fa-solid fa-plus mr-2"></i>Create & dispatch';
}


/* =========================================================
   OPEN JOB DRAWER
   ========================================================= */

function openJob(id) {

    const j =
        jobs.find(x =>
            String(x.id) ===
            String(id)
        );

    if (!j) return;

    currentJob = j;


    const techId =
        j.tech_id ||
        j.technician_id ||
        j.assigned_to ||
        '';


    const tech =
        techs.find(t =>
            String(t.id) ===
            String(techId)
        );


    const amount =
        Number(
            j.final_amount ||
            j.customer_price ||
            j.payable_amount ||
            j.amount ||
            0
        );


    $('drawerTitle').textContent =
        j.customer_name ||
        'Assisted job';


    $('drawerBody').innerHTML = `

        <div class="space-y-4">

            <!-- Job info -->

            <div class="grid grid-cols-2 gap-3">

                <div
                    class="bg-brand-cream/60 rounded-xl p-3"
                >

                    <p class="muted">
                        Job ID
                    </p>

                    <p
                        class="font-bold text-xs break-all"
                    >
                        ${esc(j.id)}
                    </p>

                </div>


                <div
                    class="bg-brand-cream/60 rounded-xl p-3"
                >

                    <p class="muted">
                        Source
                    </p>

                    <p class="font-bold">
                        ${esc(
                            label(
                                j.booking_source ||
                                'assisted'
                            )
                        )}
                    </p>

                </div>

            </div>


            <!-- Call customer -->

            <a
                href="tel:${esc(
                    String(
                        j.phone || ''
                    ).replace(
                        /[^\d+]/g,
                        ''
                    )
                )}"
                class="block text-center py-3 rounded-xl bg-brand-olive text-white font-bold"
            >

                <i
                    class="fa-solid fa-phone mr-2"
                ></i>

                Call ${esc(
                    j.customer_name ||
                    'customer'
                )}

            </a>


            <!-- Customer details -->

            <div class="space-y-2 text-sm">

                <p>

                    <span class="muted">
                        Service
                    </span>

                    <br>

                    <b>
                        ${esc(
                            j.category ||
                            j.service ||
                            '-'
                        )}
                    </b>

                </p>


                <p>

                    <span class="muted">
                        Problem
                    </span>

                    <br>

                    ${esc(
                        j.issue ||
                        '-'
                    )}

                </p>


                <p>

                    <span class="muted">
                        Location
                    </span>

                    <br>

                    ${esc(
                        j.location ||
                        '-'
                    )}

                </p>

            </div>


            <hr
                class="border-brand-cream"
            >


            <!-- Technician -->

            <div>

                <label class="label">
                    Assigned technician
                </label>

                <select
                    id="drawerTech"
                    class="field"
                >

                    <option value="">
                        Unassigned
                    </option>

                    ${techs.map(t => `

                        <option
                            value="${esc(t.id)}"
                            ${
                                String(t.id) ===
                                String(techId)
                                    ? 'selected'
                                    : ''
                            }
                        >

                            ${esc(
                                t.name ||
                                t.full_name ||
                                'Technician'
                            )}

                            ·

                            ${esc(
                                t.category ||
                                ''
                            )}

                        </option>

                    `).join('')}

                </select>


                <button
                    id="saveTech"
                    class="btn-secondary w-full mt-2"
                >
                    Save technician
                </button>

            </div>


            <!-- Status -->

            <div>

                <label class="label">
                    Job status
                </label>

                <select
                    id="drawerStatus"
                    class="field"
                >

                    <option>
                        pending
                    </option>

                    <option>
                        assigned
                    </option>

                    <option>
                        confirmed
                    </option>

                    <option>
                        in_progress
                    </option>

                    <option>
                        completed
                    </option>

                    <option>
                        cancelled
                    </option>

                </select>

            </div>


            <!-- Bill and payment -->

            <div class="grid grid-cols-2 gap-3">

                <div>

                    <label class="label">
                        Final bill
                    </label>

                    <input
                        id="drawerAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value="${amount || ''}"
                        class="field"
                    >

                </div>


                <div>

                    <label class="label">
                        Payment
                    </label>

                    <select
                        id="drawerPayment"
                        class="field"
                    >

                        <option value="pending">
                            Pending
                        </option>

                        <option value="paid">
                            Paid
                        </option>

                        <option value="cash">
                            Cash
                        </option>

                        <option value="upi">
                            UPI / QR
                        </option>

                    </select>

                </div>

            </div>


            <!-- Payment reference -->

            <div>

                <label class="label">
                    Payment reference
                </label>

                <input
                    id="drawerRef"
                    class="field"
                    placeholder="e.g. UTR / FZX-..."
                >

            </div>


            <!-- Commission preview -->

            <div
                class="rounded-2xl bg-brand-gold/10 p-4"
            >

                <p
                    class="text-xs text-brand-dark/55"
                >
                    Commission preview
                </p>


                <div
                    class="flex justify-between mt-2"
                >

                    <b>
                        Customer bill
                    </b>

                    <b id="commissionBill">
                        ${inr(amount)}
                    </b>

                </div>


                <div
                    class="flex justify-between text-sm mt-1"
                >

                    <span>
                        Technician 84.3%
                    </span>

                    <span id="techShare">
                        ${inr(amount * 0.843)}
                    </span>

                </div>


                <div
                    class="flex justify-between text-sm"
                >

                    <span>
                        FixZenix 15.7%
                    </span>

                    <span id="fzShare">
                        ${inr(amount * 0.157)}
                    </span>

                </div>

            </div>


            <!-- Save -->

            <button
                id="saveJob"
                class="btn-primary w-full"
            >

                <i
                    class="fa-solid fa-floppy-disk mr-2"
                ></i>

                Save job

            </button>

        </div>
    `;


    $('drawerStatus').value =
        j.status ||
        'pending';


    $('drawerPayment').value =
        j.payment_status ||
        'pending';


    /*
       Payment reference
    */

    if ($('drawerRef')) {

        $('drawerRef').value =
            j.payment_reference ||
            '';
    }


    /*
       Live commission calculation
    */

    $('drawerAmount')
        .addEventListener(
            'input',
            () => {

                const a =
                    Number(
                        $('drawerAmount').value ||
                        0
                    );

                $('commissionBill')
                    .textContent =
                    inr(a);

                $('techShare')
                    .textContent =
                    inr(a * 0.843);

                $('fzShare')
                    .textContent =
                    inr(a * 0.157);
            }
        );


    $('saveTech').onclick =
        () => saveTech(j.id);


    $('saveJob').onclick =
        () => saveJob(j.id);


    $('jobDrawer').classList.remove(
        'hidden'
    );
}


/* =========================================================
   SAVE TECHNICIAN
   ========================================================= */

async function saveTech(id) {

    const tid =
        val('drawerTech');


    let patch = {

        tech_id:
            tid || null,

        status:
            tid
                ? 'assigned'
                : 'pending'
    };


    let {
        error
    } = await sb
        .from('jobs')
        .update(patch)
        .eq('id', id);


    /*
       Older schema fallback.
    */

    if (
        error &&
        error.message &&
        error.message
            .toLowerCase()
            .includes('tech_id')
    ) {

        delete patch.tech_id;

        patch.technician_id =
            tid || null;


        ({
            error
        } = await sb
            .from('jobs')
            .update(patch)
            .eq('id', id));
    }


    if (error) {

        return toast(
            'Technician update failed: ' +
            error.message,
            false
        );
    }


    toast(
        'Technician assignment saved'
    );


    await loadJobs();

    openJob(id);
}


/* =========================================================
   SAVE JOB
   ========================================================= */

async function saveJob(id) {

    const amount =
        Number(
            $('drawerAmount').value ||
            0
        );

    const paid =
        $('drawerPayment').value;


    const patch = {

        status:
            $('drawerStatus').value,

        final_amount:
            amount || null,

        payment_status:
            paid,

        payment_reference:
            val('drawerRef') ||
            null
    };


    let {
        error
    } = await sb
        .from('jobs')
        .update(patch)
        .eq('id', id);


    /*
       Fallback for older schemas
       without final_amount/payment_reference.
    */

    if (
        error &&
        error.message &&
        error.message
            .includes('final_amount')
    ) {

        delete patch.final_amount;

        delete patch.payment_reference;


        ({
            error
        } = await sb
            .from('jobs')
            .update(patch)
            .eq('id', id));
    }


    if (error) {

        return toast(
            'Could not save job: ' +
            error.message,
            false
        );
    }


    toast(
        'Job updated'
    );


    await loadJobs();

    openJob(id);
}


/* =========================================================
   CLOSE DRAWER
   ========================================================= */

function closeDrawer() {

    if ($('jobDrawer')) {

        $('jobDrawer')
            .classList
            .add('hidden');
    }

    currentJob = null;
}


/* =========================================================
   START APPLICATION
   ========================================================= */

async function startApp() {

    if (started) return;

    started = true;

    setLive(false);


    /*
       Realtime jobs listener
    */

    sb
        .channel(
            'fixzenix-assist-live'
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'jobs'
            },
            p => {

                if (
                    p.eventType ===
                    'INSERT' &&

                    [
                        'assisted_call',
                        'whatsapp',
                        'admin'
                    ].includes(
                        String(
                            p.new.booking_source ||
                            ''
                        )
                    )
                ) {

                    toast(
                        'New assisted job created'
                    );
                }

                loadJobs();
            }
        )
        .subscribe(
            s =>
                setLive(
                    s === 'SUBSCRIBED'
                )
        );


    await Promise.all([
        loadTechs(),
        loadJobs()
    ]);
}


/* =========================================================
   FORM EVENTS
   ========================================================= */

if ($('toStep2')) {

    $('toStep2').onclick =
        () => {

            if (validate1()) {
                setStep(2);
            }
        };
}


if ($('back1')) {

    $('back1').onclick =
        () => setStep(1);
}


if ($('toStep3')) {

    $('toStep3').onclick =
        () => {

            if (
                !$('customerConsent')?.checked
            ) {

                return toast(
                    'Customer confirmation is required',
                    false
                );
            }

            review();

            setStep(3);
        };
}


if ($('back2')) {

    $('back2').onclick =
        () => setStep(2);
}


if ($('assistForm')) {

    $('assistForm').onsubmit =
        createJob;
}


if ($('findCustomerBtn')) {

    $('findCustomerBtn').onclick =
        findCustomers;
}


if ($('customerResults')) {

    $('customerResults').onclick =
        e => {

            const b =
                e.target.closest(
                    '[data-customer]'
                );

            if (b) {

                chooseCustomer(
                    Number(
                        b.dataset.customer
                    )
                );
            }
        };
}


if ($('customerClose')) {

    $('customerClose').onclick =
        () => {

            $('customerModal')
                ?.classList
                .add('hidden');
        };
}


if ($('customerBg')) {

    $('customerBg').onclick =
        () => {

            $('customerModal')
                ?.classList
                .add('hidden');
        };
}


if ($('queue')) {

    $('queue').onclick =
        e => {

            const b =
                e.target.closest(
                    '[data-open]'
                );

            if (b) {

                openJob(
                    b.dataset.open
                );
            }
        };
}


if ($('queueFilter')) {

    $('queueFilter').onchange =
        renderQueue;
}


if ($('queueSearch')) {

    $('queueSearch').oninput =
        renderQueue;
}


if ($('refreshBtn')) {

    $('refreshBtn').onclick =
        async () => {

            await loadTechs();

            await loadJobs();
        };
}


if ($('drawerClose')) {

    $('drawerClose').onclick =
        closeDrawer;
}


if ($('drawerBg')) {

    $('drawerBg').onclick =
        closeDrawer;
}


/* =========================================================
   GREETING
   ========================================================= */

const h =
    new Date().getHours();

if ($('greet')) {

    $('greet').textContent =
        (
            h < 12
                ? 'Good morning'
                : h < 17
                    ? 'Good afternoon'
                    : 'Good evening'
        ) + ', team';
}


/* =========================================================
   DATE MINIMUM
   ========================================================= */

if ($('preferredDate')) {

    $('preferredDate').min =
        new Date()
            .toISOString()
            .slice(0, 10);
}


/* =========================================================
   BOOT
   ========================================================= */

startApp();
