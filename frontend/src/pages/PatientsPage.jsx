import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import {
  GlassCard,
  Button,
  FormField,
  NoticeBanner,
  LoadingState,
  ErrorState,
} from '../components/UI';
import { patientsApi } from '../api/client';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'prefer_not_to_say',
  email: '',
  phone: '',
  address: '',
  blood_type: '',
  allergies: '',
  medications: '',
  notes: '',
};

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal state
  const [deletingPatient, setDeletingPatient] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPatients = useCallback(async (targetPage = page, searchQuery = activeSearch) => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientsApi.list({
        page: targetPage,
        limit: 8,
        search: searchQuery || undefined,
      });
      setPatients(res.data?.patients || []);
      setPagination(res.data?.pagination || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, activeSearch]);

  useEffect(() => {
    loadPatients(page, activeSearch);
  }, [loadPatients, page, activeSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setPage(1);
    setActiveSearch('');
  };

  const openCreateModal = () => {
    setEditingPatient(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setFormData({
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || 'prefer_not_to_say',
      email: patient.email || '',
      phone: patient.phone || '',
      address: patient.address || '',
      blood_type: patient.blood_type || '',
      allergies: patient.allergies || '',
      medications: patient.medications || '',
      notes: patient.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validatePatientForm = () => {
    const errs = {};
    if (!formData.first_name.trim()) {
      errs.first_name = 'First name is required.';
    }
    if (!formData.last_name.trim()) {
      errs.last_name = 'Last name is required.';
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(formData.date_of_birth.trim())) {
      errs.date_of_birth = 'Date of birth must be in YYYY-MM-DD format.';
    }
    if (!['male', 'female', 'other', 'prefer_not_to_say'].includes(formData.gender)) {
      errs.gender = 'Please select a valid gender option.';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (formData.phone.trim() && !/^[0-9+\-() .]{7,25}$/.test(formData.phone.trim())) {
      errs.phone = 'Phone must be 7–25 characters (digits, +, -, spaces, parentheses).';
    }
    return errs;
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (saving) return;

    const clientErrors = validatePatientForm();
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      return;
    }

    setFormErrors({});
    setSaving(true);

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth.trim(),
        gender: formData.gender,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        blood_type: formData.blood_type || null,
        allergies: formData.allergies.trim() || null,
        medications: formData.medications.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (editingPatient) {
        await patientsApi.update(editingPatient.id, payload);
        setFeedback({
          variant: 'success',
          title: 'Demo Patient Updated',
          message: `Updated fictional record for ${payload.first_name} ${payload.last_name}.`,
        });
      } else {
        await patientsApi.create(payload);
        setFeedback({
          variant: 'success',
          title: 'Demo Patient Created',
          message: `Created fictional record for ${payload.first_name} ${payload.last_name}.`,
        });
      }

      setModalOpen(false);
      loadPatients(page, activeSearch);
    } catch (err) {
      if (Array.isArray(err.details)) {
        const fieldMap = {};
        err.details.forEach((d) => {
          fieldMap[d.field] = d.message;
        });
        setFormErrors({ ...fieldMap, _general: err.message });
      } else {
        setFormErrors({ _general: err.message || 'Failed to save patient record.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPatient || deleting) return;
    setDeleting(true);
    try {
      await patientsApi.remove(deletingPatient.id);
      setFeedback({
        variant: 'info',
        title: 'Demo Patient Deleted',
        message: `Removed fictional record #${deletingPatient.id} (${deletingPatient.first_name} ${deletingPatient.last_name}).`,
      });
      setDeletingPatient(null);
      loadPatients(1, activeSearch);
      setPage(1);
    } catch (err) {
      setFeedback({
        variant: 'danger',
        title: 'Delete Failed',
        message: err.message,
      });
      setDeletingPatient(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Demo Patient Records</h1>
          <p className="page-description">
            Create, search, update, and manage fictional patient profiles stored in SQLite.
          </p>
        </div>
        <Button variant="primary" icon={UserPlus} onClick={openCreateModal}>
          Add Demo Patient
        </Button>
      </div>

      <NoticeBanner variant="info" title="Demo-Only Fictional Records">
        All patient records in this system are strictly fictional for demonstration purposes. Do not enter real personal or protected health information (PHI).
      </NoticeBanner>

      {feedback && (
        <NoticeBanner variant={feedback.variant} title={feedback.title}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={15} />
            </button>
          </div>
        </NoticeBanner>
      )}

      {/* Search & Filter Bar */}
      <GlassCard style={{ marginBottom: '1.25rem', padding: '1.1rem 1.25rem' }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
        >
          <div style={{ display: 'flex', flex: '1 1 300px', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by first name, last name, email, or phone…"
              aria-label="Search demo patients"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button type="submit" variant="secondary" icon={Search}>
              Search
            </Button>
            {activeSearch && (
              <Button type="button" variant="secondary" onClick={handleClearSearch}>
                Clear
              </Button>
            )}
          </div>

          {pagination && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Showing <strong>{patients.length}</strong> of <strong>{pagination.total}</strong> demo records
            </div>
          )}
        </form>
      </GlassCard>

      {/* Patients Table */}
      {loading ? (
        <LoadingState label="Loading fictional patient records from SQLite…" />
      ) : error ? (
        <ErrorState
          title="Failed to load patients"
          message={error.message}
          onRetry={() => loadPatients(page, activeSearch)}
        />
      ) : patients.length === 0 ? (
        <GlassCard style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Users size={36} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            {activeSearch ? `No Demo Patients Matching "${activeSearch}"` : 'No Demo Patient Records Found'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            {activeSearch
              ? 'Try clearing your search filter or adding a new fictional patient.'
              : 'Click "Add Demo Patient" above to create your first fictional patient record.'}
          </p>
          {activeSearch ? (
            <Button variant="secondary" onClick={handleClearSearch}>
              Reset Search Filter
            </Button>
          ) : (
            <Button variant="primary" icon={UserPlus} onClick={openCreateModal}>
              Add Demo Patient
            </Button>
          )}
        </GlassCard>
      ) : (
        <GlassCard style={{ padding: '1.25rem' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Demo Patient Name</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Blood Type</th>
                  <th>Email / Phone</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{p.id}</td>
                    <td>
                      <Link
                        to={`/patients/${p.id}`}
                        style={{ fontWeight: 600, color: 'var(--primary-hover)' }}
                      >
                        {p.first_name} {p.last_name}
                      </Link>
                      <span
                        className="badge badge-teal"
                        style={{ marginLeft: '0.5rem', fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
                      >
                        Demo
                      </span>
                    </td>
                    <td>{p.date_of_birth}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {p.gender.replace(/_/g, ' ')}
                    </td>
                    <td>
                      {p.blood_type ? (
                        <span className="badge badge-info">{p.blood_type}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      <div>{p.email || '—'}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{p.phone || ''}</div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Link
                          to={`/patients/${p.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          title="View Details"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => openEditModal(p)}
                          title="Edit Patient"
                        >
                          <Edit3 size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => setDeletingPatient(p)}
                          title="Delete Patient"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.total_pages > 1 && (
            <div className="pagination-bar">
              <span>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages}</strong> ({pagination.total} total)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  disabled={!pagination.has_prev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={!pagination.has_next}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="patient-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {editingPatient
                  ? `Edit Fictional Demo Patient #${editingPatient.id}`
                  : 'Create Fictional Demo Patient'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {formErrors._general && (
              <NoticeBanner variant="danger" title="Validation Error">
                {formErrors._general}
              </NoticeBanner>
            )}

            <form onSubmit={handleSavePatient} noValidate>
              <div className="form-grid-2">
                <FormField
                  label="First Name *"
                  id="patient-first-name"
                  type="text"
                  placeholder="e.g., Elena"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  error={formErrors.first_name}
                  required
                />
                <FormField
                  label="Last Name *"
                  id="patient-last-name"
                  type="text"
                  placeholder="e.g., Vance"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  error={formErrors.last_name}
                  required
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Date of Birth (YYYY-MM-DD) *"
                  id="patient-dob"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  error={formErrors.date_of_birth}
                  required
                />
                <FormField
                  label="Gender *"
                  id="patient-gender"
                  as="select"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  error={formErrors.gender}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </FormField>
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Demo Email (Optional)"
                  id="patient-email"
                  type="email"
                  placeholder="name@demo.example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={formErrors.email}
                />
                <FormField
                  label="Demo Phone (Optional)"
                  id="patient-phone"
                  type="text"
                  placeholder="+1-555-0100"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  error={formErrors.phone}
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Blood Type (Optional)"
                  id="patient-blood-type"
                  as="select"
                  value={formData.blood_type}
                  onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                  error={formErrors.blood_type}
                >
                  <option value="">— Select Blood Type —</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Fictional Address (Optional)"
                  id="patient-address"
                  type="text"
                  placeholder="101 Fictional Way, Demo City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  error={formErrors.address}
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Allergies (Optional)"
                  id="patient-allergies"
                  type="text"
                  placeholder="e.g., Penicillin (Demo), None"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  error={formErrors.allergies}
                />
                <FormField
                  label="Current Medications (Optional)"
                  id="patient-medications"
                  type="text"
                  placeholder="e.g., Vitamin D3 1000IU"
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  error={formErrors.medications}
                />
              </div>

              <FormField
                label="General Demo Notes (Optional)"
                id="patient-notes"
                as="textarea"
                rows={3}
                placeholder="Fictional background notes for this demo patient…"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                error={formErrors.notes}
              />

              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingPatient ? 'Save Changes' : 'Create Demo Patient'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPatient && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 id="delete-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>
                Confirm Demo Patient Deletion
              </h2>
              <button
                type="button"
                onClick={() => setDeletingPatient(null)}
                aria-label="Close confirmation modal"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Are you sure you want to permanently delete fictional demo patient{' '}
              <strong>
                {deletingPatient.first_name} {deletingPatient.last_name} (#{deletingPatient.id})
              </strong>
              ?
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Associated clinician notes will also be removed, and linked symptom checks will be anonymized.
            </p>
            <div className="modal-footer">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeletingPatient(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                icon={Trash2}
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
