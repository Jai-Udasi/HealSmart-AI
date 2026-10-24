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
  Sparkles,
  HelpCircle,
  Layers,
  Info,
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
import { useAuth } from '../context/AuthContext';

const QUICK_SYMPTOMS = [
  'Fever',
  'Headache',
  'Dry cough',
  'Sore throat',
  'Fatigue',
  'Nausea',
  'Stomach discomfort',
  'Dizziness',
  'Chest pain',
  'Shortness of breath',
];

export default function SymptomCheckerPage() {
  const { currentUser } = useAuth();
  const isDoctor = currentUser?.role === 'doctor';

  // Symptom form state
  const [symptoms, setSymptoms] = useState([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('mild');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [patientId, setPatientId] = useState('');

  // Active engine status from backend
  const [engineStatus, setEngineStatus] = useState({
    active_engine: 'local_rule_engine',
    openai_enabled: false,
    openai_configured: false,
  });

  // Form validation & submission state
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  // Accessible patients dropdown state
  const [accessiblePatients, setAccessiblePatients] = useState([]);

  // History list state
  const [historyData, setHistoryData] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Load engine status and accessible patient profile(s)
  useEffect(() => {
    symptomsApi
      .engineStatus()
      .then((res) => {
        if (res.data) setEngineStatus(res.data);
      })
      .catch(() => {
        // Non-blocking fallback
      });

    patientsApi
      .list({ page: 1, limit: 100 })
      .then((res) => {
        const list = res.data?.patients || [];
        setAccessiblePatients(list);
        if (!isDoctor && list.length === 1) {
          setPatientId(String(list[0].id));
        }
      })
      .catch(() => {
        // Non-blocking if patient list fails
      });
  }, [isDoctor]);

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
    if (additionalNotes && additionalNotes.trim().length > 1000) {
      errors.additional_notes = 'Additional notes cannot exceed 1000 characters.';
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
        additional_notes: additionalNotes.trim() || null,
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
  const activeEngineUsed =
    result?.engine_used || evaluation?.engine_used || engineStatus.active_engine || 'local_rule_engine';
  const isOpenAiResult = activeEngineUsed === 'openai';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Smart Symptom Assistant</h1>
          <p className="page-description">
            Structured multi-symptom pattern matching, synonym normalization, follow-up questions, and deterministic emergency red-flag screening.
          </p>
        </div>
        <span
          className={`badge ${isOpenAiResult ? 'badge-teal' : 'badge-info'}`}
          data-testid="active-engine-badge"
        >
          {isOpenAiResult ? <Sparkles size={13} /> : <Cpu size={13} />}
          {isOpenAiResult ? 'OpenAI Assistant' : 'Free Smart Assistant'}
        </span>
      </div>

      <NoticeBanner variant="warning" title="Non-Diagnostic Educational Assistant — Free Local Engine Active">
        HealSmartAI uses a <strong>100% free, local deterministic symptom and combination rule engine by default</strong> (optional OpenAI integration is disabled unless explicitly configured). It provides general health education only, never calculates diagnosis probabilities, and cannot replace a licensed physician or emergency medical services.
      </NoticeBanner>

      <div className="grid-2col" style={{ alignItems: 'start', marginBottom: '2rem' }}>
        {/* Left Column: Symptom Entry Form */}
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
            <Stethoscope size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Enter Symptoms &amp; Context</h2>
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
                Add Symptom Keyword, Synonym, or Phrase *
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="symptom-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g., running a temp, throbbing head, scratchy throat, queasy..."
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
                  No symptoms added yet. Click a quick-add chip above or type any symptom/synonym and click Add.
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
                placeholder="e.g., 6 hours, 3 days, 2 weeks"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                maxLength={100}
                error={formErrors.duration}
              />
            </div>

            <FormField
              label="Additional Notes or Context (Optional)"
              id="symptom-notes"
              as="textarea"
              rows={2}
              placeholder="e.g., started after outdoor exercise, worse when swallowing or standing up..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              maxLength={1000}
              error={formErrors.additional_notes}
            />

            <FormField
              label={
                isDoctor
                  ? 'Associate with Assigned Patient (Optional)'
                  : 'Linked Health Profile (Auto-linked if available)'
              }
              id="symptom-patient"
              as="select"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              error={formErrors.patient_id}
            >
              <option value="">
                {isDoctor
                  ? '— General Check (No Patient Linked) —'
                  : '— Account Self-Check (Auto-link to My Profile if created) —'}
              </option>
              {accessiblePatients.map((p) => (
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
                  setAdditionalNotes('');
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
                {submitting ? 'Analyzing Symptoms…' : 'Check Symptoms'}
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
                Enter one or more symptoms on the left and click <strong>Check Symptoms</strong> to view matched categories, multi-symptom pattern insights, context-aware explanations, follow-up questions, self-care guidance, and emergency safety notices.
              </p>
            </GlassCard>
          ) : (
            <GlassCard>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    Educational Symptom Assessment
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Check #{result.id} · Severity: <strong>{result.severity.toUpperCase()}</strong>
                    {result.duration ? ` · Duration: ${result.duration}` : ''}
                  </div>
                </div>
                <span
                  className={`badge ${isOpenAiResult ? 'badge-teal' : 'badge-info'}`}
                  data-testid="result-engine-label"
                >
                  {isOpenAiResult ? <Sparkles size={13} /> : <Cpu size={13} />}
                  {isOpenAiResult ? 'OpenAI Assistant' : 'Free Smart Assistant'}
                </span>
              </div>

              {/* Explicit Engine Statement */}
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

              {/* Emergency Safety Banner (Always evaluated deterministically first) */}
              {emergencySafety?.is_emergency_warning ? (
                <div
                  className="alert-banner alert-danger"
                  role="alert"
                  data-testid="emergency-warning-banner"
                  style={{ borderWidth: 2, marginBottom: '1.1rem' }}
                >
                  <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                      {emergencySafety.headline}
                    </strong>
                    <p style={{ marginBottom: '0.45rem' }}>{emergencySafety.message}</p>
                    {emergencySafety.immediate_action && (
                      <p style={{ fontWeight: 600, marginBottom: '0.45rem', fontSize: '0.84rem' }}>
                        Immediate Action: {emergencySafety.immediate_action}
                      </p>
                    )}
                    {emergencySafety.matched_emergency_categories?.length > 0 && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Triggered Red Flags:{' '}
                        {emergencySafety.matched_emergency_categories
                          .map((c) => `${c.category} (${c.matched_terms.join(', ')})`)
                          .join(' • ')}
                      </div>
                    )}
                    {emergencySafety.screening_limitation && (
                      <div style={{ fontSize: '0.76rem', opacity: 0.9 }}>
                        {emergencySafety.screening_limitation}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <NoticeBanner variant="info" title={emergencySafety?.headline}>
                  <div>{emergencySafety?.message}</div>
                  {emergencySafety?.screening_limitation && (
                    <div style={{ fontSize: '0.78rem', marginTop: '0.3rem', opacity: 0.85 }}>
                      {emergencySafety.screening_limitation}
                    </div>
                  )}
                </NoticeBanner>
              )}

              {/* Submitted Symptoms & Normalized Synonym Mapping */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Submitted Symptoms &amp; Matched Categories
                </h3>
                <div className="chip-list" style={{ marginBottom: '0.45rem' }}>
                  {evaluation?.matched_categories?.map((cat) => (
                    <span key={cat.id} className="badge badge-info">
                      {cat.category}
                      {cat.matched_keywords?.length > 0 && ` (${cat.matched_keywords.join(', ')})`}
                    </span>
                  ))}
                </div>
                {evaluation?.normalized_symptoms?.length > 0 && (
                  <div style={{ fontSize: '0.79rem', color: 'var(--text-muted)' }}>
                    <strong>Normalized Terms:</strong>{' '}
                    {evaluation.normalized_symptoms
                      .map((n) => `${n.canonical_symptom} ← [${n.matched_expressions.join(', ')}]`)
                      .join(' · ')}
                  </div>
                )}
              </div>

              {/* Multi-Symptom Combination Synthesis (when multiple related symptoms match) */}
              {evaluation?.matched_combinations?.length > 0 && (
                <div style={{ marginBottom: '1.1rem' }} data-testid="combination-insights">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--teal)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={15} />
                    <span>Multi-Symptom Combination Insights</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {evaluation.matched_combinations.map((combo) => (
                      <div
                        key={combo.id}
                        style={{
                          background: 'var(--surface-solid)',
                          border: '1px solid var(--teal)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem 0.9rem',
                          fontSize: '0.86rem',
                        }}
                      >
                        <strong style={{ display: 'block', color: 'var(--teal)', marginBottom: '0.2rem' }}>
                          {combo.title}
                        </strong>
                        <p style={{ marginBottom: '0.3rem' }}>{combo.explanation}</p>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <strong>Key Guidance:</strong> {combo.guidance}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context-Aware Explanations (Severity, Duration, Notes) */}
              {evaluation?.context_explanations?.length > 0 && (
                <div style={{ marginBottom: '1.1rem' }} data-testid="context-explanations">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Info size={15} color="var(--primary)" />
                    <span>Context-Aware Explanations (Severity &amp; Duration)</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {evaluation.context_explanations.map((ctx, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--surface-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.65rem 0.85rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <strong style={{ color: 'var(--text-primary)' }}>{ctx.aspect}:</strong>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{ctx.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Follow-Up Questions for Clarifying Missing Details */}
              {evaluation?.follow_up_questions?.length > 0 && (
                <div style={{ marginBottom: '1.1rem' }} data-testid="follow-up-questions">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <HelpCircle size={15} />
                    <span>Helpful Follow-Up Questions to Consider or Share with a Clinician</span>
                  </h3>
                  <ul
                    style={{
                      paddingLeft: '1.25rem',
                      fontSize: '0.86rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      background: 'var(--surface-solid)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 0.9rem 0.75rem 2rem',
                    }}
                  >
                    {evaluation.follow_up_questions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Self-Care Tips */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  General Non-Diagnostic Self-Care Information
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
                  <span>When to Seek Professional Medical Evaluation</span>
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
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Saved Symptom Check History</h2>
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
            No symptom checks recorded for your account yet.
          </p>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Linked Profile</th>
                    <th>Symptoms &amp; Notes</th>
                    <th>Severity</th>
                    <th>Duration</th>
                    <th>Engine</th>
                    <th>Safety Status</th>
                    <th>Date (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((item) => {
                    const isEmergency = item.evaluation?.emergency_safety?.is_emergency_warning;
                    const itemEngine =
                      item.engine_used || item.evaluation?.engine_used || 'local_rule_engine';
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
                            <span style={{ color: 'var(--text-muted)' }}>Account Self-Check</span>
                          )}
                        </td>
                        <td>
                          <div>{Array.isArray(item.symptoms) ? item.symptoms.join(', ') : item.symptoms}</div>
                          {item.additional_notes && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Note: {item.additional_notes}
                            </div>
                          )}
                        </td>
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
                          <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                            {itemEngine === 'openai' ? 'OpenAI Assistant' : 'Free Smart Assistant'}
                          </span>
                        </td>
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
