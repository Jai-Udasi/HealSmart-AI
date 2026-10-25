# HealSmartAI — REST API Documentation

**Base URL (Local Development):** `http://localhost:5000/api` (proxied via `/api` on Vite `http://localhost:5173`)  
**Content-Type:** `application/json`  
**Authentication Header:** `Authorization: Bearer <Firebase_ID_Token>` (Required for all endpoints except `GET /api/health`)

---

## 1. Standard Response Envelope

All endpoints return a consistent JSON structure:

- **Success (`200 OK` / `201 Created`):**
  ```json
  {
    "success": true,
    "data": { ... },
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
  ```
- **Error (`400`, `401`, `403`, `404`, `409`, `429`, `500`):**
  ```json
  {
    "success": false,
    "error": {
      "message": "Human-readable error description",
      "code": "OPTIONAL_ERROR_CODE",
      "details": ["Optional validation detail strings"]
    }
  }
  ```

---

## 2. Endpoint Summary Matrix

| # | Method | Path | Auth | Role / Access Policy | Purpose |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/health` | Public | Public | Server uptime, environment, SQLite status & latency |
| 2 | `GET` | `/api/auth/me` | Required | Any (`patient` / `doctor`) | Current user SQLite profile, role & `local_dev_mode` flag |
| 3 | `PUT` | `/api/auth/profile` | Required | Any (blocks `role` changes) | Update `display_name` in SQLite |
| 4 | `POST` | `/api/auth/dev-approve-doctor` | Required | Localhost + `NODE_ENV !== 'production'` | Controlled local-dev role promotion to `doctor` |
| 5 | `GET` | `/api/auth/doctors` | Required | Any (`patient` / `doctor`) | List verified `doctor` accounts for assignment |
| 6 | `GET` | `/api/patients/me` | Required | Owner | Retrieve signed-in user's 1-to-1 patient profile |
| 7 | `PUT` | `/api/patients/me` | Required | Owner | Create or update signed-in user's 1-to-1 patient profile |
| 8 | `GET` | `/api/patients` | Required | Scoped (Owner or Assigned Doctor) | Paginated patient list (`search`, `page`, `limit`) |
| 9 | `POST` | `/api/patients` | Required | Authenticated (`409` if duplicate) | Create 1-to-1 patient profile |
| 10 | `GET` | `/api/patients/:id` | Required | Owner or Assigned Doctor | Retrieve patient details + `assigned_doctors` list |
| 11 | `PUT` | `/api/patients/:id` | Required | Owner or Assigned Doctor | Update patient record fields |
| 12 | `DELETE` | `/api/patients/:id` | Required | Owner Only | Delete patient record (`403` for non-owners) |
| 13 | `POST` | `/api/patients/:id/assign-doctor` | Required | Owner Only | Assign a verified doctor to this patient profile |
| 14 | `DELETE` | `/api/patients/:id/assign-doctor/:doctorUserId` | Required | Owner Only | Immediately revoke a doctor's access to this patient |
| 15 | `GET` | `/api/symptoms/engine-status` | Required | Any (`patient` / `doctor`) | Check active symptom engine (`local_rule_engine` vs `openai`) |
| 16 | `POST` | `/api/symptoms/check` | Required | Scoped if `patient_id` supplied | Run Smart Symptom Engine v2 & persist evaluation |
| 17 | `GET` | `/api/symptoms/history` | Required | Scoped (Owner or Assigned Doctor) | Paginated symptom check history |
| 18 | `GET` | `/api/notes` | Required | Owner or Assigned Doctor | List clinical notes (`?patient_id=...` optional) |
| 19 | `POST` | `/api/notes` | Required | `doctor` Role + Assigned to Patient | Create a clinical note for an assigned patient |
| 20 | `GET` | `/api/dashboard/stats` | Required | `doctor` Role Only | Aggregate KPIs for currently assigned patients |
| 21 | `GET` | `/api/dashboard/recent` | Required | `doctor` Role Only | Paginated recent symptom checks for assigned patients |

---

## 3. Detailed Endpoint Reference

### 3.1 System Health (`backend/src/routes/health.js`)

#### `GET /api/health`
- **Authentication:** None (Public)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "healthy",
    "timestamp": "2026-10-25T08:30:00.000Z",
    "uptime_seconds": 142,
    "environment": "development",
    "database": {
      "status": "connected",
      "engine": "SQLite",
      "version": "3.49.1",
      "response_time_ms": 1
    }
  }
  ```

---

### 3.2 Authentication & Roles (`backend/src/routes/auth.js`)

#### `GET /api/auth/me`
- **Authentication:** Bearer Token required.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "firebase_uid": "uid_patient_123",
      "email": "patient@example.com",
      "display_name": "Aarav Sharma",
      "role": "patient",
      "created_at": "2026-10-24 10:00:00",
      "updated_at": "2026-10-24 10:00:00",
      "local_dev_mode": true
    }
  }
  ```

#### `PUT /api/auth/profile`
- **Authentication:** Bearer Token required.
- **Security Note:** Passing `role` in the request body is explicitly rejected by Joi (`400 Bad Request`) to prevent client-side privilege escalation.
- **Request Body:**
  ```json
  {
    "display_name": "Aarav Sharma"
  }
  ```

#### `POST /api/auth/dev-approve-doctor`
- **Authentication:** Bearer Token required.
- **Access Policy:** Strictly restricted to non-production (`NODE_ENV !== 'production'`) and loopback IP addresses (`127.0.0.1` / `::1`). Returns `403 Forbidden` in production.
- **Request Body:**
  ```json
  {
    "approval_code": "HEALSMART-LOCAL-DEV-DOCTOR",
    "display_name": "Dr. Meera Nair"
  }
  ```

#### `GET /api/auth/doctors`
- **Authentication:** Bearer Token required.
- **Description:** Returns all accounts with `role = 'doctor'` so patients can select a doctor to grant access.

---

### 3.3 Patient Profiles & Doctor Consent (`backend/src/routes/patients.js`)

#### `GET /api/patients/me`
- **Authentication:** Bearer Token required.
- **Description:** Returns the signed-in user's 1-to-1 health profile (`owner_user_id = req.user.id`) along with `assigned_doctors`, or `data: null` if not yet created.

#### `PUT /api/patients/me`
- **Authentication:** Bearer Token required.
- **Description:** Creates the signed-in user's 1-to-1 health profile if none exists (`201 Created`) or updates the existing profile (`200 OK`).
- **Request Body:**
  ```json
  {
    "name": "Aarav Sharma",
    "age": 29,
    "gender": "male",
    "email": "aarav@example.com",
    "phone": "+91-9000000001",
    "medical_history": ["Seasonal allergic rhinitis", "Mild asthma"]
  }
  ```
- **Response (`200 OK` / `201 Created`):**
  ```json
  {
    "success": true,
    "message": "Your health profile has been updated.",
    "data": {
      "id": 1,
      "name": "Aarav Sharma",
      "age": 29,
      "gender": "male",
      "email": "aarav@example.com",
      "phone": "+91-9000000001",
      "medical_history": ["Seasonal allergic rhinitis", "Mild asthma"],
      "owner_user_id": 1,
      "assigned_doctors": []
    }
  }
  ```

#### `POST /api/patients/:id/assign-doctor`
- **Authentication:** Bearer Token required (Patient Owner Only).
- **Request Body:**
  ```json
  {
    "doctor_user_id": 2
  }
  ```
- **Response (`200 OK`):** Returns the assigned doctor object and the updated `assigned_doctors` array.

#### `DELETE /api/patients/:id/assign-doctor/:doctorUserId`
- **Authentication:** Bearer Token required (Patient Owner Only).
- **Description:** Immediately removes the assignment row from `doctor_patient_assignments`, revoking the doctor's access to the patient profile, symptom history, and clinical notes.

---

### 3.4 Smart Symptom Assistant (`backend/src/routes/symptoms.js`)

#### `GET /api/symptoms/engine-status`
- **Authentication:** Bearer Token required.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "active_engine": "local_rule_engine",
      "openai_enabled": false,
      "openai_configured": false,
      "free_mode": true,
      "description": "Free Smart Local Symptom Engine is active (100% free, deterministic rule & combination matching)."
    }
  }
  ```

#### `POST /api/symptoms/check`
- **Authentication:** Bearer Token required.
- **Request Body:**
  ```json
  {
    "symptoms": ["high temp", "bad cough", "sore throat"],
    "duration": "4 days",
    "severity": "moderate",
    "context_notes": "Started after a cold, worse in the evening"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "check_id": 12,
      "patient_id": 1,
      "submitted_symptoms": ["high temp", "bad cough", "sore throat"],
      "normalized_symptoms": [
        { "original": "high temp", "canonical": "fever" },
        { "original": "bad cough", "canonical": "cough" },
        { "original": "sore throat", "canonical": "sore throat" }
      ],
      "duration": "4 days",
      "severity": "moderate",
      "context_notes": "Started after a cold, worse in the evening",
      "engine_used": "local_rule_engine",
      "fallback_reason": null,
      "matched_categories": ["Fever & Thermoregulation", "Upper Respiratory & Airway"],
      "matched_combinations": [
        {
          "id": "respiratory_fever_pattern",
          "name": "Respiratory + Fever Pattern",
          "overview": "Experiencing fever alongside upper respiratory symptoms such as cough or sore throat is a common pattern in viral upper respiratory tract infections or seasonal respiratory illnesses.",
          "self_care_tips": [
            "Prioritize rest and steady fluid intake to counter moisture loss from fever and breathing.",
            "Monitor temperature trends and breathing comfort morning and evening."
          ],
          "when_to_seek_medical_advice": [
            "Seek medical evaluation if fever lasts more than 3 days, returns after breaking, or is accompanied by shortness of breath or chest discomfort."
          ]
        }
      ],
      "general_information": ["..."],
      "context_explanations": ["..."],
      "self_care_tips": ["..."],
      "follow_up_questions": ["..."],
      "when_to_seek_medical_advice": ["..."],
      "emergency_safety": {
        "has_red_flags": false,
        "red_flag_warnings": [],
        "emergency_notice": "No immediate red-flag keywords were detected in your input. However, automated keyword screening cannot rule out a medical emergency. If symptoms feel life-threatening or rapidly worsen, seek emergency care immediately."
      },
      "disclaimer": "INFORMATIONAL & EDUCATIONAL ONLY — NOT A MEDICAL DIAGNOSIS..."
    }
  }
  ```

---

### 3.5 Clinical Notes & Doctor Dashboard (`backend/src/routes/notes.js`, `backend/src/routes/dashboard.js`)

#### `GET /api/notes?patient_id=1`
- **Authentication:** Bearer Token required (Patient Owner or Assigned Doctor).
- **Description:** Lists clinical notes scoped to the patient owner or currently assigned doctor.

#### `POST /api/notes`
- **Authentication:** Bearer Token required (`doctor` role AND currently assigned to `patient_id`).
- **Request Body:**
  ```json
  {
    "patient_id": 1,
    "doctor_name": "Dr. Meera Nair",
    "category": "follow_up",
    "note": "Reviewed 4-day respiratory and fever symptom check. Recommended hydration tracking and in-person auscultation if cough persists."
  }
  ```

#### `GET /api/dashboard/stats` & `GET /api/dashboard/recent`
- **Authentication:** Bearer Token required (`doctor` role only; returns `403 Forbidden` for `patient` accounts).
- **Description:** Returns real-time SQLite aggregate statistics and recent symptom evaluations filtered strictly by `INNER JOIN doctor_patient_assignments dpa ON dpa.patient_id = ... WHERE dpa.doctor_user_id = req.user.id`.
