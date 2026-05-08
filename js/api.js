// ============================================================
// Total Bali CRM — API Layer (Google Sheets via Apps Script)
// ============================================================

const API = {
  _loading: false,
  _queue: [],

  // Show/hide loading indicator
  setLoading(state) {
    this._loading = state;
    const el = document.getElementById('conn-status');
    if (el) {
      el.textContent = state ? '⏳ Syncing...' : '🟢 Connected';
      el.style.color = state ? '#e67e22' : '#27ae60';
    }
  },

  setError(msg) {
    const el = document.getElementById('conn-status');
    if (el) { el.textContent = '🔴 ' + msg; el.style.color = '#c0392b'; }
  },

  // Core request method
  async request(action, data) {
    const url = CRM_CONFIG.API_URL + '?action=' + action + '&key=' + encodeURIComponent(CRM_CONFIG.API_KEY);
    this.setLoading(true);
    try {
      const opts = data
        ? { method: 'POST', headers: {'Content-Type':'text/plain'}, body: JSON.stringify(data) }
        : { method: 'GET' };
      const resp = await fetch(url, opts);
      const json = await resp.json();
      this.setLoading(false);
      if (json.error) { this.setError(json.error); throw new Error(json.error); }
      return json;
    } catch (err) {
      this.setLoading(false);
      if (err.message !== 'Unauthorized') this.setError('Offline');
      throw err;
    }
  },

  // ===== Data Fetching =====
  async getAll() {
    return this.request('getAll');
  },

  // ===== Enquiry CRUD =====
  async saveEnquiry(enquiry) {
    return this.request('saveEnquiry', enquiry);
  },

  async deleteEnquiry(id) {
    return this.request('deleteEnquiry', { id });
  },

  async moveStage(id, stage) {
    return this.request('moveStage', { id, stage });
  },

  // ===== Stay Details =====
  async saveStay(stayData) {
    return this.request('saveStay', stayData);
  },

  // ===== Activities =====
  async saveActivity(activity) {
    return this.request('saveActivity', activity);
  },

  async deleteActivity(id) {
    return this.request('deleteActivity', { id });
  },

  // ===== Archive =====
  async restoreArchive(id) {
    return this.request('restoreArchive', { id });
  },

  async deleteArchive(id) {
    return this.request('deleteArchive', { id });
  },

  async deleteAllStage(stage) {
    return this.request('deleteAllStage', { stage });
  },

  // ===== Email Status =====
  async updateEmailStatus(enquiryId, subject, status, sentBy) {
    return this.request('updateEmailStatus', { enquiryId, subject, status, sentBy });
  }
};
