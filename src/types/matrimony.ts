export type Gender = 'Bride' | 'Groom';
export type ProfileGender = 'Male' | 'Female' | 'Other';

export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected' | 'Blocked';

export type MembershipTier = 'Free' | 'Silver' | 'Royal Gold' | 'Imperial Platinum';

export interface ReligionRecord {
  id: string;
  name: string;
  is_active: boolean;
  display_order?: number;
}

export interface CommunityRecord {
  id: string;
  religion_id: string;
  community_code?: string;
  community_name: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
}

export interface CommunityTranslationRecord {
  id?: string;
  community_id: string;
  language_code: string;
  translated_name: string;
}

export interface LanguageRecord {
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  is_default: boolean;
}

export interface PersonalDetails {
  fullName: string;
  gender: ProfileGender | Gender | '';
  dateOfBirth: string;
  age: number;
  height: string;
  maritalStatus: 'Never Married' | 'Divorced' | 'Widowed' | 'Awaiting Divorce';
  motherTongue: string;
  diet: 'Vegetarian' | 'Eggetarian' | 'Non-Vegetarian' | 'Jain' | 'Vegan';
  smoking: 'No' | 'Occasionally' | 'Yes';
  drinking: 'No' | 'Socially' | 'Yes';
  complexion: string;
  bodyType: string;
  aboutMe: string;
  hobbies: string;
}

export interface FamilyDetails {
  familyType: 'Nuclear' | 'Joint' | 'Extended';
  familyValues: 'Traditional' | 'Moderate' | 'Liberal';
  fatherName: string;
  fatherOccupation: string;
  motherName: string;
  motherOccupation: string;
  brothers: number;
  brothersMarried: number;
  sisters: number;
  sistersMarried: number;
  ancestralOrigin: string;
  familyLocation: string;
  aboutFamily: string;
}

export interface ReligionCommunityDetails {
  religionId: string;
  communityId: string;
  religion: string;
  community: string;
  subCommunity: string;
  motherTongue: string;
  willingToMarryOutsideCommunity: boolean;
  culturalValues: string;
}

export interface EducationOccupationDetails {
  qualification: string;
  course: string;
  specialization: string;
  institution: string;
  university: string;
  passingYear: string;
  occupation: string;
  companyName: string;
  employmentType: 'Private Sector' | 'Government / PSU' | 'Business / Entrepreneur' | 'Self Employed' | 'Not Working';
  annualIncome: string;
  workCountry: string;
  workState: string;
  workCity: string;
}

export interface JatakaDetails {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  rashi: string;
  nakshatra: string;
  nakshatraPadam: 1 | 2 | 3 | 4 | '';
  gothram: string;
  manglikStatus: 'No' | 'Yes' | 'Anshik (Partial)' | 'Do Not Know';
}

export interface PartnerPreferences {
  ageFrom: number;
  ageTo: number;
  heightFrom: string;
  heightTo: string;
  maritalStatus: string;
  religion: string;
  community: string;
  motherTongue: string;
  country: string;
  educationLevel: string;
  occupationPreference: string;
  annualIncomeMin: string;
  manglikPreference: string;
  partnerExpectations: string;
}

export interface PhotoItem {
  id: string;
  profileId?: string;
  url: string;
  storagePath?: string;
  caption: string;
  isPrimary: boolean;
  isPrivate?: boolean;
  status: ApprovalStatus;
  uploadedAt: string;
}

export interface MemberProfile {
  id: string;
  profileCode: string;
  email: string;
  mobile: string;
  country: string;
  state: string;
  city: string;
  membershipTier: MembershipTier;
  profileStatus: ApprovalStatus;
  adminNote?: string;
  verifiedId: boolean;
  isNRI: boolean;
  preferredLanguage: string;
  role: 'member' | 'admin';
  createdAt: string;
  personal: PersonalDetails;
  family: FamilyDetails;
  religionCommunity: ReligionCommunityDetails;
  educationOccupation: EducationOccupationDetails;
  jataka: JatakaDetails;
  partnerPreferences: PartnerPreferences;
  photos: PhotoItem[];
}

export interface SearchFilters {
  lookingFor: 'All' | Gender;
  ageMin: number;
  ageMax: number;
  religionId: string;
  communityId: string;
  motherTongue: string;
  location: string;
  maritalStatus: string;
  manglikStatus: string;
}

export interface StateRecord {
  id: string;
  name: string;
  country?: string;
  state_code?: string;
  is_active: boolean;
}

export interface ProfileSearchParams {
  gender?: 'All' | 'Female' | 'Male' | 'Other';
  ageMin?: number | null;
  ageMax?: number | null;
  religionId?: string;
  communityId?: string;
  maritalStatus?: string;
  education?: string;
  country?: string;
  state?: string;
  city?: string;
  excludeProfileId?: string | null;
  offset?: number;
  limit?: number;
}

export interface ProfileSearchResult {
  profiles: MemberProfile[];
  totalCount: number;
  hasMore: boolean;
}

export interface PartnerMatchResult {
  profile: MemberProfile;
  matchScore: number;
  matchedCount: number;
  totalCriteria: number;
  matchedReasons: string[];
}

export interface MembershipPlan {
  id: string;
  name: MembershipTier;
  audience: string;
  priceINR: string;
  priceUSD: string;
  duration: string;
  contactViews: string;
  highlighted?: boolean;
  features: string[];
}

export interface MembershipPlanRecord {
  id: string;
  planCode: string;
  name: string;
  description: string;
  priceInr: number;
  duration: string;
  durationDays: number | null;
  features: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
}

export interface MembershipPlanInput {
  planCode?: string;
  name: string;
  description: string;
  priceInr: number;
  duration: string;
  durationDays?: number;
  features: string[];
  isActive: boolean;
  displayOrder: number;
}

export type SubscriptionStatus = 'Pending' | 'Active' | 'Expired' | 'Cancelled';

export interface MemberSubscriptionRecord {
  id: string;
  profileId: string;
  planId: string;
  planName: string;
  planCode?: string;
  planPriceInr?: number;
  planDurationDays?: number | null;
  planDuration?: string;
  planFeatures?: string[];
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string;
}

export interface AdminSubscriptionRecord extends MemberSubscriptionRecord {
  memberName: string;
  memberProfileCode?: string;
  memberEmail?: string;
}

export interface SuccessStory {
  id: string;
  coupleNames: string;
  location: string;
  weddingDate: string;
  imageUrl: string;
  quote: string;
  story: string;
}

export type ReportStatus = 'Pending' | 'Under Review' | 'Resolved' | 'Dismissed';

export interface ReportRecord {
  id: string;
  reportedProfileId?: string;
  reportedProfileCode: string;
  reportedMemberName: string;
  reportedMemberStatus?: ApprovalStatus;
  reportedMemberCity?: string;
  reportedMemberEmail?: string;
  reporterId?: string;
  reporterProfileCode?: string;
  reporterName: string;
  reporterEmail?: string;
  reason: string;
  details: string;
  createdAt: string;
  createdAtRaw?: string;
  updatedAtRaw?: string;
  resolvedAtRaw?: string;
  status: ReportStatus;
  rawStatus?: string;
  adminNote?: string;
  dismissalReason?: string;
  reviewedBy?: string;
}

export interface ProfileReportsFilters {
  dateFrom: string;
  dateTo: string;
  status: 'All' | ApprovalStatus;
  gender: 'All' | 'Male' | 'Female' | 'Other';
  religionId: string;
  communityId: string;
  state: string;
  city: string;
  maritalStatus: string;
  education: string;
  occupation: string;
  profileCode: string;
  memberName: string;
  email: string;
}

export interface ProfileReportsSummaryCounts {
  totalProfiles: number;
  pendingProfiles: number;
  approvedProfiles: number;
  rejectedProfiles: number;
  blockedProfiles: number;
  maleProfiles: number;
  femaleProfiles: number;
}

export interface ProfileReportsTableSchemaInfo {
  available: boolean;
  columns: string[];
  fkColumn: 'profile_id' | 'user_id';
}

export interface ProfileReportsSchemaInspection {
  inspected: boolean;
  profilesColumns: string[];
  hasProfileCode: boolean;
  hasEmail: boolean;
  hasHeight: boolean;
  hasMotherTongue: boolean;
  hasMaritalStatus: boolean;
  hasOccupationOnProfiles: boolean;
  hasAnnualIncomeOnProfiles: boolean;
  hasEducationOnProfiles: boolean;
  family: ProfileReportsTableSchemaInfo & {
    hasFamilyStatus: boolean;
  };
  education: ProfileReportsTableSchemaInfo & {
    gradeColumn: string | null;
  };
  jataka: ProfileReportsTableSchemaInfo;
  preferences: ProfileReportsTableSchemaInfo & {
    countriesColumn: string | null;
  };
  photos: ProfileReportsTableSchemaInfo;
  auditLogs: {
    available: boolean;
    columns: string[];
  };
}

export interface ProfileReportRecord extends MemberProfile {
  religionName: string;
  communityName: string;
  educationGrade?: string;
  familyStatus?: string;
  preferredCountries?: string;
}

export interface ProfileExportBatchProgress {
  phase: 'fetching' | 'building' | 'auditing';
  fetchedCount: number;
  totalCount: number;
  message: string;
}

export type AnalyticsDatePreset =
  | 'all'
  | 'today'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'this_month'
  | 'prev_month'
  | 'this_year'
  | 'custom';

export interface ProfileAnalyticsFilters {
  datePreset: AnalyticsDatePreset;
  dateFrom: string;
  dateTo: string;
  gender: 'All' | 'Male' | 'Female' | 'Other';
  religionId: string;
  communityId: string;
  state: string;
  profileStatus: 'All' | ApprovalStatus;
  planId: string;
}

export interface ProfileAnalyticsSummary {
  totalProfiles: number;
  newToday: number;
  thisMonth: number;
  approvedProfiles: number;
  pendingProfiles: number;
  rejectedProfiles: number;
  blockedProfiles: number;
  activeMembers: number;
}

export interface DailyRegistrationPoint {
  date: string;
  count: number;
}

export interface MonthlyRegistrationPoint {
  month: string;
  label: string;
  count: number;
  momDelta: number | null;
  momDeltaPct: number | null;
}

export interface YearlyRegistrationPoint {
  year: number;
  count: number;
  yoyGrowthPct: number | null;
}

export interface GenderStatRow {
  gender: 'Male' | 'Female' | 'Other' | 'Unspecified';
  count: number;
  percentage: number;
}

export interface ReligionStatRow {
  religionId: string;
  religionName: string;
  count: number;
  percentage: number;
}

export interface CommunityStatRow {
  communityId: string;
  communityName: string;
  religionId: string;
  religionName: string;
  count: number;
  percentage: number;
}

export interface StateStatRow {
  state: string;
  total: number;
  maleCount: number;
  femaleCount: number;
}

export interface CityStatRow {
  city: string;
  state: string;
  total: number;
}

export interface ProfileApprovalAnalytics {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  blockedCount: number;
  approvalRatePct: number;
  rejectionRatePct: number;
  hasApprovalHistory: boolean;
  dailyApprovals: DailyRegistrationPoint[];
  monthlyApprovals: { month: string; label: string; count: number }[];
}

export interface MembershipPlanStatRow {
  planId: string;
  planName: string;
  totalCount: number;
  activeCount: number;
  pendingCount: number;
  expiredCount: number;
  cancelledCount: number;
}

export interface MembershipAnalyticsSummary {
  available: boolean;
  totalSubscriptions: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  expiredSubscriptions: number;
  cancelledSubscriptions: number;
  planDistribution: MembershipPlanStatRow[];
}

export interface MonthlyRevenuePoint {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface PlanRevenueRow {
  planId: string;
  planName: string;
  amount: number;
  count: number;
}

export interface PaymentRevenueAnalytics {
  available: boolean;
  reason?: string;
  successfulCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  totalSuccessfulAmount: number;
  currentMonthRevenue: number;
  monthlyRevenue: MonthlyRevenuePoint[];
  revenueByPlan: PlanRevenueRow[];
}

export interface ProfileAnalyticsDashboardData {
  generatedAt: string;
  aggregationSource: 'rpc' | 'server_query';
  appliedFiltersLabel: string;
  resolvedDateFrom: string | null;
  resolvedDateTo: string | null;
  summary: ProfileAnalyticsSummary;
  dailyRegistrations: DailyRegistrationPoint[];
  monthlyRegistrations: MonthlyRegistrationPoint[];
  yearlyRegistrations: YearlyRegistrationPoint[];
  genderDistribution: GenderStatRow[];
  religionDistribution: ReligionStatRow[];
  communityDistribution: CommunityStatRow[];
  stateStats: StateStatRow[];
  cityStats: CityStatRow[];
  availableStates: string[];
  approvalAnalytics: ProfileApprovalAnalytics;
  membershipAnalytics: MembershipAnalyticsSummary;
  paymentAnalytics: PaymentRevenueAnalytics;
}

export type AdminRoleType = 'super_admin' | 'admin' | 'staff' | 'moderator';

export type PermissionActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'delete';

export type PermissionModuleKey =
  | 'dashboard'
  | 'profiles'
  | 'profile_management'
  | 'profile_approval'
  | 'photo_approval'
  | 'reports_management'
  | 'membership_management'
  | 'subscription_management'
  | 'payment_management'
  | 'messages_management'
  | 'community_management'
  | 'religion_management'
  | 'education_management'
  | 'location_management'
  | 'member_support';

export interface AdminPermissionActionItem {
  permissionKey: string;
  action: PermissionActionKey;
  label: string;
  description: string;
}

export interface AdminPermissionModuleDef {
  moduleKey: PermissionModuleKey;
  moduleLabel: string;
  description: string;
  actions: AdminPermissionActionItem[];
}

export interface AdminAccessProfile {
  authenticated: boolean;
  isAdmin: boolean;
  isActive: boolean;
  role: AdminRoleType | null;
  fullName?: string;
  email?: string;
  permissions: string[];
  enforcedByDatabase: boolean;
}

export interface AdminStaffUserRecord {
  userId: string;
  fullName: string;
  email: string;
  mobile: string;
  role: AdminRoleType;
  isActive: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  deactivatedAt: string | null;
  assignedPermissions: string[];
  assignedPermissionCount: number;
}

export interface AdminUserManagementSummary {
  totalAdmins: number;
  totalStaff: number;
  activeAdmins: number;
  activeStaff: number;
  deactivatedAccounts: number;
}

export interface CreateAdminStaffUserInput {
  fullName: string;
  email: string;
  mobile?: string;
  accountType: 'admin' | 'staff';
  isActive: boolean;
  permissionKeys: string[];
}

export interface UpdateAdminStaffUserInput {
  targetUserId: string;
  fullName: string;
  mobile?: string;
  role: AdminRoleType;
  isActive: boolean;
}


