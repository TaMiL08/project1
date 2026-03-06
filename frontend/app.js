const API_BASE = '/api';
let emails = [];
let selectedEmailId = null;
let activeTab = 'Inbox';

// On load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    fetchEmails();
    initTabs();
});

function initTabs() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            activeTab = item.innerText.trim();
            renderEmailList();
        });
    });
}


function checkAuthStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        sessionStorage.setItem('gmail_access_token', token);
    }

    if (urlParams.get('auth') === 'success') {
        const btn = document.getElementById('auth-btn');
        btn.innerHTML = `<i class="fas fa-check"></i> Connected`;
        btn.style.color = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        // clear query param
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function fetchEmails() {
    try {
        const res = await fetch(`${API_BASE}/emails`);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.details || errorData.error || 'Failed to fetch emails');
        }
        emails = await res.json();
        renderEmailList();
    } catch (err) {
        console.error(err);
        document.getElementById('email-list').innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle" style="font-size:24px;margin-bottom:12px;"></i><br>
                <strong>Error:</strong> ${escapeHtml(err.message)}<br>
                <small style="display:block;margin-top:8px;color:rgba(255,255,255,0.6)">Is the database connected in Vercel settings?</small>
            </div>`;
    }
}

async function syncEmails() {
    const btn = document.getElementById('sync-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="loader" style="width:14px;height:14px;border-width:2px;display:inline-block;"></div> Syncing...`;
    btn.disabled = true;

    try {
        const token = sessionStorage.getItem('gmail_access_token');
        if (!token) {
            alert('Please connect your Gmail first.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const res = await fetch(`${API_BASE}/emails/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token })
        });

        const data = await res.json();

        if (res.ok) {
            const s = data.stats;
            fetchEmails();
            btn.innerHTML = `<i class="fas fa-check"></i> Synced (${s.inserted} new)`;
            console.log('Sync Stats:', s);
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        } else {
            throw new Error(data.details || data.error || 'Sync failed');
        }

    } catch (err) {
        console.error(err);
        btn.innerHTML = `<i class="fas fa-times"></i> Error`;
        alert(`Sync Error: ${err.message}`);
        setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
    }
}


function renderEmailList() {
    const listEl = document.getElementById('email-list');

    // Filtering logic based on active tab
    let filteredEmails = [];
    if (activeTab === 'Inbox') {
        filteredEmails = emails.filter(e => e.status === 'pending' || e.status === 'approved');
    } else if (activeTab === 'Approved') {
        filteredEmails = emails.filter(e => e.status === 'approved');
    } else if (activeTab === 'Sent') {
        filteredEmails = emails.filter(e => e.status === 'sent');
    }

    if (filteredEmails.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                <i class="fas fa-inbox" style="font-size:32px;margin-bottom:16px;"></i><br>
                Your ${activeTab.toLowerCase()} is empty.
            </div>`;
        return;
    }

    listEl.innerHTML = '';
    filteredEmails.forEach((email, index) => {
        const div = document.createElement('div');
        div.className = `email-item ${email.id === selectedEmailId ? 'selected' : ''}`;
        div.style.animationDelay = `${index * 0.05}s`;
        div.onclick = () => selectEmail(email.id);

        let statusClass = '';
        if (email.status === 'approved') statusClass = 'status-approved';
        if (email.status === 'sent') statusClass = 'status-sent';

        div.innerHTML = `
            <div class="email-header">
                <span class="email-sender">${escapeHtml(email.sender)}</span>
                <span class="email-status ${statusClass}">${email.status.toUpperCase()}</span>
            </div>
            <div class="email-subject">${escapeHtml(email.subject)}</div>
            <div class="email-summary">${escapeHtml(email.summary || 'Summary pending...')}</div>
        `;
        listEl.appendChild(div);
    });
}


function selectEmail(id) {
    selectedEmailId = id;
    renderEmailList();

    const email = emails.find(e => e.id === id);
    if (!email) return;

    const detailEl = document.getElementById('email-detail');

    let actionsHtml = '';
    if (email.status === 'pending') {
        actionsHtml = `
            <button class="btn btn-success" onclick="approveEmail('${email.id}')"><i class="fas fa-check"></i> Approve & Save</button>
            <button class="btn btn-outline" onclick="dismissEmail('${email.id}')" style="margin-left:8px; border-color:var(--text-secondary); color:var(--text-secondary);">
                <i class="fas fa-trash-alt"></i> Ignore
            </button>
         `;
    } else if (email.status === 'approved') {
        actionsHtml = `
            <button class="btn btn-primary" onclick="sendEmail('${email.id}')"><i class="fas fa-paper-plane"></i> Send Reply</button>
            <button class="btn btn-outline" onclick="dismissEmail('${email.id}')" style="margin-left:8px; border-color:var(--text-secondary); color:var(--text-secondary);">
                <i class="fas fa-trash-alt"></i> Ignore
            </button>
         `;
    } else if (email.status === 'ignored') {
        actionsHtml = `
            <span style="color:var(--text-secondary);"><i class="fas fa-eye-slash"></i> This email was ignored.</span>
            <button class="btn btn-outline" onclick="approveEmail('${email.id}')" style="margin-left:12px; font-size:12px; padding:4px 8px;">Restore</button>
         `;
    } else {
        actionsHtml = `
            <span style="color:var(--accent);"><i class="fas fa-check-circle"></i> Reply Sent successfully</span>
         `;
    }


    detailEl.innerHTML = `
        <div class="detail-header">
            <div class="detail-subject">${escapeHtml(email.subject)}</div>
            <div class="detail-meta">
                <span><strong>From:</strong> ${escapeHtml(email.sender)}</span>
                <span>${new Date(email.created_at).toLocaleString()}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 12px; font-weight: 500; color: var(--text-secondary);">Original Message</div>
        <div class="detail-body">${escapeHtml(email.body)}</div>

        <div class="ai-section">
            <div class="ai-header"><i class="fas fa-magic"></i> AI Suggested Reply</div>
            <textarea id="reply-text-${email.id}" class="reply-editor" ${email.status === 'sent' ? 'readonly' : ''}>${email.edited_reply || email.ai_reply || ''}</textarea>
            
            <div class="actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

async function approveEmail(id) {
    const replyText = document.getElementById(`reply-text-${id}`).value;
    try {
        const res = await fetch(`${API_BASE}/emails/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved', edited_reply: replyText })
        });
        if (res.ok) {
            const updated = await res.json();
            const idx = emails.findIndex(e => e.id === id);
            if (idx > -1) emails[idx] = updated;
            selectEmail(id); // re-render
        }
    } catch (err) {
        console.error(err);
        alert('Failed to approve');
    }
}

async function sendEmail(id) {
    const btn = event?.target || document.querySelector(`button[onclick*="${id}"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="loader" style="width:14px;height:14px;border-width:2px;display:inline-block;"></div> Sending...`;
    btn.disabled = true;

    try {
        const token = sessionStorage.getItem('gmail_access_token');
        const res = await fetch(`${API_BASE}/emails/${id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token })
        });

        if (res.ok) {
            const data = await res.json();
            const idx = emails.findIndex(e => e.id === id);
            if (idx > -1) emails[idx] = data.email;
            selectEmail(id);
            alert('Reply sent successfully!');
        } else {
            const err = await res.json();
            throw new Error(err.details || err.error || 'Failed to send');
        }
    } catch (err) {
        console.error(err);
        alert(`Failed to send: ${err.message}`);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


async function dismissEmail(id) {
    try {
        const res = await fetch(`${API_BASE}/emails/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ignored' })
        });
        if (res.ok) {
            const updated = await res.json();
            const idx = emails.findIndex(e => e.id === id);
            if (idx > -1) emails[idx] = updated;

            // Clear details if current selected is being ignored
            if (selectedEmailId === id) {
                selectedEmailId = null;
                document.getElementById('email-detail').innerHTML = `
                    <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                        <i class="fas fa-eye-slash" style="font-size:32px;margin-bottom:16px;"></i><br>
                        Email ignored.
                    </div>`;
            }
            renderEmailList();
        }
    } catch (err) {
        console.error(err);
        alert('Failed to dismiss email');
    }
}

function escapeHtml(unsafe) {
    return (unsafe || '').toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

