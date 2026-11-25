import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatPriceInr } from '../services/masterDataService';
import { ProfileAnalyticsDashboardData } from '../types/matrimony';

function safeExcelCell(val: string | number | null | undefined): string | number {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const s = String(val).trim();
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

function buildAutoSizedSheet(
  headers: string[],
  rows: (string | number)[][]
): XLSX.WorkSheet {
  const safeRows = rows.map((row) => row.map((cell) => safeExcelCell(cell)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);
  ws['!cols'] = headers.map((h, colIdx) => {
    let maxLen = h.length;
    for (let r = 0; r < Math.min(safeRows.length, 300); r++) {
      const len = String(safeRows[r]?.[colIdx] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.max(14, Math.min(44, maxLen + 3)) };
  });
  return ws;
}

/**
 * Exports filtered Profile Analytics into a 10-sheet Excel workbook (.xlsx)
 */
export function exportProfileAnalyticsToExcel(
  data: ProfileAnalyticsDashboardData
): string {
  const wb = XLSX.utils.book_new();

  // 1. Dashboard Summary
  const summaryRows: (string | number)[][] = [
    ['Report Title', 'Nimmi Matrimony — Super Admin Profile Analytics'],
    ['Generated At', new Date(data.generatedAt).toLocaleString('en-IN')],
    ['Applied Filters', data.appliedFiltersLabel],
    ['Data Source', data.aggregationSource === 'rpc' ? 'PostgreSQL Server RPC' : 'Server-Filtered Supabase Queries'],
    ['', ''],
    ['Metric', 'Value'],
    ['Total Registered Profiles', data.summary.totalProfiles],
    ['New Registrations Today', data.summary.newToday],
    ['Registrations This Month', data.summary.thisMonth],
    ['Approved Profiles', data.summary.approvedProfiles],
    ['Pending Profiles', data.summary.pendingProfiles],
    ['Rejected Profiles', data.summary.rejectedProfiles],
    ['Blocked Profiles', data.summary.blockedProfiles],
    [
      'Active Members (Approved + Active Non-Expired Subscription)',
      data.summary.activeMembers,
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(['Category / Metric', 'Value'], summaryRows),
    'Dashboard Summary'
  );

  // 2. Registration Trends
  const trendRows: (string | number)[][] = [];
  for (const d of data.dailyRegistrations) {
    trendRows.push(['Daily', d.date, d.count, '']);
  }
  for (const m of data.monthlyRegistrations) {
    trendRows.push([
      'Monthly',
      m.month,
      m.count,
      m.momDeltaPct !== null ? `${m.momDeltaPct >= 0 ? '+' : ''}${m.momDeltaPct}% MoM` : '',
    ]);
  }
  for (const y of data.yearlyRegistrations) {
    trendRows.push([
      'Yearly',
      String(y.year),
      y.count,
      y.yoyGrowthPct !== null ? `${y.yoyGrowthPct >= 0 ? '+' : ''}${y.yoyGrowthPct}% YoY` : '',
    ]);
  }
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['Granularity', 'Period', 'Registrations', 'Growth Comparison'],
      trendRows
    ),
    'Registration Trends'
  );

  // 3. Gender Distribution
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['Gender', 'Profile Count', 'Percentage (%)'],
      data.genderDistribution.map((g) => [g.gender, g.count, g.percentage])
    ),
    'Gender Distribution'
  );

  // 4. Religion Distribution
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['Religion', 'Profile Count', 'Percentage (%)'],
      data.religionDistribution.map((r) => [r.religionName, r.count, r.percentage])
    ),
    'Religion Distribution'
  );

  // 5. Community Distribution
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['Community', 'Religion', 'Profile Count', 'Percentage of Total (%)'],
      data.communityDistribution.map((c) => [
        c.communityName,
        c.religionName,
        c.count,
        c.percentage,
      ])
    ),
    'Community Distribution'
  );

  // 6. State-wise Statistics
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['State', 'Total Profiles', 'Male Profiles', 'Female Profiles'],
      data.stateStats.map((s) => [s.state, s.total, s.maleCount, s.femaleCount])
    ),
    'State-wise Statistics'
  );

  // 7. City-wise Statistics
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['City', 'State', 'Total Profiles'],
      data.cityStats.map((c) => [c.city, c.state, c.total])
    ),
    'City-wise Statistics'
  );

  // 8. Profile Approval Statistics
  const approvalRows: (string | number)[][] = [
    ['Approved Profiles', data.approvalAnalytics.approvedCount, `${data.approvalAnalytics.approvalRatePct}%`],
    ['Pending Profiles', data.approvalAnalytics.pendingCount, ''],
    ['Rejected Profiles', data.approvalAnalytics.rejectedCount, `${data.approvalAnalytics.rejectionRatePct}%`],
    ['Blocked Profiles', data.approvalAnalytics.blockedCount, ''],
    [
      'Approval Timestamp History Available',
      data.approvalAnalytics.hasApprovalHistory ? 'Yes' : 'Not stored in current schema',
      '',
    ],
  ];
  if (data.approvalAnalytics.hasApprovalHistory) {
    approvalRows.push(['', '', '']);
    approvalRows.push(['Monthly Approval Trends', 'Approved Count', '']);
    for (const m of data.approvalAnalytics.monthlyApprovals) {
      approvalRows.push([m.month, m.count, '']);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(['Metric / Period', 'Count', 'Rate'], approvalRows),
    'Profile Approval Statistics'
  );

  // 9. Membership Statistics
  const memRows: (string | number)[][] = [
    ['Total Subscriptions', data.membershipAnalytics.totalSubscriptions, '', '', '', ''],
    ['Active Subscriptions', data.membershipAnalytics.activeSubscriptions, '', '', '', ''],
    ['Pending Subscriptions', data.membershipAnalytics.pendingSubscriptions, '', '', '', ''],
    ['Expired Subscriptions', data.membershipAnalytics.expiredSubscriptions, '', '', '', ''],
    ['Cancelled Subscriptions', data.membershipAnalytics.cancelledSubscriptions, '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Plan Name', 'Total', 'Active', 'Pending', 'Expired', 'Cancelled'],
    ...data.membershipAnalytics.planDistribution.map((p) => [
      p.planName,
      p.totalCount,
      p.activeCount,
      p.pendingCount,
      p.expiredCount,
      p.cancelledCount,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    buildAutoSizedSheet(
      ['Metric / Plan', 'Count / Total', 'Active', 'Pending', 'Expired', 'Cancelled'],
      memRows
    ),
    'Membership Statistics'
  );

  // 10. Payment & Revenue Statistics (only when payment data is available)
  if (data.paymentAnalytics.available) {
    const payRows: (string | number)[][] = [
      ['Successful Payments', data.paymentAnalytics.successfulCount, data.paymentAnalytics.totalSuccessfulAmount],
      ['Pending Payments', data.paymentAnalytics.pendingCount, ''],
      ['Failed Payments', data.paymentAnalytics.failedCount, ''],
      ['Refunded Payments', data.paymentAnalytics.refundedCount, ''],
      ['Current Month Verified Revenue (INR)', '', data.paymentAnalytics.currentMonthRevenue],
      ['', '', ''],
      ['Month', 'Successful Count', 'Verified Revenue (INR)'],
      ...data.paymentAnalytics.monthlyRevenue.map((m) => [m.month, m.count, m.amount]),
      ['', '', ''],
      ['Plan Name', 'Successful Payments', 'Verified Revenue (INR)'],
      ...data.paymentAnalytics.revenueByPlan.map((p) => [p.planName, p.count, p.amount]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      buildAutoSizedSheet(['Metric / Period / Plan', 'Count', 'Amount (INR)'], payRows),
      'Payment & Revenue Statistics'
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `Nimmi_Matrimony_Profile_Analytics_${stamp}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

function resolveBrandRgb(): {
  primary: [number, number, number];
  accent: [number, number, number];
  tint: [number, number, number];
} {
  const hexToRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
    const clean = hex.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  };
  if (typeof window === 'undefined') {
    return { primary: [122, 28, 44], accent: [197, 155, 39], tint: [250, 248, 245] };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: hexToRgb(styles.getPropertyValue('--theme-primary'), [122, 28, 44]),
    accent: hexToRgb(styles.getPropertyValue('--theme-accent'), [197, 155, 39]),
    tint: hexToRgb(styles.getPropertyValue('--theme-canvas'), [250, 248, 245]),
  };
}

export interface AnalyticsChartSnapshotImages {
  dailyChartPng?: string | null;
  genderChartPng?: string | null;
  religionChartPng?: string | null;
  approvalChartPng?: string | null;
  membershipChartPng?: string | null;
}

/**
 * Generates a branded Nimmi Matrimony Analytics PDF with KPI summary cards,
 * rasterized charts, statistical tables, applied filters, and page numbers.
 */
export function exportProfileAnalyticsToPdf(
  data: ProfileAnalyticsDashboardData,
  charts: AnalyticsChartSnapshotImages
): string {
  const { primary, accent, tint } = resolveBrandRgb();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageWidth - margin * 2;
  const generatedLabel = new Date(data.generatedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Branded Header
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageWidth, 66, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 66, pageWidth, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('NIMMI MATRIMONY', margin, 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Super Admin Profile Analytics Report', margin, 46);
  doc.setFontSize(8.5);
  doc.text(`Generated: ${generatedLabel}`, pageWidth - margin, 46, { align: 'right' });

  let y = 84;

  // Applied Filters Box
  doc.setFillColor(tint[0], tint[1], tint[2]);
  doc.setDrawColor(215, 210, 200);
  doc.roundedRect(margin, y, contentW, 30, 4, 4, 'FD');
  doc.setTextColor(60, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('APPLIED FILTERS:', margin + 10, y + 12);
  doc.setFont('helvetica', 'normal');
  const filterLines = doc.splitTextToSize(data.appliedFiltersLabel, contentW - 105);
  doc.text(filterLines.slice(0, 2), margin + 92, y + 12);
  y += 42;

  // 8 KPI Summary Cards Grid (4 x 2)
  const cards = [
    { label: 'Total Profiles', value: data.summary.totalProfiles.toLocaleString() },
    { label: 'New Today', value: data.summary.newToday.toLocaleString() },
    { label: 'This Month', value: data.summary.thisMonth.toLocaleString() },
    { label: 'Active Members', value: data.summary.activeMembers.toLocaleString() },
    { label: 'Approved', value: data.summary.approvedProfiles.toLocaleString() },
    { label: 'Pending', value: data.summary.pendingProfiles.toLocaleString() },
    { label: 'Rejected', value: data.summary.rejectedProfiles.toLocaleString() },
    { label: 'Blocked', value: data.summary.blockedProfiles.toLocaleString() },
  ];

  const cardGap = 8;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 42;

  cards.forEach((c, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = margin + col * (cardW + cardGap);
    const cy = y + row * (cardH + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 205, 200);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(c.label, x + 8, cy + 14);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(c.value, x + 8, cy + 32);
  });

  y += cardH * 2 + cardGap + 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 40;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(32);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 8;
  };

  const addChartImage = (png: string | null | undefined, heightPt = 135, widthPt = contentW) => {
    if (!png) return;
    ensureSpace(heightPt + 12);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, widthPt, heightPt);
    doc.addImage(png, 'PNG', margin + 2, y + 2, widthPt - 4, heightPt - 4);
    y += heightPt + 12;
  };

  const runTable = (head: string[][], body: (string | number)[][]) => {
    ensureSpace(50);
    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 248, 245] },
      rowPageBreak: 'avoid',
    });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    y = (finalY ?? y + 40) + 16;
  };

  // Registration Trends & Chart
  addSectionTitle('1. Registration Growth Analytics');
  addChartImage(charts.dailyChartPng, 130);
  if (data.monthlyRegistrations.length > 0) {
    runTable(
      [['Month', 'Registrations', 'MoM Change']],
      data.monthlyRegistrations.slice(-12).map((m) => [
        m.label,
        m.count.toLocaleString(),
        m.momDeltaPct !== null ? `${m.momDeltaPct >= 0 ? '+' : ''}${m.momDeltaPct}%` : '—',
      ])
    );
  }
  if (data.yearlyRegistrations.length > 0) {
    runTable(
      [['Year', 'Annual Registrations', 'YoY Growth']],
      data.yearlyRegistrations.map((yr) => [
        yr.year,
        yr.count.toLocaleString(),
        yr.yoyGrowthPct !== null ? `${yr.yoyGrowthPct >= 0 ? '+' : ''}${yr.yoyGrowthPct}%` : '—',
      ])
    );
  }

  // Gender & Approval Charts
  addSectionTitle('2. Gender & Profile Approval Analytics');
  addChartImage(charts.genderChartPng, 135, 195);
  runTable(
    [['Gender', 'Profiles', 'Share']],
    data.genderDistribution.map((g) => [g.gender, g.count.toLocaleString(), `${g.percentage.toFixed(1)}%`])
  );
  addChartImage(charts.approvalChartPng, 125);
  runTable(
    [['Status', 'Count', 'Rate / Notes']],
    [
      ['Approved', data.approvalAnalytics.approvedCount.toLocaleString(), `${data.approvalAnalytics.approvalRatePct}% Approval Rate`],
      ['Pending', data.approvalAnalytics.pendingCount.toLocaleString(), 'Awaiting review'],
      ['Rejected', data.approvalAnalytics.rejectedCount.toLocaleString(), `${data.approvalAnalytics.rejectionRatePct}% Rejection Rate`],
      ['Blocked', data.approvalAnalytics.blockedCount.toLocaleString(), 'Restricted'],
    ]
  );

  // Religion & Community
  addSectionTitle('3. Religion & Community Distribution');
  addChartImage(charts.religionChartPng, 135);
  runTable(
    [['Religion', 'Profiles', 'Share']],
    data.religionDistribution.map((r) => [
      r.religionName,
      r.count.toLocaleString(),
      `${r.percentage.toFixed(1)}%`,
    ])
  );
  if (data.communityDistribution.length > 0) {
    runTable(
      [['Community', 'Religion', 'Profiles', 'Share']],
      data.communityDistribution.slice(0, 25).map((c) => [
        c.communityName,
        c.religionName,
        c.count.toLocaleString(),
        `${c.percentage.toFixed(1)}%`,
      ])
    );
  }

  // Geographic Analytics
  addSectionTitle('4. Geographic Distribution (Top States & Cities)');
  if (data.stateStats.length > 0) {
    runTable(
      [['State', 'Total Profiles', 'Male', 'Female']],
      data.stateStats.slice(0, 15).map((s) => [
        s.state,
        s.total.toLocaleString(),
        s.maleCount.toLocaleString(),
        s.femaleCount.toLocaleString(),
      ])
    );
  }
  if (data.cityStats.length > 0) {
    runTable(
      [['City', 'State', 'Total Profiles']],
      data.cityStats.slice(0, 20).map((c) => [c.city, c.state, c.total.toLocaleString()])
    );
  }

  // Membership & Revenue
  addSectionTitle('5. Membership & Revenue Analytics');
  addChartImage(charts.membershipChartPng, 130);
  runTable(
    [['Plan Name', 'Total', 'Active', 'Pending', 'Expired', 'Cancelled']],
    data.membershipAnalytics.planDistribution.map((p) => [
      p.planName,
      p.totalCount,
      p.activeCount,
      p.pendingCount,
      p.expiredCount,
      p.cancelledCount,
    ])
  );

  if (data.paymentAnalytics.available) {
    runTable(
      [['Payment Metric', 'Count', 'Verified Revenue']],
      [
        ['Successful Payments', data.paymentAnalytics.successfulCount, formatPriceInr(data.paymentAnalytics.totalSuccessfulAmount)],
        ['Pending Payments', data.paymentAnalytics.pendingCount, 'Excluded from revenue'],
        ['Failed Payments', data.paymentAnalytics.failedCount, 'Excluded from revenue'],
        ['Refunded Payments', data.paymentAnalytics.refundedCount, 'Excluded from revenue'],
      ]
    );
  } else {
    ensureSpace(24);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      data.paymentAnalytics.reason || 'Payment transaction data is not available in this database.',
      margin,
      y
    );
    y += 18;
  }

  // Footer with Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 220, 210);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nimmi Matrimony · Confidential Super Admin Analytics', margin, pageHeight - 17);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 17, {
      align: 'right',
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `Nimmi_Matrimony_Profile_Analytics_${stamp}.pdf`;
  doc.save(filename);
  return filename;
}
