import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Plus,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Cpu,
  History,
  User,
} from 'lucide-react';
import {
  GlassCard,
  Button,
  FormField,
  NoticeBanner,
  LoadingState,
  ErrorState,
} from '../components/UI';
import { symptomsApi, patientsApi } from '../api/client';

const QUICK_SYMPTOMS = [
  'Fever',
  'Headache',
  'Dry cough',
  'Sore throat',
  'Fatigue',
  'Nausea',
  'Stomach discomfort',
  'Chest pain',
  'Shortness of breath',
];

export default function SymptomCheckerPage() {
  // Symptom form state
  const [symptoms, setSymptoms] = useState([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('mild');
  const [patientId, setPatientId] = useState('');

  // Form validation & submission state
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  // Demo patients dropdown state
  const [demoPatients, setDemoPatients] = useState([]);

  // History list state
  const [historyData, setHistoryData] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Load demo patients for optional linking
  useEffect(() => {
    patientsApi
      .list({ page: 1, limit: 100 })
      .then((res) => {
        setDemoPatients(res.data?.patients || []);
      })
      .catch(() => {
        // Non-blocking if patient list fails
      });
  }, []);

  // Load symptom check history
  const fetchHistory = async (pageToLoad = historyPage) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await symptomsApi.history({ page: pageToLoad, limit: 5 });
      setHistoryData(res.data?.checks || []);
      setHistoryPagination(res.data?.pagination || null);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(historyPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage]);

  const addSymptom = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed.length > 120) {
      setFormErrors((prev) => ({
        ...prev,
        symptoms: 'Each symptom must be 120 characters or fewer.',
      }));
      return;
    }
    if (symptoms.length >= 20) {
      setFormErrors((prev) => ({
        ...prev,
        symptoms: 'Maximum of 20 symptoms allowed per check.',
      }));
      return;
    }
    const exists = symptoms.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setSymptoms((prev) => [...prev, trimmed]);
    }
    setSymptomInput('');
    setFormErrors((prev) => ({ ...prev, symptoms: null }));
  };

  const removeSymptom = (target) => {
    setSymptoms((prev) => prev.filter((s) => s !== target));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSymptom(symptomInput);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate submission

    // Also include any pending typed text in symptomInput if user didn't press Enter
    let finalSymptoms = [...symptoms];
    const pendingTrimmed = symptomInput.trim();
    if (pendingTrimmed) {
      if (!finalSymptoms.some((s) => s.toLowerCase() === pendingTrimmed.toLowerCase())) {
        finalSymptoms.push(pendingTrimmed);
      }
      setSymptoms(finalSymptoms);
      setSymptomInput('');
    }

    const errors = {};
    if (finalSymptoms.length === 0) {
      errors.symptoms = 'Please add at least one symptom before submitting.';
    }
    if (duration && duration.trim().length > 100) {
      errors.duration = 'Duration cannot exceed 100 characters.';
    }
    if (!['mild', 'moderate', 'severe'].includes(severity)) {
      errors.severity = 'Severity must be mild, moderate, or severe.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      const payload = {
        symptoms: finalSymptoms,
        duration: duration.trim() || null,
        severity,
        patient_id: patientId ? Number(patientId) : null,
      };
      const res = await symptomsApi.check(payload);
      setResult(res.data);
      // Refresh history to page 1
      setHistoryPage(1);
      fetchHistory(1);
    } catch (err) {
      setSubmitError(err);
      if (Array.isArray(err.details)) {
        const fieldMap = {};
        err.details.forEach((d) => {
          const key = d.field.split('.')[0];
          fieldMap[key] = d.message;
        });
        setFormErrors(fieldMap);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const evaluation = result?.evaluation;
  const emergencySafety = evaluation?.emergency_safety;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Symptom Information Checker</h1>
          <p className="page-description">
            Deterministic rule-based health education, self-care guidance, and emergency red-flag awareness.
          </p>
        </div>
        <span className="badge badge-info">
          <Cpu size={13} />
          Rule-Based Engine (No AI/LLM)
        </span>
      </div>

      <NoticeBanner variant="warning" title="Non-Diagnostic Rule Engine — Educational Use Only">
        This tool uses a deterministic keyword-matching rule engine — <strong>not an artificial intelligence (AI) or large language model (LLM)</strong>. It provides general health education only, cannot diagnose conditions, and cannot reliably triage medical emergencies.
      </NoticeBanner>

      <div className="grid-2col" style={{ alignItems: 'start', marginBottom: '2rem' }}>
        {/* Left Column: Symptom Entry Form */}
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
            <Stethoscope size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Enter Symptoms</h2>
          </div>

          {submitError && (
            <NoticeBanner variant="danger" title="Submission Error">
              {submitError.message}
            </NoticeBanner>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Quick-Select Common Symptoms */}
            <div className="form-group">
              <span className="form-label">Quick-Add Common or Red-Flag Symptoms</span>
              <div className="chip-list">
                {QUICK_SYMPTOMS.map((label) => {
                  const isSelected = symptoms.some(
                    (s) => s.toLowerCase() === label.toLowerCase()
                  );
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`chip ${isSelected ? 'chip-selected' : ''}`}
                      onClick={() =>
                        isSelected
                          ? removeSymptom(
                              symptoms.find((s) => s.toLowerCase() === label.toLowerCase())
                            )
                          : addSymptom(label)
                      }
                    >
                      <span>{label}</span>
                      {isSelected ? <X size={13} /> : <Plus size={13} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Symptom Input */}
            <div className="form-group">
              <label htmlFor="symptom-input" className="form-label">
                Add Symptom Keyword or Phrase *
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="symptom-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g., fever, throbbing headache, sore throat..."
                  value={symptomInput}
                  onChange={(e) => setSymptomInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  maxLength={120}
                />
                <Button
                  type="button"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => addSymptom(symptomInput)}
                >
                  Add
                </Button>
              </div>
              {formErrors.symptoms && (
                <span className="form-error" role="alert">
                  {formErrors.symptoms}
                </span>
              )}
            </div>

            {/* Active Selected Symptoms List */}
            <div className="form-group">
              <span className="form-label">
                Selected Symptoms ({symptoms.length})
              </span>
              {symptoms.length === 0 ? (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-subtle)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No symptoms added yet. Click a quick-add chip above or type a symptom and click Add.
                </div>
              ) : (
                <div className="chip-list">
                  {symptoms.map((sym) => (
                    <span
                      key={sym}
                      className="chip chip-selected"
                      style={{ cursor: 'default' }}
                    >
                      <span>{sym}</span>
                      <button
                        type="button"
                        onClick={() => removeSymptom(sym)}
                        aria-label={`Remove ${sym}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          padding: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <FormField
                label="Symptom Severity *"
                id="symptom-severity"
                as="select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                error={formErrors.severity}
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </FormField>

              <FormField
                label="Duration (Optional)"
                id="symptom-duration"
                type="text"
                placeholder="e.g., 2 days, since morning"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                maxLength={100}
                error={formErrors.duration}
              />
            </div>

            <FormField
              label="Associate with Fictional Demo Patient (Optional)"
              id="symptom-patient"
              as="select"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              error={formErrors.patient_id}
            >
              <option value="">— Anonymous Demo Check (No Patient Linked) —</option>
              {demoPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} — {p.first_name} {p.last_name} ({p.gender}, DOB: {p.date_of_birth})
                </option>
              ))}
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => {
                  setSymptoms([]);
                  setSymptomInput('');
                  setDuration('');
                  setSeverity('mild');
                  setPatientId('');
                  setFormErrors({});
                  setSubmitError(null);
                }}
              >
                Reset Form
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                icon={Stethoscope}
              >
                {submitting ? 'Evaluating Rules…' : 'Check Symptoms'}
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Right Column: Evaluation Results Card */}
        <div>
          {!result ? (
            <GlassCard style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <Stethoscope size={36} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                No Symptom Check Submitted Yet
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Select or enter one or more symptoms on the left and click <strong>Check Symptoms</strong> to view matched categories, educational information, self-care guidance, and safety notices.
              </p>
            </GlassCard>
          ) : (
            <GlassCard>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Rule-Based Evaluation Result
                </h2>
                <span className="badge badge-teal">
                  Check #{result.id} · {result.severity.toUpperCase()}
                </span>
              </div>

              {/* Explicit Rule Engine Statement */}
              <div
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Cpu size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span>{evaluation?.engine_statement}</span>
              </div>

              {/* Emergency Safety Banner */}
              {emergencySafety?.is_emergency_warning ? (
                <div
                  className="alert-banner alert-danger"
                  role="alert"
                  style={{ borderWidth: 2, marginBottom: '1.1rem' }}
                >
                  <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                      {emergencySafety.headline}
                    </strong>
                    <p style={{ marginBottom: '0.5rem' }}>{emergencySafety.message}</p>
                    {emergencySafety.matched_emergency_categories?.length > 0 && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        Triggered Red Flags:{' '}
                        {emergencySafety.matched_emergency_categories
                          .map((c) => `${c.category} (${c.matched_terms.join(', ')})`)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <NoticeBanner variant="info" title={emergencySafety?.headline}>
                  {emergencySafety?.message}
                </NoticeBanner>
              )}

              {/* Matched Categories */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Matched Symptom Categories
                </h3>
                <div className="chip-list">
                  {evaluation?.matched_categories?.map((cat) => (
                    <span key={cat.id} className="badge badge-info">
                      {cat.category}
                      {cat.matched_keywords?.length > 0 && ` (${cat.matched_keywords.join(', ')})`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Educational Health Information */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  General Educational Health Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {evaluation?.educational_information?.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--surface-solid)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 0.9rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <strong style={{ display: 'block', color: 'var(--primary-hover)', marginBottom: '0.2rem' }}>
                        {item.category}
                      </strong>
                      <span>{item.information}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Self-Care Tips */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Non-Diagnostic Self-Care Information
                </h3>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {evaluation?.self_care_tips?.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>

              {/* When to Seek Professional Medical Advice */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={15} />
                  <span>When to Seek Professional Medical Advice</span>
                </h3>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {evaluation?.when_to_seek_medical_advice?.map((advice, idx) => (
                    <li key={idx}>{advice}</li>
                  ))}
                </ul>
              </div>

              {/* Medical Disclaimer Footer */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.75rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
              >
                <strong>Disclaimer:</strong> {result.disclaimer}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Symptom Check History Section */}
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <History size={20} color="var(--teal)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Recent Symptom Check History</h2>
          </div>
          {historyPagination && (
            <span className="badge badge-teal">Total Saved: {historyPagination.total}</span>
          )}
        </div>

        {historyLoading ? (
          <LoadingState label="Loading symptom check history…" />
        ) : historyError ? (
          <ErrorState
            title="Failed to load symptom history"
            message={historyError.message}
            onRetry={() => fetchHistory(historyPage)}
          />
        ) : historyData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No symptom checks recorded yet.
          </p>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Demo Patient</th>
                    <th>Symptoms</th>
                    <th>Severity</th>
                    <th>Duration</th>
                    <th>Safety Status</th>
                    <th>Date (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((item) => {
                    const isEmergency = item.evaluation?.emergency_safety?.is_emergency_warning;
                    return (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>
                          {item.patient_id ? (
                            <Link to={`/patients/${item.patient_id}`} style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <User size={13} />
                              <span>{item.patient_name || `Patient #${item.patient_id}`}</span>
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Anonymous Demo</span>
                          )}
                        </td>
                        <td>{Array.isArray(item.symptoms) ? item.symptoms.join(', ') : item.symptoms}</td>
                        <td>
                          <span
                            className={`badge ${
                              item.severity === 'severe'
                                ? 'badge-danger'
                                : item.severity === 'moderate'
                                ? 'badge-warning'
                                : 'badge-info'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>
                        <td>{item.duration || '—'}</td>
                        <td>
                          {isEmergency ? (
                            <span className="badge badge-danger">
                              <ShieldAlert size={12} />
                              Emergency Red Flag
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              <CheckCircle2 size={12} />
                              Standard Info
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {item.created_at}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {historyPagination && historyPagination.total_pages > 1 && (
              <div className="pagination-bar">
                <span>
                  Page {historyPagination.page} of {historyPagination.total_pages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    disabled={!historyPagination.has_prev}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!historyPagination.has_next}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
