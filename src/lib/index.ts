// Barrel export for src/lib — excludes *.server.ts (server-only, would break the client bundle).

// --- Utils ---
export { cn } from "./utils";
export { downloadCSV } from "./export-csv";
export { consumeLastCapturedError } from "./error-capture";
export { renderErrorPage } from "./error-page";
export { reportLovableError } from "./lovable-error-reporting";

// --- Auth ---
export { useAuth, signOut } from "./auth";

// --- Plans ---
export type { PlanId, Plan } from "./plans";
export { TRIAL_DAYS, PLANS, planByPrice, formatLimit, formatArs } from "./plans";

// --- Plan limits ---
export {
  getOrgPlan,
  getActiveVacancyCount,
  getCvsThisMonth,
  assertCanCreateVacancy,
  canAnalyzeMoreCvs,
} from "./plan-limits";

// --- Email templates ---
export { interviewInviteHtml } from "./email-templates";

// --- Candidate report ---
export type { CandidateReportInput } from "./candidate-report";
export { generateCandidateReport } from "./candidate-report";

// --- Server functions: Recruiting ---
export {
  createVacancy,
  updateVacancy,
  moveApplicationStage,
  saveScorecard,
  getSignedCvUrl,
  checkIdentityAvailable,
  saveIdentity,
  manualCreateApplication,
} from "./recruiting.functions";

// --- Server functions: AI ---
export {
  aiDraftVacancy,
  analyzeApplication,
  aiInterviewQuestions,
  aiDraftEmail,
  aiVacancyImage,
} from "./ai.functions";

// --- Server functions: Scheduling & Google ---
export {
  verifyGoogleOAuthConfig,
  googleStartUrl,
  verifyOAuthState,
  googleDisconnect,
  getGoogleStatus,
  saveOrgBranding,
  getVacancyScheduling,
  saveVacancyScheduling,
  regenerateSlots,
  setSlotStatus,
  addManualSlot,
  inviteForInterview,
  sendInterviewInvite,
  sendStageEmail,
} from "./scheduling.functions";

// --- Server functions: Subscription & Payments ---
export {
  getMySubscription,
  createPreapproval,
  cancelSubscription,
  logEvent,
  requestInvoiceC,
} from "./subscription.functions";

// --- Server functions: Enterprise ---
export {
  myEnterprise,
  createSubOrg,
  createSubOrgUser,
  listEnterpriseUsers,
  setVacancyAssignees,
  listVacancyAssignees,
} from "./enterprise.functions";

// --- Server functions: Admin ---
export {
  adminAmI,
  adminMetrics,
  adminListOrgs,
  adminGrantLicense,
  adminCreateUser,
  adminListPayments,
  adminListUsers,
  adminExportClients,
} from "./admin.functions";
