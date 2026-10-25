# HealSmartAI — Screenshot Capture Checklist

Use this checklist to capture clean, consistent screenshots for your internship submission report, presentation slides, or GitHub portfolio.

> **Pre-Capture Setup Tip:**
> - Run both backend (`http://localhost:5000`) and frontend (`http://localhost:5173`).
> - Use a clean browser window at **`1440 × 900`** (Desktop) and **`390 × 844`** (Mobile responsive view in DevTools).
> - Use **fictional demo names only** (e.g., *Aarav Sharma*, *Dr. Meera Nair*).

---

## Required Screenshots Checklist

| # | Screenshot Filename | Route / URL | Role | What to Show & Capture Instructions |
|---|---|---|---|---|
| 1 | `01_login_page.png` | `/login` | Public | Clean glassmorphism Sign-In card with Email/Password inputs, medical disclaimer footer, and links to Sign Up and Forgot Password. |
| 2 | `02_signup_page.png` | `/signup` | Public | Registration page showing Full Name, Email, Password, and notice that new accounts are provisioned as Patient accounts. |
| 3 | `03_home_overview.png` | `/` | Patient | Authenticated Home page showing the Hero banner, live API/SQLite connection pill (`API & SQLite Connected`), feature cards, and sidebar with `Patient Account` badge. |
| 4 | `04_patient_profile_form.png` | `/patients` | Patient | **My Health Profile** page with the **Create / Edit Health Profile** modal open (`Aarav Sharma`, Age `29`, Medical History `Seasonal allergies, Mild asthma`). |
| 5 | `05_patient_detail_doctor_assignment.png` | `/patients/:id` | Patient | Patient detail view showing the **Doctor Access & Care Team** card with a verified doctor (`Dr. Meera Nair`) assigned and the **Revoke Access** button visible. |
| 6 | `06_symptom_checker_input.png` | `/symptoms` | Patient | **Smart Symptom Assistant** showing the `Free Smart Local Engine` badge, selected symptom tags (`high temp`, `bad cough`, `sore throat`), Duration (`4 days`), Severity (`Moderate`), and Context Notes filled in. |
| 7 | `07_symptom_checker_results.png` | `/symptoms` | Patient | Evaluation results showing **Normalized Symptom Mapping**, **Multi-Symptom Pattern Insights** (*Respiratory + Fever Pattern*), **Duration & Severity Context Notes**, and **Helpful Questions for a Clinician Visit**. |
| 8 | `08_symptom_emergency_red_flag.png` | `/symptoms` | Patient | Evaluation result for `"crushing chest pain, shortness of breath"` showing the red **Immediate Emergency Warning Banner** at the top of the results. |
| 9 | `09_doctor_dashboard.png` | `/dashboard` | Doctor | Signed in as `Dr. Meera Nair` (`Doctor Account` badge in sidebar), showing the 4 live SQLite KPI cards, Top Symptom Categories bar chart, and Recent Assigned-Patient Symptom Evaluations table. |
| 10 | `10_doctor_clinical_note.png` | `/patients/:id` | Doctor | Doctor view of an assigned patient's profile showing the **Clinical & Educational Notes** form (`Follow-Up` category) and a saved note in the timeline. |
| 11 | `11_mobile_navigation_drawer.png` | `/` or `/symptoms` (`390×844`) | Patient / Doctor | Mobile viewport (`390 × 844`) with the responsive hamburger navigation drawer open. |

---

## Existing Verified Screenshots in Artifacts

During automated Playwright browser verification, the following screenshots were already captured and verified:
- `phase4c_smart_symptom_assistant.png` — Full-page capture of the Phase 4C Smart Symptom Assistant with combination analysis and clinician follow-up questions.
- `phase6_dashboard.png` — Clinical Dashboard view.
- `phase6_patient_detail.png` — Patient detail and clinical notes view.
- `phase6_patients_list.png` — Patient profile directory view.
- `phase6_symptom_checker.png` — Symptom Checker view.
- `phase6_mobile_nav.png` — Responsive mobile navigation drawer (`390 × 844`).
