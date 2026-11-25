import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatNakshatraPadamLabel, normalizeProfileGender } from '../services/masterDataService';
import {
  ProfileReportRecord,
  ProfileReportsSchemaInspection,
  ProfileReportsSummaryCounts,
} from '../types/matrimony';

const NOT_PROVIDED = 'Not Provided';

function textOrFallback(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return NOT_PROVIDED;
  const s = String(val).trim();
  return s.length > 0 ? s : NOT_PROVIDED;
}

function safeExcelText(val: string | null | undefined): string {
  const s = (val ?? '').trim();
  if (!s) return '';
  // Guard spreadsheet cells against formula-prefix interpretation
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

function parseExcelDateValue(raw: string | null | undefined): Date | string {
  const clean = (raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return '';
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? clean : dt;
}

function parseOptionalNumber(raw: string | number | null | undefined): number | '' {
  if (raw === null || raw === undefined || raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

function buildWorksheetWithWidths(
  headers: string[],
  rows: (string | number | Date)[][],
  dateColIndices: number[] = []
): XLSX.WorkSheet {
  const aoa: (string | number | Date)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // Format date cells cleanly as yyyy-mm-dd
  for (let r = 1; r <= rows.length; r++) {
    for (const c of dateColIndices) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.t === 'd') {
        cell.z = 'yyyy-mm-dd';
      }
    }
  }

  // Compute readable column widths based on headers and sample rows
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    const sampleLimit = Math.min(rows.length, 250);
    for (let r = 0; r < sampleLimit; r++) {
      const val = rows[r]?.[colIdx];
      const strLen =
        val instanceof Date
          ? 12
          : val !== null && val !== undefined
          ? String(val).length
          : 0;
      if (strLen > maxLen) maxLen = strLen;
    }
    return { wch: Math.max(12, Math.min(42, maxLen + 3)) };
  });

  ws['!cols'] = colWidths;
  return ws;
}

export function exportProfilesToExcel(params: {
  records: ProfileReportRecord[];
  schema: ProfileReportsSchemaInspection;
  filenamePrefix?: string;
}): string {
  const { records, schema } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Profile Summary
  const summaryHeaders = [
    'Profile Code',
    'Full Name',
    'Gender',
    'Date of Birth',
    'Age',
    'Marital Status',
    'Religion',
    'Community',
    'Mother Tongue',
    'Country',
    'State',
    'City',
    'Height',
    'Education',
    'Occupation',
    'Annual Income',
    'Profile Status',
    'Registration Date',
  ];

  const summaryRows = records.map((r) => [
    safeExcelText(r.profileCode),
    safeExcelText(r.personal.fullName),
    safeExcelText(normalizeProfileGender(r.personal.gender) || ''),
    parseExcelDateValue(r.personal.dateOfBirth),
    r.personal.age > 0 ? r.personal.age : '',
    safeExcelText(r.personal.maritalStatus),
    safeExcelText(r.religionName),
    safeExcelText(r.communityName),
    safeExcelText(r.personal.motherTongue),
    safeExcelText(r.country),
    safeExcelText(r.state),
    safeExcelText(r.city),
    safeExcelText(r.personal.height),
    safeExcelText(r.educationOccupation.qualification),
    safeExcelText(r.educationOccupation.occupation),
    safeExcelText(r.educationOccupation.annualIncome),
    safeExcelText(r.profileStatus),
    parseExcelDateValue(r.createdAt),
  ]);

  const wsSummary = buildWorksheetWithWidths(summaryHeaders, summaryRows, [3, 17]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Profile Summary');

  // Sheet 2: Personal Details
  const personalHeaders = [
    'Profile Code',
    'Full Name',
    ...(schema.hasEmail ? ['Email'] : []),
    'Gender',
    'Date of Birth',
    'Age',
    'Height',
    'Marital Status',
    'Mother Tongue',
    'Diet',
    'Smoking',
    'Drinking',
    'Complexion',
    'Body Type',
    'Hobbies',
    'About Member',
    'Country',
    'State',
    'City',
    'Membership Tier',
    'ID Verified',
    'Profile Status',
    'Registration Date',
  ];

  const personalDobIdx = schema.hasEmail ? 4 : 3;
  const personalRegIdx = personalHeaders.length - 1;

  const personalRows = records.map((r) => [
    safeExcelText(r.profileCode),
    safeExcelText(r.personal.fullName),
    ...(schema.hasEmail ? [safeExcelText(r.email)] : []),
    safeExcelText(normalizeProfileGender(r.personal.gender) || ''),
    parseExcelDateValue(r.personal.dateOfBirth),
    r.personal.age > 0 ? r.personal.age : '',
    safeExcelText(r.personal.height),
    safeExcelText(r.personal.maritalStatus),
    safeExcelText(r.personal.motherTongue),
    safeExcelText(r.personal.diet),
    safeExcelText(r.personal.smoking),
    safeExcelText(r.personal.drinking),
    safeExcelText(r.personal.complexion),
    safeExcelText(r.personal.bodyType),
    safeExcelText(r.personal.hobbies),
    safeExcelText(r.personal.aboutMe),
    safeExcelText(r.country),
    safeExcelText(r.state),
    safeExcelText(r.city),
    safeExcelText(r.membershipTier),
    r.verifiedId ? 'Yes' : 'No',
    safeExcelText(r.profileStatus),
    parseExcelDateValue(r.createdAt),
  ]);

  const wsPersonal = buildWorksheetWithWidths(personalHeaders, personalRows, [
    personalDobIdx,
    personalRegIdx,
  ]);
  XLSX.utils.book_append_sheet(wb, wsPersonal, 'Personal Details');

  // Sheet 3: Family Details (only if table exists)
  if (schema.family.available) {
    const familyHeaders = [
      'Profile Code',
      'Full Name',
      'Father Name',
      'Father Occupation',
      'Mother Name',
      'Mother Occupation',
      'Family Type',
      ...(schema.family.hasFamilyStatus ? ['Family Status'] : []),
      'Family Values',
      'Brothers',
      'Brothers Married',
      'Sisters',
      'Sisters Married',
      'Family Location',
      'Ancestral Origin',
      'About Family',
    ];

    const familyRows = records.map((r) => [
      safeExcelText(r.profileCode),
      safeExcelText(r.personal.fullName),
      safeExcelText(r.family.fatherName),
      safeExcelText(r.family.fatherOccupation),
      safeExcelText(r.family.motherName),
      safeExcelText(r.family.motherOccupation),
      safeExcelText(r.family.familyType),
      ...(schema.family.hasFamilyStatus ? [safeExcelText(r.familyStatus)] : []),
      safeExcelText(r.family.familyValues),
      Number.isFinite(r.family.brothers) ? r.family.brothers : 0,
      Number.isFinite(r.family.brothersMarried) ? r.family.brothersMarried : 0,
      Number.isFinite(r.family.sisters) ? r.family.sisters : 0,
      Number.isFinite(r.family.sistersMarried) ? r.family.sistersMarried : 0,
      safeExcelText(r.family.familyLocation),
      safeExcelText(r.family.ancestralOrigin),
      safeExcelText(r.family.aboutFamily),
    ]);

    const wsFamily = buildWorksheetWithWidths(familyHeaders, familyRows);
    XLSX.utils.book_append_sheet(wb, wsFamily, 'Family Details');
  }

  // Sheet 4: Education Details (only if supported by schema)
  if (schema.education.available || schema.hasEducationOnProfiles) {
    const eduHeaders = [
      'Profile Code',
      'Full Name',
      'Qualification',
      'Course',
      'Specialization',
      'Institution',
      'University',
      'Passing Year',
      ...(schema.education.gradeColumn ? ['Grade / Percentage'] : []),
      'Occupation',
      'Company / Employer',
      'Employment Type',
      'Annual Income',
      'Work Country',
      'Work State',
      'Work City',
    ];

    const eduRows = records.map((r) => [
      safeExcelText(r.profileCode),
      safeExcelText(r.personal.fullName),
      safeExcelText(r.educationOccupation.qualification),
      safeExcelText(r.educationOccupation.course),
      safeExcelText(r.educationOccupation.specialization),
      safeExcelText(r.educationOccupation.institution),
      safeExcelText(r.educationOccupation.university),
      parseOptionalNumber(r.educationOccupation.passingYear),
      ...(schema.education.gradeColumn ? [safeExcelText(r.educationGrade)] : []),
      safeExcelText(r.educationOccupation.occupation),
      safeExcelText(r.educationOccupation.companyName),
      safeExcelText(r.educationOccupation.employmentType),
      safeExcelText(r.educationOccupation.annualIncome),
      safeExcelText(r.educationOccupation.workCountry),
      safeExcelText(r.educationOccupation.workState),
      safeExcelText(r.educationOccupation.workCity),
    ]);

    const wsEdu = buildWorksheetWithWidths(eduHeaders, eduRows);
    XLSX.utils.book_append_sheet(wb, wsEdu, 'Education Details');
  }

  // Sheet 5: Jataka Details (only if table exists)
  if (schema.jataka.available) {
    const jatakaHeaders = [
      'Profile Code',
      'Full Name',
      'Birth Date',
      'Birth Time',
      'Birth Place',
      'Rashi',
      'Nakshatra',
      'Nakshatra Padam',
      'Gothram',
      'Manglik Status',
    ];

    const jatakaRows = records.map((r) => [
      safeExcelText(r.profileCode),
      safeExcelText(r.personal.fullName),
      parseExcelDateValue(r.jataka.birthDate),
      safeExcelText(r.jataka.birthTime),
      safeExcelText(r.jataka.birthPlace),
      safeExcelText(r.jataka.rashi),
      safeExcelText(r.jataka.nakshatra),
      safeExcelText(formatNakshatraPadamLabel(r.jataka.nakshatraPadam) || ''),
      safeExcelText(r.jataka.gothram),
      safeExcelText(r.jataka.manglikStatus),
    ]);

    const wsJataka = buildWorksheetWithWidths(jatakaHeaders, jatakaRows, [2]);
    XLSX.utils.book_append_sheet(wb, wsJataka, 'Jataka Details');
  }

  // Sheet 6: Partner Preferences (only if table exists)
  if (schema.preferences.available) {
    const prefHeaders = [
      'Profile Code',
      'Full Name',
      'Preferred Age From',
      'Preferred Age To',
      'Preferred Height From',
      'Preferred Height To',
      'Preferred Marital Status',
      'Preferred Religion',
      'Preferred Community',
      'Preferred Mother Tongue',
      'Preferred Countries',
      'Preferred Education',
      'Preferred Occupation',
      'Min Annual Income',
      'Manglik Preference',
      'Partner Expectations',
    ];

    const prefRows = records.map((r) => [
      safeExcelText(r.profileCode),
      safeExcelText(r.personal.fullName),
      Number.isFinite(r.partnerPreferences.ageFrom) ? r.partnerPreferences.ageFrom : '',
      Number.isFinite(r.partnerPreferences.ageTo) ? r.partnerPreferences.ageTo : '',
      safeExcelText(r.partnerPreferences.heightFrom),
      safeExcelText(r.partnerPreferences.heightTo),
      safeExcelText(r.partnerPreferences.maritalStatus),
      safeExcelText(r.partnerPreferences.religion),
      safeExcelText(r.partnerPreferences.community),
      safeExcelText(r.partnerPreferences.motherTongue),
      safeExcelText(r.preferredCountries ?? r.partnerPreferences.country),
      safeExcelText(r.partnerPreferences.educationLevel),
      safeExcelText(r.partnerPreferences.occupationPreference),
      safeExcelText(r.partnerPreferences.annualIncomeMin),
      safeExcelText(r.partnerPreferences.manglikPreference),
      safeExcelText(r.partnerPreferences.partnerExpectations),
    ]);

    const wsPref = buildWorksheetWithWidths(prefHeaders, prefRows);
    XLSX.utils.book_append_sheet(wb, wsPref, 'Partner Preferences');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${params.filenamePrefix ?? 'nimmi_matrimony_profile_reports'}_${stamp}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

type RgbTuple = [number, number, number];

function parseHexToRgb(hex: string, fallback: RgbTuple): RgbTuple {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function getActiveThemePdfColors(): {
  primary: RgbTuple;
  accent: RgbTuple;
  tint: RgbTuple;
  ink: RgbTuple;
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      primary: [122, 28, 44],
      accent: [197, 155, 39],
      tint: [250, 248, 245],
      ink: [35, 20, 24],
    };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: parseHexToRgb(styles.getPropertyValue('--theme-primary'), [122, 28, 44]),
    accent: parseHexToRgb(styles.getPropertyValue('--theme-accent'), [197, 155, 39]),
    tint: parseHexToRgb(styles.getPropertyValue('--theme-canvas'), [250, 248, 245]),
    ink: parseHexToRgb(styles.getPropertyValue('--theme-ink'), [35, 20, 24]),
  };
}

function addPdfHeadersAndPageNumbers(
  doc: jsPDF,
  title: string,
  subtitle: string,
  colors: { primary: RgbTuple; accent: RgbTuple; ink: RgbTuple }
) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Top branded strip
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 18, 'F');
    doc.setFillColor(...colors.accent);
    doc.rect(0, 18, pageWidth, 1.4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('NIMMI MATRIMONY', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(title, 65, 11);
    doc.text(`Generated: ${generatedStr}`, pageWidth - 14, 11, { align: 'right' });

    if (i === 1 && subtitle) {
      doc.setTextColor(...colors.ink);
      doc.setFontSize(8);
      doc.text(subtitle, 14, 24.5, { maxWidth: pageWidth - 28 });
    }

    // Bottom footer with page numbers
    doc.setDrawColor(220, 215, 210);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('Nimmi Matrimony · Super Admin Confidential Profile Report', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, {
      align: 'right',
    });
  }
}

function getLastTableY(doc: jsPDF, fallback: number): number {
  const typed = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return typed.lastAutoTable?.finalY ?? fallback;
}

export function exportFilteredProfilesSummaryPdf(params: {
  records: ProfileReportRecord[];
  appliedFiltersText: string;
  summaryCounts?: ProfileReportsSummaryCounts | null;
  totalMatching: number;
  truncated?: boolean;
}): string {
  const { records, appliedFiltersText, summaryCounts, totalMatching, truncated } = params;
  const colors = getActiveThemePdfColors();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let cursorY = 30;

  // Applied Filters & Summary Box
  doc.setFillColor(...colors.tint);
  doc.setDrawColor(...colors.accent);
  doc.roundedRect(14, cursorY - 4, pageWidth - 28, summaryCounts ? 21 : 14, 2, 2, 'FD');

  doc.setTextColor(...colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Filtered Profile Summary (${records.length.toLocaleString()} exported of ${totalMatching.toLocaleString()} matching records${
      truncated ? ' - batch cap applied' : ''
    })`,
    18,
    cursorY + 2
  );

  doc.setTextColor(...colors.ink);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Applied Filters: ${appliedFiltersText}`, 18, cursorY + 7.5, {
    maxWidth: pageWidth - 36,
  });

  if (summaryCounts) {
    doc.setFontSize(8);
    doc.text(
      `Registry Totals — Total: ${summaryCounts.totalProfiles} | Pending: ${summaryCounts.pendingProfiles} | Approved: ${summaryCounts.approvedProfiles} | Rejected: ${summaryCounts.rejectedProfiles} | Blocked: ${summaryCounts.blockedProfiles} | Male: ${summaryCounts.maleProfiles} | Female: ${summaryCounts.femaleProfiles}`,
      18,
      cursorY + 13.5,
      { maxWidth: pageWidth - 36 }
    );
  }

  cursorY += summaryCounts ? 23 : 16;

  autoTable(doc, {
    startY: cursorY,
    margin: { top: 24, bottom: 16, left: 14, right: 14 },
    head: [
      [
        'Code',
        'Full Name',
        'Gender',
        'DOB / Age',
        'Marital',
        'Religion / Community',
        'Location',
        'Education',
        'Occupation / Income',
        'Status',
        'Registered',
      ],
    ],
    body: records.map((r) => [
      textOrFallback(r.profileCode),
      textOrFallback(r.personal.fullName),
      textOrFallback(normalizeProfileGender(r.personal.gender)),
      `${r.personal.dateOfBirth || '—'} (${r.personal.age > 0 ? `${r.personal.age}y` : '—'})`,
      textOrFallback(r.personal.maritalStatus),
      [r.religionName || '—', r.communityName || '—'].join(' / '),
      [r.city, r.state, r.country].filter(Boolean).join(', ') || NOT_PROVIDED,
      textOrFallback(r.educationOccupation.qualification),
      [r.educationOccupation.occupation, r.educationOccupation.annualIncome]
        .filter(Boolean)
        .join(' · ') || NOT_PROVIDED,
      r.profileStatus,
      r.createdAt || NOT_PROVIDED,
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: colors.ink,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: colors.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: colors.tint,
    },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
  });

  addPdfHeadersAndPageNumbers(
    doc,
    'Super Admin · Profile Summary Report',
    '',
    colors
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `nimmi_matrimony_profiles_summary_${stamp}.pdf`;
  doc.save(filename);
  return filename;
}

export function exportSingleProfileDetailPdf(params: {
  profile: ProfileReportRecord;
  schema: ProfileReportsSchemaInspection;
}): string {
  const { profile: p, schema } = params;
  const colors = getActiveThemePdfColors();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let cursorY = 26;

  // Profile Identity Banner
  doc.setFillColor(...colors.tint);
  doc.setDrawColor(...colors.accent);
  doc.roundedRect(14, cursorY, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setTextColor(...colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(textOrFallback(p.personal.fullName), 18, cursorY + 8);

  doc.setTextColor(...colors.ink);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Profile Code: ${textOrFallback(p.profileCode)}   |   Status: ${p.profileStatus}   |   Registered: ${textOrFallback(
      p.createdAt
    )}`,
    18,
    cursorY + 14
  );
  doc.text(
    `${textOrFallback(normalizeProfileGender(p.personal.gender))} · ${
      p.personal.age > 0 ? `${p.personal.age} yrs` : NOT_PROVIDED
    } · ${[p.city, p.state, p.country].filter(Boolean).join(', ') || NOT_PROVIDED}`,
    18,
    cursorY + 19
  );

  cursorY += 27;

  const renderSectionTable = (
    heading: string,
    rows: [string, string][]
  ) => {
    // Prevent orphaned section heading near page bottom
    if (cursorY > pageHeight - 40) {
      doc.addPage();
      cursorY = 25;
    }

    doc.setTextColor(...colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(heading, 14, cursorY);
    cursorY += 2.5;

    autoTable(doc, {
      startY: cursorY,
      margin: { top: 24, bottom: 16, left: 14, right: 14 },
      head: [['Field', 'Value']],
      body: rows,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.3,
        textColor: colors.ink,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: pageWidth - 28 - 55 },
      },
      alternateRowStyles: {
        fillColor: colors.tint,
      },
      rowPageBreak: 'avoid',
      showHead: 'firstPage',
    });

    cursorY = getLastTableY(doc, cursorY) + 7;
  };

  renderSectionTable('A. Personal Details', [
    ['Profile Code', textOrFallback(p.profileCode)],
    ['Full Name', textOrFallback(p.personal.fullName)],
    ...(schema.hasEmail ? [['Email', textOrFallback(p.email)] as [string, string]] : []),
    ['Gender', textOrFallback(normalizeProfileGender(p.personal.gender))],
    ['Date of Birth', textOrFallback(p.personal.dateOfBirth)],
    ['Age', p.personal.age > 0 ? `${p.personal.age} yrs` : NOT_PROVIDED],
    ['Marital Status', textOrFallback(p.personal.maritalStatus)],
    ['Religion', textOrFallback(p.religionName || p.religionCommunity.religion)],
    ['Community', textOrFallback(p.communityName || p.religionCommunity.community)],
    ['Mother Tongue', textOrFallback(p.personal.motherTongue)],
    ['Height', textOrFallback(p.personal.height)],
    ['Country / State / City', [p.country, p.state, p.city].filter(Boolean).join(', ') || NOT_PROVIDED],
    ['Diet / Smoking / Drinking', `${p.personal.diet} · Smoking: ${p.personal.smoking} · Drinking: ${p.personal.drinking}`],
    ['Complexion / Body Type', [p.personal.complexion, p.personal.bodyType].filter(Boolean).join(' · ') || NOT_PROVIDED],
    ['Hobbies', textOrFallback(p.personal.hobbies)],
    ['About Member', textOrFallback(p.personal.aboutMe)],
    ['Profile Status & ID Verified', `${p.profileStatus} · ID Verified: ${p.verifiedId ? 'Yes' : 'No'}`],
  ]);

  renderSectionTable('B. Family Details', [
    ['Father Name', textOrFallback(p.family.fatherName)],
    ['Father Occupation', textOrFallback(p.family.fatherOccupation)],
    ['Mother Name', textOrFallback(p.family.motherName)],
    ['Mother Occupation', textOrFallback(p.family.motherOccupation)],
    ['Siblings', `Brothers: ${p.family.brothers} (Married: ${p.family.brothersMarried}) · Sisters: ${p.family.sisters} (Married: ${p.family.sistersMarried})`],
    ['Family Type', textOrFallback(p.family.familyType)],
    ...(schema.family.hasFamilyStatus
      ? [['Family Status', textOrFallback(p.familyStatus)] as [string, string]]
      : []),
    ['Family Values', textOrFallback(p.family.familyValues)],
    ['Family Location', textOrFallback(p.family.familyLocation)],
    ['Ancestral Origin', textOrFallback(p.family.ancestralOrigin)],
    ['About Family', textOrFallback(p.family.aboutFamily)],
  ]);

  renderSectionTable('C. Education Details', [
    ['Qualification', textOrFallback(p.educationOccupation.qualification)],
    ['Course', textOrFallback(p.educationOccupation.course)],
    ['Specialization', textOrFallback(p.educationOccupation.specialization)],
    ['Institution', textOrFallback(p.educationOccupation.institution)],
    ['University', textOrFallback(p.educationOccupation.university)],
    ['Passing Year', textOrFallback(p.educationOccupation.passingYear)],
    ...(schema.education.gradeColumn
      ? [['Grade / Percentage', textOrFallback(p.educationGrade)] as [string, string]]
      : []),
  ]);

  renderSectionTable('D. Occupation Details', [
    ['Occupation', textOrFallback(p.educationOccupation.occupation)],
    ['Company / Employer', textOrFallback(p.educationOccupation.companyName)],
    ['Employment Type', textOrFallback(p.educationOccupation.employmentType)],
    ['Annual Income', textOrFallback(p.educationOccupation.annualIncome)],
    [
      'Work Location',
      [p.educationOccupation.workCity, p.educationOccupation.workState, p.educationOccupation.workCountry]
        .filter(Boolean)
        .join(', ') || NOT_PROVIDED,
    ],
  ]);

  renderSectionTable('E. Horoscope / Jataka Details', [
    ['Birth Date', textOrFallback(p.jataka.birthDate)],
    ['Birth Time', textOrFallback(p.jataka.birthTime)],
    ['Birth Place', textOrFallback(p.jataka.birthPlace)],
    ['Rashi', textOrFallback(p.jataka.rashi)],
    ['Nakshatra', textOrFallback(p.jataka.nakshatra)],
    ['Nakshatra Padam', textOrFallback(formatNakshatraPadamLabel(p.jataka.nakshatraPadam))],
    ['Gothram', textOrFallback(p.jataka.gothram)],
    ['Manglik Status', textOrFallback(p.jataka.manglikStatus)],
  ]);

  renderSectionTable('F. Partner Preferences', [
    ['Preferred Age', `${p.partnerPreferences.ageFrom} to ${p.partnerPreferences.ageTo} yrs`],
    ['Preferred Religion', textOrFallback(p.partnerPreferences.religion)],
    ['Preferred Community', textOrFallback(p.partnerPreferences.community)],
    ['Preferred Countries', textOrFallback(p.preferredCountries ?? p.partnerPreferences.country)],
    ['Preferred Education', textOrFallback(p.partnerPreferences.educationLevel)],
    ['Preferred Marital Status', textOrFallback(p.partnerPreferences.maritalStatus)],
    ['Preferred Occupation', textOrFallback(p.partnerPreferences.occupationPreference)],
    ['Partner Expectations', textOrFallback(p.partnerPreferences.partnerExpectations)],
  ]);

  const approvedPhotos = p.photos.filter((ph) => ph.status === 'Approved');
  renderSectionTable(
    'G. Approved Profile Photos',
    approvedPhotos.length > 0
      ? approvedPhotos.map((ph, idx) => [
          `Photo ${idx + 1}`,
          `${ph.caption || 'Profile Photo'} (${ph.isPrimary ? 'Primary' : 'Gallery'}${
            ph.uploadedAt ? ` · Uploaded ${ph.uploadedAt}` : ''
          })`,
        ])
      : [['Approved Photos', NOT_PROVIDED]]
  );

  addPdfHeadersAndPageNumbers(
    doc,
    `Super Admin · Member Detail Report (${p.profileCode})`,
    '',
    colors
  );

  const safeCode = (p.profileCode || p.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `nimmi_profile_${safeCode}.pdf`;
  doc.save(filename);
  return filename;
}
