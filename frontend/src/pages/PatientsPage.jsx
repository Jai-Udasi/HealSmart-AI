import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
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
import { patientsApi, authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
  const { currentUser } = useAuth();
  const isDoctor = currentUser?.role === 'doctor';

  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Doctor assignment state for Patient owners
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [assigningDoctor, setAssigningDoctor] = useState(false);
  const [revokingDoctorId, setRevokingDoctorId] = useState(null);

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal state
  const [deletingPatient, setDeletingPatient] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPatients = useCallback(
    async (targetPage = page, searchQuery = activeSearch) => {
      setLoading(true);
      setError(null);
      try {
        const [res, docsRes] = await Promise.all([
          patientsApi.list({
            page: targetPage,
            limit: 8,
            search: searchQuery || undefined,
          }),
          authApi.listDoctors().catch(() => ({ data: { doctors: [] } })),
        ]);
        setPatients(res.data?.patients || []);
        setPagination(res.data?.pagination || null);
        setAvailableDoctors(docsRes.data?.doctors || []);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [page, activeSearch]
  );

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
    setFormData({
      ...EMPTY_FORM,
      email: currentUser?.email || '',
    });
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
        const res = await patientsApi.update(editingPatient.id, payload);
        if (res.data) {
          setPatients([res.data]);
        } else {
          loadPatients(page, activeSearch);
        }
        setFeedback({
          variant: 'success',
          title: 'Health Profile Updated',
          message: `Saved updated profile information for ${payload.first_name} ${payload.last_name}.`,
        });
      } else {
        const res = await patientsApi.saveMyProfile(payload);
        if (res.data) {
          setPatients([res.data]);
        } else {
          loadPatients(page, activeSearch);
        }
        setFeedback({
          variant: 'success',
          title: 'Health Profile Created',
          message: `Created health profile for ${payload.first_name} ${payload.last_name}.`,
        });
      }

      setModalOpen(false);
    } catch (err) {
      if (Array.isArray(err.details)) {
        const fieldMap = {};
        err.details.forEach((d) => {
          fieldMap[d.field] = d.message;
        });
        setFormErrors({ ...fieldMap, _general: err.message });
      } else {
        setFormErrors({ _general: err.message || 'Failed to save patient profile.' });
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
        title: 'Health Profile Deleted',
        message: `Removed profile #${deletingPatient.id} (${deletingPatient.first_name} ${deletingPatient.last_name}).`,
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

  const handleAssignDoctor = async (e, patientId) => {
    e.preventDefault();
    if (!selectedDoctorId || assigningDoctor) return;
    setAssigningDoctor(true);
    try {
      const res = await patientsApi.assignDoctor(patientId, Number(selectedDoctorId));
      setSelectedDoctorId('');
      if (res.data?.assigned_doctors) {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patientId ? { ...p, assigned_doctors: res.data.assigned_doctors } : p
          )
        );
      } else {
        loadPatients(page, activeSearch);
      }
      setFeedback({
        variant: 'success',
        title: 'Doctor Assigned',
        message: 'Granted doctor access to your health profile.',
      });
    } catch (err) {
      setFeedback({
        variant: 'danger',
        title: 'Assignment Failed',
        message: err.message,
      });
    } finally {
      setAssigningDoctor(false);
    }
  };

  const handleRevokeDoctor = async (patientId, doctorUserId, doctorLabel) => {
    if (revokingDoctorId) return;
    setRevokingDoctorId(doctorUserId);
    try {
      const res = await patientsApi.revokeDoctor(patientId, doctorUserId);
      if (res.data?.assigned_doctors) {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patientId ? { ...p, assigned_doctors: res.data.assigned_doctors } : p
          )
        );
      } else {
        loadPatients(page, activeSearch);
      }
      setFeedback({
        variant: 'info',
        title: 'Doctor Access Revoked',
        message: `Revoked access for ${doctorLabel}. They can no longer view your profile or notes.`,
      });
    } catch (err) {
      setFeedback({
        variant: 'danger',
        title: 'Revocation Failed',
        message: err.message,
      });
    } finally {
      setRevokingDoctorId(null);
    }
  };

  const myProfile = !isDoctor && patients.length > 0 ? patients[0] : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isDoctor ? 'Assigned Patients Directory' : 'My Health Profile & Care Team'}
          </h1>
          <p className="page-description">
            {isDoctor
              ? 'View and manage health records for patients who have explicitly assigned access to your doctor account.'
              : 'Manage your personal health profile stored in SQLite and control which doctors can access your record.'}
          </p>
        </div>
        {!isDoctor && !myProfile && !loading && (
          <Button variant="primary" icon={UserPlus} onClick={openCreateModal}>
            Create Health Profile
          </Button>
        )}
        {!isDoctor && myProfile && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={Edit3} onClick={() => openEditModal(myProfile)}>
              Edit Profile
            </Button>
            <Link to={`/patients/${myProfile.id}`} className="btn btn-primary">
              <Eye size={15} />
              <span>View Full Record &amp; Notes</span>
            </Link>
          </div>
        )}
      </div>

      <NoticeBanner variant="info" title="Privacy & Scope Notice">
        {isDoctor
          ? 'Doctor accounts can only view patient profiles that have been explicitly assigned by the patient owner. Revoked assignments immediately remove access.'
          : 'Your health profile is linked strictly to your authenticated account. Only you and doctors you explicitly assign can view your profile.'}
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

      {/* Doctor Search & Filter Bar */}
      {isDoctor && (
        <GlassCard style={{ marginBottom: '1.25rem', padding: '1.1rem 1.25rem' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flex: '1 1 300px', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search assigned patients by name, email, or phone…"
                aria-label="Search assigned patients"
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
                Showing <strong>{patients.length}</strong> of <strong>{pagination.total}</strong> assigned patients
              </div>
            )}
          </form>
        </GlassCard>
      )}

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Loading health profile data from SQLite…" />
      ) : error ? (
        <ErrorState
          title="Failed to load health profile data"
          message={error.message}
          onRetry={() => loadPatients(page, activeSearch)}
        />
      ) : !isDoctor ? (
        /* PATIENT VIEW: Single 1-to-1 Health Profile or Empty State */
        !myProfile ? (
          <GlassCard style={{ textAlign: 'center', padding: '2.75rem 1.5rem' }}>
            <Users size={38} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              No Health Profile Created Yet
            </h2>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                maxWidth: 520,
                margin: '0 auto 1.25rem',
              }}
            >
              Create your personal health profile to save your demographic details, allergies, and current medications, link symptom checks, and optionally grant access to an approved doctor.
            </p>
            <Button variant="primary" icon={UserPlus} onClick={openCreateModal}>
              Create My Health Profile
            </Button>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Saved Patient Profile Overview Card */}
            <GlassCard>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.9rem',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      {myProfile.first_name} {myProfile.last_name}
                    </h2>
                    <span className="badge badge-teal">Profile #{myProfile.id}</span>
                    {myProfile.blood_type && (
                      <span className="badge badge-info">Blood Type: {myProfile.blood_type}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Last updated: {myProfile.updated_at || myProfile.created_at}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link to={`/patients/${myProfile.id}`} className="btn btn-secondary">
                    <Eye size={14} />
                    <span>View Full Record</span>
                  </Link>
                  <Button variant="secondary" icon={Edit3} onClick={() => openEditModal(myProfile)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setDeletingPatient(myProfile)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div
                className="grid-cards"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Date of Birth
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{myProfile.date_of_birth}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Gender
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, textTransform: 'capitalize' }}>
                    {myProfile.gender.replace(/_/g, ' ')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Email
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.email || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Phone
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.phone || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Address
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.address || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Allergies
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.allergies || 'None recorded'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Current Medications
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.medications || 'None recorded'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Additional Health Notes
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {myProfile.notes || 'None'}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Doctor Assignment & Revocation Card */}
            <GlassCard>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                }}
              >
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <UserCheck size={19} color="var(--teal)" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                      Authorized Doctors ({(myProfile.assigned_doctors || []).length})
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Assigning a doctor grants them access to view your health profile, symptom check history, and author clinical notes. You can revoke access at any time.
                  </p>

                  {(myProfile.assigned_doctors || []).length === 0 ? (
                    <div
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-muted)',
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No doctors currently have access to your health profile.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {myProfile.assigned_doctors.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.6rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-solid)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '0.88rem' }}>
                              {doc.display_name || doc.email}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                marginLeft: '0.5rem',
                              }}
                            >
                              ({doc.email})
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            icon={UserX}
                            loading={revokingDoctorId === doc.id}
                            onClick={() =>
                              handleRevokeDoctor(
                                myProfile.id,
                                doc.id,
                                doc.display_name || doc.email
                              )
                            }
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          >
                            Revoke Access
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {availableDoctors.length > 0 && (
                  <form
                    onSubmit={(e) => handleAssignDoctor(e, myProfile.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      minWidth: 260,
                      background: 'var(--surface-muted)',
                      padding: '0.9rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <label
                      htmlFor="assign-doctor-select"
                      style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                    >
                      Grant Access to a Doctor
                    </label>
                    <select
                      id="assign-doctor-select"
                      className="form-select"
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                    >
                      <option value="">— Select Doctor —</option>
                      {availableDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.display_name || doc.email} ({doc.email})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="submit"
                      variant="teal"
                      disabled={!selectedDoctorId}
                      loading={assigningDoctor}
                    >
                      Assign Doctor
                    </Button>
                  </form>
                )}
              </div>
            </GlassCard>
          </div>
        )
      ) : (
        /* DOCTOR VIEW: Assigned Patients Directory Table */
        patients.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <Users size={36} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              {activeSearch
                ? `No Assigned Patients Matching "${activeSearch}"`
                : 'No Patients Assigned to Your Account Yet'}
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
              {activeSearch
                ? 'Try clearing your search filter.'
                : 'Patients must explicitly assign your doctor account from their Health Profile before their records appear here.'}
            </p>
            {activeSearch && (
              <Button variant="secondary" onClick={handleClearSearch}>
                Reset Search Filter
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
                    <th>Patient Name</th>
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
                            title="View Clinical Record"
                          >
                            <Eye size={14} />
                            <span>View Record</span>
                          </Link>
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
        )
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-modal-title"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="patient-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {editingPatient
                  ? `Edit Health Profile #${editingPatient.id}`
                  : 'Create Your Health Profile'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
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
                  placeholder="Enter first name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  error={formErrors.first_name}
                  required
                />
                <FormField
                  label="Last Name *"
                  id="patient-last-name"
                  type="text"
                  placeholder="Enter last name"
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
                  label="Email (Optional)"
                  id="patient-email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={formErrors.email}
                />
                <FormField
                  label="Phone Number (Optional)"
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
                  label="Address (Optional)"
                  id="patient-address"
                  type="text"
                  placeholder="Street, City, State"
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
                  placeholder="e.g., Penicillin, Peanuts, None"
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
                label="Health Notes / Medical History Summary (Optional)"
                id="patient-notes"
                as="textarea"
                rows={3}
                placeholder="Enter relevant health background or notes…"
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
                  {editingPatient ? 'Save Changes' : 'Save Health Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPatient && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2
                id="delete-modal-title"
                style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}
              >
                Confirm Health Profile Deletion
              </h2>
              <button
                type="button"
                onClick={() => setDeletingPatient(null)}
                aria-label="Close confirmation modal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Are you sure you want to permanently delete health profile{' '}
              <strong>
                {deletingPatient.first_name} {deletingPatient.last_name} (#{deletingPatient.id})
              </strong>
              ?
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Associated doctor assignments and clinical notes will also be removed.
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
