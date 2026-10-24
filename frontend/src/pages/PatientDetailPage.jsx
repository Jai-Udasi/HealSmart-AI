import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Edit3,
  Trash2,
  Stethoscope,
  FileText,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Clock,
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
import { patientsApi, symptomsApi, notesApi } from '../api/client';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const NOTE_TYPES = [
  { value: 'general', label: 'General Note' },
  { value: 'diagnosis', label: 'Assessment / Impression (Demo)' },
  { value: 'prescription', label: 'Medication Plan (Demo)' },
  { value: 'follow_up', label: 'Follow-Up Plan' },
  { value: 'lab_result', label: 'Lab / Test Summary (Demo)' },
];

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [symptomHistory, setSymptomHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Add Fictional Note Form State
  const [noteAuthor, setNoteAuthor] = useState('Dr. Attending (Fictional Demo)');
  const [noteType, setNoteType] = useState('general');
  const [noteContent, setNoteContent] = useState('');
  const [noteErrors, setNoteErrors] = useState({});
  const [addingNote, setAddingNote] = useState(false);

  // Edit Patient Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Confirmation Modal State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPatientData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const patientRes = await patientsApi.getById(id);
      setPatient(patientRes.data);

      const [symRes, notesRes] = await Promise.all([
        symptomsApi.history({ patient_id: id, page: 1, limit: 25 }),
        notesApi.list({ patient_id: id, page: 1, limit: 25 }),
      ]);
      setSymptomHistory(symRes.data?.checks || []);
      setNotes(notesRes.data?.notes || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const openEditModal = () => {
    if (!patient) return;
    setEditForm({
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
    setEditErrors({});
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (savingEdit) return;

    const errs = {};
    if (!editForm.first_name?.trim()) errs.first_name = 'First name is required.';
    if (!editForm.last_name?.trim()) errs.last_name = 'Last name is required.';
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(editForm.date_of_birth?.trim() || '')) {
      errs.date_of_birth = 'Date of birth must be YYYY-MM-DD.';
    }
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setEditErrors({});
    setSavingEdit(true);

    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        date_of_birth: editForm.date_of_birth.trim(),
        gender: editForm.gender,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        blood_type: editForm.blood_type || null,
        allergies: editForm.allergies.trim() || null,
        medications: editForm.medications.trim() || null,
        notes: editForm.notes.trim() || null,
      };
      const updated = await patientsApi.update(id, payload);
      setPatient(updated.data);
      setEditOpen(false);
      setFeedback({
        variant: 'success',
        title: 'Patient Record Updated',
        message: 'Successfully saved changes to this fictional patient record.',
      });
    } catch (err) {
      if (Array.isArray(err.details)) {
        const fieldMap = {};
        err.details.forEach((d) => {
          fieldMap[d.field] = d.message;
        });
        setEditErrors({ ...fieldMap, _general: err.message });
      } else {
        setEditErrors({ _general: err.message });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await patientsApi.remove(id);
      navigate('/patients');
    } catch (err) {
      setFeedback({
        variant: 'danger',
        title: 'Delete Failed',
        message: err.message,
      });
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (addingNote) return;

    const errs = {};
    if (!noteAuthor.trim() || noteAuthor.trim().length < 2) {
      errs.author = 'Author display name must be at least 2 characters.';
    }
    if (!noteContent.trim() || noteContent.trim().length < 3) {
      errs.content = 'Note content must be at least 3 characters.';
    }
    if (Object.keys(errs).length > 0) {
      setNoteErrors(errs);
      return;
    }

    setNoteErrors({});
    setAddingNote(true);

    try {
      const res = await notesApi.create({
        patient_id: Number(id),
        author: noteAuthor.trim(),
        note_type: noteType,
        content: noteContent.trim(),
      });
      setNotes((prev) => [res.data, ...prev]);
      setNoteContent('');
      setFeedback({
        variant: 'success',
        title: 'Fictional Clinician Note Added',
        message: 'Saved new demo note to SQLite.',
      });
    } catch (err) {
      if (Array.isArray(err.details)) {
        const fieldMap = {};
        err.details.forEach((d) => {
          fieldMap[d.field] = d.message;
        });
        setNoteErrors(fieldMap);
      } else {
        setNoteErrors({ content: err.message });
      }
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return <LoadingState label={`Loading demo patient record #${id}…`} />;
  }

  if (error || !patient) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/patients" className="btn btn-secondary">
            <ArrowLeft size={15} />
            <span>Back to Patient Records</span>
          </Link>
        </div>
        <GlassCard style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>
            {error?.status === 404 ? `Demo Patient #${id} Not Found` : 'Unable to Load Patient Record'}
          </h1>
          <p className="page-description" style={{ marginBottom: '1.25rem' }}>
            {error?.message || 'This fictional patient record may have been deleted or does not exist.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to="/patients" className="btn btn-primary">
              Return to Patient Directory
            </Link>
            {error?.status !== 404 && (
              <Button variant="secondary" onClick={loadPatientData}>
                Retry
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ marginBottom: '0.4rem' }}>
            <Link
              to="/patients"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Patient Records</span>
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 className="page-title">
              {patient.first_name} {patient.last_name}
            </h1>
            <span className="badge badge-teal">Demo Patient #{patient.id}</span>
            {patient.blood_type && (
              <span className="badge badge-info">Blood Type: {patient.blood_type}</span>
            )}
          </div>
          <p className="page-description">
            Fictional demonstration patient record · Created {patient.created_at}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={Edit3} onClick={openEditModal}>
            Edit Profile
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
            Delete Patient
          </Button>
        </div>
      </div>

      <NoticeBanner variant="info" title="Fictional Demonstration Patient Record">
        This profile and all associated notes or symptom checks are fictional demonstration records stored locally in SQLite. No real clinician has reviewed this information.
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

      {/* Demographic & Medical Overview Card */}
      <GlassCard style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <User size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Demographic & Medical Summary (Demo)
          </h2>
        </div>

        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.date_of_birth}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gender</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, textTransform: 'capitalize' }}>
              {patient.gender.replace(/_/g, ' ')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Demo Email</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.email || 'Not provided'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Demo Phone</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.phone || 'Not provided'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fictional Address</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.address || 'Not provided'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Allergies (Demo)</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.allergies || 'None recorded'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Medications (Demo)</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.medications || 'None recorded'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Profile Notes</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{patient.notes || 'None'}</div>
          </div>
        </div>
      </GlassCard>

      {/* Two-Column Section: Symptom Check History & Fictional Clinician Notes */}
      <div className="grid-2col" style={{ alignItems: 'start' }}>
        {/* Left Column: Associated Symptom Checks */}
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Stethoscope size={20} color="var(--primary)" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                Symptom Check History ({symptomHistory.length})
              </h2>
            </div>
            <Link to="/symptoms" className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
              New Check
            </Link>
          </div>

          {symptomHistory.length === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No symptom checks have been linked to this fictional patient yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {symptomHistory.map((chk) => {
                const isEm = chk.evaluation?.emergency_safety?.is_emergency_warning;
                return (
                  <div
                    key={chk.id}
                    style={{
                      background: 'var(--surface-solid)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.9rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Check #{chk.id}</span>
                        <span
                          className={`badge ${
                            chk.severity === 'severe'
                              ? 'badge-danger'
                              : chk.severity === 'moderate'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {chk.severity}
                        </span>
                        {isEm ? (
                          <span className="badge badge-danger">
                            <ShieldAlert size={12} />
                            Emergency Red Flag
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} />
                            Standard
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {chk.created_at}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                      <strong>Symptoms:</strong>{' '}
                      {Array.isArray(chk.symptoms) ? chk.symptoms.join(', ') : chk.symptoms}
                      {chk.duration && <span> · <strong>Duration:</strong> {chk.duration}</span>}
                    </div>

                    {chk.evaluation?.matched_categories?.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Matched Rules:</strong>{' '}
                        {chk.evaluation.matched_categories.map((c) => c.category).join(' • ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Right Column: Fictional Clinician Notes + Add Form */}
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <FileText size={20} color="var(--teal)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              Fictional Clinician Notes ({notes.length})
            </h2>
          </div>

          {/* Add Note Form */}
          <form
            onSubmit={handleAddNote}
            noValidate
            style={{
              background: 'var(--surface-muted)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
              Add Fictional Demo Note
            </div>
            <div className="form-grid-2">
              <FormField
                label="Fictional Author Name *"
                id="note-author"
                type="text"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                error={noteErrors.author}
              />
              <FormField
                label="Note Category *"
                id="note-type"
                as="select"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                error={noteErrors.note_type}
              >
                {NOTE_TYPES.map((nt) => (
                  <option key={nt.value} value={nt.value}>
                    {nt.label}
                  </option>
                ))}
              </FormField>
            </div>

            <FormField
              label="Demo Note Content *"
              id="note-content"
              as="textarea"
              rows={3}
              placeholder="Enter fictional clinical demonstration notes (e.g., advised hydration and rest)…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              error={noteErrors.content}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="teal" icon={Plus} loading={addingNote}>
                Add Fictional Note
              </Button>
            </div>
          </form>

          {/* Notes Timeline */}
          {notes.length === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No fictional clinician notes recorded for this patient yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{n.author}</strong>
                      <span className="badge badge-teal" style={{ textTransform: 'capitalize' }}>
                        {n.note_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {n.created_at}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.4rem', whiteSpace: 'pre-wrap' }}>
                    {n.content}
                  </p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {n.demo_label || 'FICTIONAL DEMO NOTE'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-detail-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="edit-detail-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                Edit Demo Patient #{patient.id}
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close modal"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {editErrors._general && (
              <NoticeBanner variant="danger" title="Validation Error">
                {editErrors._general}
              </NoticeBanner>
            )}

            <form onSubmit={handleSaveEdit} noValidate>
              <div className="form-grid-2">
                <FormField
                  label="First Name *"
                  id="edit-first-name"
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  error={editErrors.first_name}
                />
                <FormField
                  label="Last Name *"
                  id="edit-last-name"
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  error={editErrors.last_name}
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Date of Birth (YYYY-MM-DD) *"
                  id="edit-dob"
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  error={editErrors.date_of_birth}
                />
                <FormField
                  label="Gender *"
                  id="edit-gender"
                  as="select"
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </FormField>
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Demo Email"
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  error={editErrors.email}
                />
                <FormField
                  label="Demo Phone"
                  id="edit-phone"
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  error={editErrors.phone}
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Blood Type"
                  id="edit-blood-type"
                  as="select"
                  value={editForm.blood_type}
                  onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })}
                >
                  <option value="">— Select Blood Type —</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Fictional Address"
                  id="edit-address"
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <FormField
                  label="Allergies"
                  id="edit-allergies"
                  type="text"
                  value={editForm.allergies}
                  onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                />
                <FormField
                  label="Medications"
                  id="edit-medications"
                  type="text"
                  value={editForm.medications}
                  onChange={(e) => setEditForm({ ...editForm, medications: e.target.value })}
                />
              </div>

              <FormField
                label="Profile Notes"
                id="edit-notes"
                as="textarea"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />

              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={savingEdit}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-detail-modal-title">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 id="del-detail-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>
                Confirm Demo Patient Deletion
              </h2>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                aria-label="Close modal"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete fictional demo patient{' '}
              <strong>
                {patient.first_name} {patient.last_name} (#{patient.id})
              </strong>
              ?
            </p>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" loading={deleting} onClick={handleConfirmDelete}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
