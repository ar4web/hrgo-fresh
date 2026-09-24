// HR + Operations — shared demo seed (goHR, Riyadh).
// Fictional data only (sequential fake IDs). Company profile / Nitaqat / licence
// are placeholders — the owner edits them in Settings (settings.html).
// In API mode (?api=1) these are replaced by /api/hr/* via hr-api.js.

export const SEED_COMPANY = {
  nameEn: 'Basmat Almawared Company Limited',
  nameAr: 'شركة بصمة الموارد المحدودة',
  crNo: '1010XXXXXX',
  addressEn: 'Riyadh, Saudi Arabia',
  addressAr: 'الرياض، المملكة العربية السعودية',
  email: 'info@basmat-almawared.com',
  logoUrl: '/images/basmat-logo.png',
  primary: '#f97316',
  defaultLang: 'en'
};

export const SEED_NITAQAT = {
  activity: '', // set in Settings, e.g. "Construction — Alexandria, VA 22302"
  sizeClass: '', // set in Settings, e.g. "Medium (50–499)"
  targetPct: 0, // Saudization target % for the band math
  notes: ''
};

export const SEED_LICENCE = {
  scope: 'both', // service | labour | both — confirm with counsel (D11)
  licenceNo: '',
  notes: '',
  strictAjeerGuards: true // pre-2026 secondment guardrails ON until counsel relaxes
};

export const DEPARTMENTS = [
  { code: 'OPS', en: 'Operations', ar: 'التشغيل', head: 'EMP-0004', costCenter: 'CC-100' },
  {
    code: 'HR',
    en: 'Human Resources',
    ar: 'الموارد البشرية',
    head: 'EMP-0001',
    costCenter: 'CC-200'
  },
  { code: 'FIN', en: 'Finance', ar: 'المالية', head: 'EMP-0002', costCenter: 'CC-300' },
  {
    code: 'PRO',
    en: 'Government Relations',
    ar: 'العلاقات الحكومية',
    head: 'EMP-0003',
    costCenter: 'CC-400'
  },
  { code: 'REC', en: 'Recruitment', ar: 'التوظيف', head: 'EMP-0005', costCenter: 'CC-500' }
];

export const PROFESSIONS = [
  { code: 'driver', en: 'Driver', ar: 'سائق' },
  { code: 'cleaner', en: 'Cleaner', ar: 'عامل نظافة' },
  { code: 'construction', en: 'Construction worker', ar: 'عامل إنشاءات' },
  { code: 'mason', en: 'Mason', ar: 'بناء' },
  { code: 'electrician', en: 'Electrician', ar: 'كهربائي' },
  { code: 'plumber', en: 'Plumber', ar: 'سباك' },
  { code: 'guard', en: 'Security guard', ar: 'حارس أمن' },
  { code: 'foreman', en: 'Foreman', ar: 'مشرف عمال' },
  { code: 'office', en: 'Office assistant', ar: 'مساعد إداري' },
  { code: 'specialist', en: 'Specialist', ar: 'أخصائي' }
];

export const COMPANIES = [
  { code: 'co-1', nameEn: 'goHR', nameAr: 'goHR', crNo: '1010XXXXXX', taxNo: '310XXXXXX', addressEn: 'Riyadh, Saudi Arabia', addressAr: 'الرياض، المملكة العربية السعودية', phone: '+966 11 000 0000', email: 'info@example.com', website: '', isActive: true },
  { code: 'co-2', nameEn: 'GOSI', nameAr: 'التأمينات الاجتماعية', crNo: '', taxNo: '', addressEn: 'Riyadh, Saudi Arabia', addressAr: 'الرياض، المملكة العربية السعودية', phone: '+966 11 000 0001', email: 'info@gosi.sa', website: 'www.gosi.sa', isActive: true }
];

export const SALUTATIONS = [
  { code: 'mr', en: 'Mr.', ar: 'السيد' },
  { code: 'mrs', en: 'Mrs.', ar: 'السيدة' },
  { code: 'ms', en: 'Ms.', ar: 'السيدة' },
  { code: 'dr', en: 'Dr.', ar: 'دكتور' },
  { code: 'eng', en: 'Eng.', ar: 'مهندس' },
  { code: 'prof', en: 'Prof.', ar: 'أستاذ' }
];

// — T2 Command Center seed extensions (v3 §2–§3, §6) —
export const SKILLS = [
  { code: 'heavy-driving', en: 'Heavy-vehicle driving', ar: 'قيادة المعدات الثقيلة' },
  { code: 'light-driving', en: 'Light-vehicle driving', ar: 'قيادة المركبات الخفيفة' },
  { code: 'route-planning', en: 'Route planning', ar: 'تخطيط المسارات' },
  { code: 'deep-cleaning', en: 'Deep cleaning', ar: 'التنظيف العميق' },
  { code: 'waste-handling', en: 'Waste handling', ar: 'التعامل مع النفايات' },
  { code: 'housekeeping', en: 'Housekeeping', ar: 'التدبير المنزلي' },
  { code: 'scaffolding', en: 'Scaffolding', ar: 'السقالات' },
  { code: 'concrete-work', en: 'Concrete work', ar: 'أعمال الخرسانة' },
  { code: 'site-safety', en: 'Site safety', ar: 'السلامة الموقعية' },
  { code: 'blockwork', en: 'Blockwork', ar: 'البناء بالطوب' },
  { code: 'tiling', en: 'Tiling', ar: 'التبليط' },
  { code: 'plastering', en: 'Plastering', ar: 'اللياسة' },
  { code: 'wiring', en: 'Electrical wiring', ar: 'التمديدات الكهربائية' },
  { code: 'panel-maintenance', en: 'Panel maintenance', ar: 'صيانة اللوحات' },
  { code: 'troubleshooting', en: 'Fault troubleshooting', ar: 'كشف الأعطال' },
  { code: 'pipefitting', en: 'Pipefitting', ar: 'تركيب الأنابيب' },
  { code: 'drainage', en: 'Drainage works', ar: 'أعمال الصرف' },
  { code: 'fixture-install', en: 'Fixture installation', ar: 'تركيب الأدوات الصحية' },
  { code: 'supervision', en: 'Team supervision', ar: 'الإشراف على الفريق' },
  { code: 'reporting', en: 'Site reporting', ar: 'تقارير الموقع' },
  { code: 'data-entry', en: 'Data entry', ar: 'إدخال البيانات' },
  { code: 'filing', en: 'Filing & records', ar: 'الأرشفة' },
  { code: 'reception', en: 'Reception', ar: 'الاستقبال' },
  { code: 'recruitment', en: 'Recruitment', ar: 'الاستقطاب' },
  { code: 'employee-relations', en: 'Employee relations', ar: 'علاقات الموظفين' },
  { code: 'scheduling', en: 'Shift scheduling', ar: 'جدولة الورديات' },
  { code: 'logistics', en: 'Logistics coordination', ar: 'تنسيق اللوجستيات' },
  { code: 'government-relations', en: 'Government relations', ar: 'العلاقات الحكومية' },
  { code: 'documentation', en: 'Documentation', ar: 'التوثيق' },
  { code: 'payroll', en: 'Payroll processing', ar: 'معالجة الرواتب' },
  { code: 'accounting', en: 'Accounting', ar: 'المحاسبة' },
  { code: 'interviewing', en: 'Interviewing', ar: 'المقابلات' }
];

export const SPONSORS = [
  {
    id: 'HQ',
    nameEn: 'goHR — HQ',
    nameAr: 'goHR — المركز الرئيسي',
    cr: '1010XXXXXX',
    city: 'Riyadh'
  },
  {
    id: 'BR-JED',
    nameEn: 'goHR — Jeddah Branch',
    nameAr: 'goHR — فرع جدة',
    cr: '4030XXXXXX',
    city: 'Jeddah'
  }
];

// owner = EMP code (personal) or role code (hr/pro/payroll/finance/manager).
// done flips via the hr:import:tasks overlay (same import machinery as the rest).
export const TASKS = [
  {
    id: 'TSK-01',
    titleEn: 'Renew iqamas expiring within 30 days',
    titleAr: 'تجديد الإقامات التي تنتهي خلال ٣٠ يومًا',
    owner: 'pro',
    due: '2026-09-15',
    priority: 'high',
    done: false,
    link: 'employees.html'
  },
  {
    id: 'TSK-02',
    titleEn: 'Close huroob case file (EMP-0027)',
    titleAr: 'إغلاق ملف بلاغ الهروب (EMP-0027)',
    owner: 'hr',
    due: '2026-09-14',
    priority: 'high',
    done: false,
    link: 'employee-file.html?code=EMP-0027'
  },
  {
    id: 'TSK-06',
    titleEn: 'Photograph the new Jeddah site roster board',
    titleAr: 'تصوير لوحة كشف موقع جدة الجديد',
    owner: 'EMP-0002',
    due: '2026-09-18',
    priority: 'low',
    done: false,
    link: 'employees.html'
  },
  {
    id: 'TSK-07',
    titleEn: 'Confirm Nitaqat target with legal counsel',
    titleAr: 'تأكيد مستهدف نطاقات مع المستشار القانوني',
    owner: 'EMP-0001',
    due: '2026-09-20',
    priority: 'medium',
    done: false,
    link: 'settings.html'
  }
];

// Money = monthly SAR (major units in seed; engine converts to halalas).
// q = Qiwa contract status: authenticated | sent | draft
// st = active | probation | on-leave | exited | huroob
export const EMPLOYEES = [
  // — Saudis (internal staff) —
  {
    code: 'EMP-0001',
    nameEn: 'Abdullah Al-Otaibi',
    nameAr: 'عبدالله العتيبي',
    nat: 'Saudi',
    passport: 'P10000001',
    passportExp: '2029-04-18',
    saudi: true,
    nid: '1000000001',
    prof: 'specialist',
    dept: 'HR',
    titleEn: 'HR Manager',
    titleAr: 'مدير الموارد البشرية',
    join: '2022-03-01',
    basic: 9000,
    housing: 2250,
    transport: 1000,
    gosi: 'G000001',
    gosiOn: '2022-03-05',
    iban: 'SA1000000000000000000001',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['employee-relations', 'documentation', 'recruitment'],
    sponsor: 'HQ',
    phone: '+966 555 010 001',
    email: 'a.alotaibi@company.sa',
    av: 'primary'
  },
  {
    code: 'EMP-0002',
    nameEn: 'Khalid Al-Dossari',
    nameAr: 'خالد الدوسري',
    nat: 'Saudi',
    passport: 'P10000002',
    passportExp: '2028-11-02',
    saudi: true,
    nid: '1000000002',
    prof: 'specialist',
    dept: 'OPS',
    titleEn: 'Operations Coordinator',
    titleAr: 'منسق التشغيل',
    join: '2023-01-15',
    basic: 7500,
    housing: 1875,
    transport: 800,
    gosi: 'G000002',
    gosiOn: '2023-01-20',
    iban: 'SA1000000000000000000002',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['reporting', 'scheduling', 'logistics'],
    sponsor: 'HQ',
    phone: '+966 555 010 002',
    email: 'k.dossari@company.sa',
    av: 'blue'
  },
  {
    code: 'EMP-0003',
    nameEn: 'Noura Al-Qahtani',
    nameAr: 'نورة القحطاني',
    nat: 'Saudi',
    passport: 'P10000003',
    passportExp: '2026-08-25',
    saudi: true,
    nid: '1000000003',
    prof: 'specialist',
    dept: 'PRO',
    titleEn: 'PRO Officer',
    titleAr: 'مسؤولة العلاقات الحكومية',
    join: '2024-09-01',
    basic: 6000,
    housing: 1500,
    transport: 700,
    gosi: 'G000003',
    gosiOn: '2024-09-05',
    iban: 'SA1000000000000000000003',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'F',
    skills: ['government-relations', 'documentation'],
    sponsor: 'HQ',
    phone: '+966 555 010 003',
    email: 'n.qahtani@company.sa',
    av: 'purple'
  },
  {
    code: 'EMP-0004',
    nameEn: 'Fahad Al-Shammari',
    nameAr: 'فهد الشمري',
    nat: 'Saudi',
    passport: 'P10000004',
    passportExp: '2030-01-30',
    saudi: true,
    nid: '1000000004',
    prof: 'specialist',
    dept: 'FIN',
    titleEn: 'Accountant',
    titleAr: 'محاسب',
    join: '2025-02-10',
    basic: 6500,
    housing: 1625,
    transport: 700,
    gosi: 'G000004',
    gosiOn: '2025-02-12',
    iban: 'SA1000000000000000000004',
    bank: 'Riyad Bank',
    q: 'sent',
    st: 'active',
    gender: 'M',
    skills: ['accounting', 'reporting', 'payroll'],
    sponsor: 'HQ',
    phone: '+966 555 010 004',
    email: 'f.shammari@company.sa',
    av: 'green'
  },
  {
    code: 'EMP-0005',
    nameEn: 'Reem Al-Harbi',
    nameAr: 'ريم الحربي',
    nat: 'Saudi',
    passport: 'P10000005',
    passportExp: '2029-07-12',
    saudi: true,
    nid: '1000000005',
    prof: 'specialist',
    dept: 'REC',
    titleEn: 'Recruiter (part-time)',
    titleAr: 'أخصائية توظيف (دوام جزئي)',
    join: '2025-06-01',
    basic: 3500,
    housing: 0,
    transport: 0,
    partTime: true,
    gosi: 'G000005',
    gosiOn: '2025-06-03',
    iban: 'SA1000000000000000000005',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'F',
    skills: ['documentation', 'recruitment', 'interviewing'],
    sponsor: 'HQ',
    phone: '+966 555 010 005',
    email: 'r.harbi@company.sa',
    av: 'yellow'
  },
  // — Expat workforce (deployed + bench) —
  {
    code: 'EMP-0006',
    nameEn: 'Rajesh Kumar',
    nameAr: 'راجيش كومار',
    nat: 'India',
    iqama: '2000000006',
    iqamaExp: '2027-03-14',
    passport: 'P10000006',
    passportExp: '2027-09-14',
    insExp: '2026-09-05',
    prof: 'driver',
    dept: 'OPS',
    titleEn: 'Driver',
    titleAr: 'سائق',
    join: '2021-06-10',
    entry: '2021-06-08',
    basic: 1800,
    housing: 500,
    transport: 300,
    iban: 'SA1000000000000000000006',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['heavy-driving', 'light-driving'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 006',
    av: 'primary',
    annualUsed: 12
  },
  {
    code: 'EMP-0007',
    nameEn: 'Ahmed Raza',
    nameAr: 'أحمد رضا',
    nat: 'Pakistan',
    iqama: '2000000007',
    iqamaExp: '2027-01-22',
    insExp: '2027-04-16',
    passport: 'P10000007',
    passportExp: '2028-02-20',
    prof: 'driver',
    dept: 'OPS',
    titleEn: 'Driver',
    titleAr: 'سائق',
    join: '2022-02-01',
    entry: '2022-01-30',
    basic: 1800,
    housing: 500,
    transport: 300,
    iban: 'SA1000000000000000000007',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['light-driving', 'route-planning', 'heavy-driving'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 007',
    av: 'blue',
    annualUsed: 5
  },
  {
    code: 'EMP-0008',
    nameEn: 'Mohammad Asif',
    nameAr: 'محمد آصف',
    nat: 'Pakistan',
    iqama: '2000000008',
    iqamaExp: '2026-09-28',
    passport: 'P10000008',
    passportExp: '2026-09-24',
    insExp: '2027-11-30',
    prof: 'driver',
    dept: 'OPS',
    titleEn: 'Driver',
    titleAr: 'سائق',
    join: '2023-04-12',
    entry: '2023-04-10',
    basic: 1700,
    housing: 450,
    transport: 300,
    iban: 'SA1000000000000000000008',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['route-planning', 'heavy-driving', 'light-driving'],
    sponsor: 'BR-JED',
    site: 'ST-004',
    client: 'CL-001',
    phone: '+966 555 010 008',
    av: 'yellow',
    annualUsed: 0
  },
  {
    code: 'EMP-0009',
    nameEn: 'Jose Ramos',
    nameAr: 'خوسيه راموس',
    nat: 'Philippines',
    iqama: '2000000009',
    iqamaExp: '2027-05-30',
    passport: 'P10000009',
    passportExp: '2029-05-16',
    insExp: '2027-08-01',
    prof: 'cleaner',
    dept: 'OPS',
    titleEn: 'Cleaner',
    titleAr: 'عامل نظافة',
    join: '2021-11-03',
    entry: '2021-11-01',
    basic: 1400,
    housing: 400,
    transport: 250,
    iban: 'SA1000000000000000000009',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['deep-cleaning', 'waste-handling'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 009',
    av: 'green',
    annualUsed: 21
  },
  {
    code: 'EMP-0010',
    nameEn: 'Karim Hassan',
    nameAr: 'كريم حسن',
    nat: 'Bangladesh',
    iqama: '2000000010',
    iqamaExp: '2027-02-11',
    passport: 'P10000010',
    passportExp: '2027-12-09',
    insExp: '2026-09-21',
    prof: 'cleaner',
    dept: 'OPS',
    titleEn: 'Cleaner',
    titleAr: 'عامل نظافة',
    join: '2022-08-20',
    entry: '2022-08-18',
    basic: 1400,
    housing: 400,
    transport: 250,
    iban: 'SA1000000000000000000010',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['waste-handling', 'housekeeping', 'deep-cleaning'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 010',
    av: 'purple',
    annualUsed: 8
  },
  {
    code: 'EMP-0011',
    nameEn: 'Abdul Malek',
    nameAr: 'عبد المالك',
    nat: 'Bangladesh',
    iqama: '2000000011',
    iqamaExp: '2026-12-05',
    passport: 'P10000011',
    passportExp: '2028-08-27',
    insExp: '2027-03-22',
    prof: 'cleaner',
    dept: 'OPS',
    titleEn: 'Cleaner',
    titleAr: 'عامل نظافة',
    join: '2023-01-25',
    entry: '2023-01-23',
    basic: 1400,
    housing: 400,
    transport: 250,
    iban: 'SA1000000000000000000011',
    bank: 'Al Rajhi',
    q: 'sent',
    st: 'active',
    gender: 'M',
    skills: ['housekeeping', 'deep-cleaning', 'waste-handling'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 011',
    av: 'red',
    annualUsed: 3
  },
  {
    code: 'EMP-0012',
    nameEn: 'Maria Santos',
    nameAr: 'ماريا سانتوس',
    nat: 'Philippines',
    iqama: '2000000012',
    iqamaExp: '2026-10-15',
    passport: 'P10000012',
    passportExp: '2026-10-05',
    insExp: '2027-06-11',
    prof: 'cleaner',
    dept: 'OPS',
    titleEn: 'Cleaner',
    titleAr: 'عاملة نظافة',
    join: '2022-05-14',
    entry: '2022-05-12',
    basic: 1400,
    housing: 400,
    transport: 250,
    iban: 'SA1000000000000000000012',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'on-leave',
    gender: 'F',
    skills: ['deep-cleaning', 'waste-handling'],
    sponsor: 'HQ',
    phone: '+966 555 010 012',
    av: 'azure',
    annualUsed: 15
  },
  {
    code: 'EMP-0013',
    nameEn: 'Suresh Patel',
    nameAr: 'سوريش باتيل',
    nat: 'India',
    iqama: '2000000013',
    iqamaExp: '2027-04-02',
    passport: 'P10000013',
    passportExp: '2029-10-03',
    insExp: '2028-01-19',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2020-09-01',
    entry: '2020-08-29',
    basic: 1600,
    housing: 450,
    transport: 300,
    iban: 'SA1000000000000000000013',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['concrete-work', 'site-safety', 'scaffolding'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-001',
    phone: '+966 555 010 013',
    av: 'primary',
    annualUsed: 20
  },
  {
    code: 'EMP-0014',
    nameEn: 'Vikram Singh',
    nameAr: 'فيكرام سينغ',
    nat: 'India',
    iqama: '2000000014',
    iqamaExp: '2027-06-19',
    passport: 'P10000014',
    passportExp: '2027-04-21',
    insExp: '2026-10-12',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2021-03-22',
    entry: '2021-03-20',
    basic: 1600,
    housing: 450,
    transport: 300,
    iban: '',
    bank: '',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['site-safety', 'scaffolding', 'concrete-work'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-001',
    phone: '+966 555 010 014',
    av: 'blue',
    annualUsed: 6
  },
  {
    code: 'EMP-0015',
    nameEn: 'Bilal Ahmed',
    nameAr: 'بلال أحمد',
    nat: 'Pakistan',
    iqama: '2000000015',
    iqamaExp: '2027-02-27',
    passport: 'P10000015',
    passportExp: '2028-06-30',
    insExp: '2027-09-08',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2022-07-11',
    entry: '2022-07-09',
    basic: 1600,
    housing: 450,
    transport: 300,
    iban: 'SA1000000000000000000015',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['scaffolding', 'concrete-work'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-002',
    phone: '+966 555 010 015',
    av: 'green',
    annualUsed: 0
  },
  {
    code: 'EMP-0016',
    nameEn: 'Deepak Yadav',
    nameAr: 'ديباك ياداف',
    nat: 'India',
    iqama: '2000000016',
    iqamaExp: '2026-11-20',
    passport: 'P10000016',
    passportExp: '2026-11-30',
    insExp: '2027-12-25',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2023-05-30',
    entry: '2023-05-28',
    basic: 1500,
    housing: 400,
    transport: 300,
    iban: 'SA1000000000000000000016',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['concrete-work', 'site-safety', 'scaffolding'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-002',
    phone: '+966 555 010 016',
    av: 'purple',
    annualUsed: 10
  },
  {
    code: 'EMP-0017',
    nameEn: 'Rahim Uddin',
    nameAr: 'رحيم الدين',
    nat: 'Bangladesh',
    iqama: '2000000017',
    iqamaExp: '2027-08-08',
    passport: 'P10000017',
    passportExp: '2029-01-11',
    insExp: '2028-04-05',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2024-02-18',
    entry: '2024-02-16',
    basic: 1500,
    housing: 400,
    transport: 300,
    iban: 'SA1000000000000000000017',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['site-safety', 'scaffolding', 'concrete-work'],
    sponsor: 'HQ',
    site: 'ST-005',
    client: 'CL-002',
    phone: '+966 555 010 017',
    av: 'yellow',
    annualUsed: 2
  },
  {
    code: 'EMP-0018',
    nameEn: 'Mahmoud Ali',
    nameAr: 'محمود علي',
    nat: 'Egypt',
    iqama: '2000000018',
    iqamaExp: '2027-01-09',
    passport: 'P10000018',
    passportExp: '2026-12-14',
    insExp: '2027-10-17',
    prof: 'mason',
    dept: 'OPS',
    titleEn: 'Mason',
    titleAr: 'بناء',
    join: '2021-12-05',
    entry: '2021-12-03',
    basic: 2200,
    housing: 550,
    transport: 300,
    iban: 'SA1000000000000000000018',
    bank: 'Riyad Bank',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['blockwork', 'tiling'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-001',
    phone: '+966 555 010 018',
    av: 'red',
    annualUsed: 14
  },
  {
    code: 'EMP-0019',
    nameEn: 'Saeed Anwar',
    nameAr: 'سعيد أنور',
    nat: 'Pakistan',
    iqama: '2000000019',
    iqamaExp: '2027-03-25',
    passport: 'P10000019',
    passportExp: '2028-09-23',
    insExp: '2027-07-29',
    prof: 'mason',
    dept: 'OPS',
    titleEn: 'Mason',
    titleAr: 'بناء',
    join: '2022-10-17',
    entry: '2022-10-15',
    basic: 2200,
    housing: 550,
    transport: 300,
    iban: 'SA1000000000000000000019',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['tiling', 'plastering', 'blockwork'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-002',
    phone: '+966 555 010 019',
    av: 'azure',
    annualUsed: 7
  },
  {
    code: 'EMP-0020',
    nameEn: 'Arun Nair',
    nameAr: 'أرون ناير',
    nat: 'India',
    iqama: '2000000020',
    iqamaExp: '2027-07-12',
    passport: 'P10000020',
    passportExp: '2027-08-08',
    insExp: '2026-11-08',
    prof: 'electrician',
    dept: 'OPS',
    titleEn: 'Electrician',
    titleAr: 'كهربائي',
    join: '2022-04-09',
    entry: '2022-04-07',
    basic: 2500,
    housing: 600,
    transport: 350,
    iban: 'SA1000000000000000000020',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['troubleshooting', 'wiring', 'panel-maintenance'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-001',
    phone: '+966 555 010 020',
    av: 'primary',
    annualUsed: 4
  },
  {
    code: 'EMP-0021',
    nameEn: 'Imran Khan',
    nameAr: 'عمران خان',
    nat: 'Pakistan',
    iqama: '2000000021',
    iqamaExp: '2027-09-01',
    passport: 'P10000021',
    passportExp: '2030-02-14',
    insExp: '2028-06-21',
    prof: 'electrician',
    dept: 'OPS',
    titleEn: 'Electrician',
    titleAr: 'كهربائي',
    join: '2026-08-01',
    entry: '2026-07-30',
    basic: 2400,
    housing: 600,
    transport: 350,
    iban: 'SA1000000000000000000021',
    bank: 'Al Rajhi',
    q: 'draft',
    st: 'probation',
    gender: 'M',
    skills: ['wiring', 'panel-maintenance'],
    sponsor: 'BR-JED',
    site: 'ST-004',
    client: 'CL-001',
    phone: '+966 555 010 021',
    av: 'blue',
    annualUsed: 0
  },
  {
    code: 'EMP-0022',
    nameEn: 'Khaled Ibrahim',
    nameAr: 'خالد إبراهيم',
    nat: 'Egypt',
    iqama: '2000000022',
    iqamaExp: '2027-05-17',
    passport: 'P10000022',
    passportExp: '2027-11-05',
    insExp: '2026-12-20',
    prof: 'plumber',
    dept: 'OPS',
    titleEn: 'Plumber',
    titleAr: 'سباك',
    join: '2023-03-14',
    entry: '2023-03-12',
    basic: 2300,
    housing: 550,
    transport: 350,
    iban: 'SA1000000000000000000022',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['drainage', 'fixture-install', 'pipefitting'],
    sponsor: 'HQ',
    client: 'CL-002',
    site: 'ST-003',
    phone: '+966 555 010 022',
    av: 'green',
    annualUsed: 9
  },
  {
    code: 'EMP-0023',
    nameEn: 'Manoj Tiwari',
    nameAr: 'مانوج تيواري',
    nat: 'India',
    iqama: '2000000023',
    iqamaExp: '2027-02-03',
    passport: 'P10000023',
    passportExp: '2029-03-19',
    insExp: '2027-05-14',
    prof: 'foreman',
    dept: 'OPS',
    titleEn: 'Foreman',
    titleAr: 'مشرف عمال',
    join: '2020-01-20',
    entry: '2020-01-18',
    basic: 3200,
    housing: 800,
    transport: 400,
    iban: 'SA1000000000000000000023',
    bank: 'SNB',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['reporting', 'supervision', 'site-safety'],
    sponsor: 'HQ',
    client: 'CL-001',
    site: 'ST-001',
    phone: '+966 555 010 023',
    av: 'purple',
    annualUsed: 18
  },
  {
    code: 'EMP-0024',
    nameEn: 'Danilo Cruz',
    nameAr: 'دانيلو كروز',
    nat: 'Philippines',
    iqama: '2000000024',
    iqamaExp: '2027-06-06',
    passport: 'P10000024',
    passportExp: '2028-12-01',
    insExp: '2027-02-27',
    prof: 'office',
    dept: 'HR',
    titleEn: 'Office assistant',
    titleAr: 'مساعد إداري',
    join: '2023-09-11',
    entry: '2023-09-09',
    basic: 2000,
    housing: 500,
    transport: 300,
    iban: 'SA1000000000000000000024',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'active',
    gender: 'M',
    skills: ['data-entry', 'filing'],
    sponsor: 'HQ',
    site: 'ST-006',
    client: 'CL-001',
    phone: '+966 555 010 024',
    av: 'yellow',
    annualUsed: 5
  },
  {
    code: 'EMP-0025',
    nameEn: 'Amit Sharma',
    nameAr: 'أميت شارما',
    nat: 'India',
    iqama: '2000000025',
    iqamaExp: '2026-10-30',
    prof: 'construction',
    dept: 'OPS',
    titleEn: 'Construction worker',
    titleAr: 'عامل إنشاءات',
    join: '2023-05-01',
    entry: '2023-04-29',
    basic: 1400,
    housing: 350,
    transport: 200,
    iban: 'SA1000000000000000000025',
    bank: 'Al Rajhi',
    q: 'sent',
    st: 'exited',
    gender: 'M',
    skills: ['scaffolding', 'concrete-work'],
    sponsor: 'HQ',
    exitDate: '2026-07-31',
    exitReason: 'End of contract',
    exitReasonAr: 'انتهاء العقد',
    client: '',
    site: '',
    phone: '+966 555 010 025',
    av: 'primary',
    annualUsed: 20
  },
  {
    code: 'EMP-0026',
    nameEn: 'Ana Reyes',
    nameAr: 'آنا رييس',
    nat: 'Philippines',
    iqama: '2000000026',
    iqamaExp: '2027-01-20',
    prof: 'cleaner',
    dept: 'OPS',
    titleEn: 'Cleaner',
    titleAr: 'عامل نظافة',
    join: '2024-02-10',
    entry: '2024-02-08',
    basic: 1200,
    housing: 300,
    transport: 200,
    iban: 'SA1000000000000000000026',
    bank: 'Al Rajhi',
    q: 'authenticated',
    st: 'exited',
    gender: 'F',
    skills: ['deep-cleaning', 'housekeeping'],
    sponsor: 'HQ',
    exitDate: '2026-08-15',
    exitReason: 'Resignation',
    exitReasonAr: 'استقالة',
    client: '',
    site: '',
    phone: '+966 555 010 026',
    av: 'primary',
    annualUsed: 8
  },
  {
    code: 'EMP-0027',
    nameEn: 'Tariq Mehmood',
    nameAr: 'طارق محمود',
    nat: 'Pakistan',
    iqama: '2000000027',
    iqamaExp: '2026-12-01',
    prof: 'driver',
    dept: 'OPS',
    titleEn: 'Driver',
    titleAr: 'سائق',
    join: '2024-11-01',
    entry: '2024-10-30',
    basic: 1800,
    housing: 500,
    transport: 300,
    iban: 'SA1000000000000000000027',
    bank: 'Al Rajhi',
    q: 'draft',
    st: 'huroob',
    gender: 'M',
    skills: ['light-driving', 'route-planning'],
    sponsor: 'HQ',
    reportedAt: '2026-09-08',
    legalNote: 'Absconding report filed via Absher; passport held per Art. 40 file.',
    legalNoteAr: 'تم رفع بلاغ هروب عبر أبشر؛ الجواز محفوظ في الملف حسب المادة ٤٠.',
    client: '',
    site: '',
    phone: '+966 555 010 027',
    av: 'primary',
    annualUsed: 0
  }
];

// Demo date of birth where the HRIS value is not seeded yet. Deterministic
// per employee number (24–54 range) so the Age filter is stable across reloads.
EMPLOYEES.forEach((e, i) => {
  if (e.dob) {return;}
  const n = parseInt(String(e.code).replace(/\D/g, ''), 10) || i + 1;
  const age = 24 + ((n * 7) % 31);
  const month = String(((n * 3) % 12) + 1).padStart(2, '0');
  const day = String(((n * 5) % 28) + 1).padStart(2, '0');
  e.dob = `${2026 - age}-${month}-${day}`;
});

export const CLIENTS = [
  {
    id: 'CL-001',
    nameEn: 'Al-Bina Construction',
    nameAr: 'شركة البناء للمقاولات',
    cr: '1010XXXX11',
    vat: '310175397400003',
    addrEn: 'King Fahd Rd, Al Olaya, Riyadh 12212',
    addrAr: 'طريق الملك فهد، العليا، الرياض ١٢٢١٢',
    contactEn: 'Eng. Sami Haddad',
    phone: '+966 555 020 001',
    email: 'sami@albina.example.sa',
    city: 'Riyadh',
    lat: 24.7136,
    lng: 46.6753,
    nitaqat: 'High Green',
    wpsOk: true,
    billingDay: 5,
    av: 'blue'
  },
  {
    id: 'CL-002',
    nameEn: 'Facility Care Services',
    nameAr: 'شركة العناية للمرافق',
    cr: '1010XXXX22',
    vat: '310229861500003',
    addrEn: 'Exit 5, Al Kharj Rd, Riyadh 14733',
    addrAr: 'مخرج ٥، طريق الخرج، الرياض ١٤٧٣٣',
    contactEn: 'Ms. Dana Kanaan',
    phone: '+966 555 020 002',
    email: 'dana@facilitycare.example.sa',
    city: 'Riyadh',
    lat: 24.7742,
    lng: 46.7385,
    nitaqat: 'Mid Green',
    wpsOk: true,
    billingDay: 10,
    av: 'green'
  }
];

export const SITES = [
  {
    id: 'ST-001',
    client: 'CL-001',
    nameEn: 'North Ring Site',
    nameAr: 'موقع الطريق الشمالي',
    city: 'Riyadh',
    lat: 24.81,
    lng: 46.68
  },
  {
    id: 'ST-002',
    client: 'CL-001',
    nameEn: 'Diriyah Project',
    nameAr: 'مشروع الدرعية',
    city: 'Diriyah',
    lat: 24.732,
    lng: 46.575
  },
  {
    id: 'ST-003',
    client: 'CL-002',
    nameEn: 'KAFD Tower FM',
    nameAr: 'برج كافد — إدارة المرافق',
    city: 'Riyadh',
    lat: 24.767,
    lng: 46.641
  },
  {
    id: 'ST-004',
    client: 'CL-001',
    nameEn: 'Jeddah Corniche Tower',
    nameAr: 'برج كورنيش جدة',
    city: 'Jeddah',
    lat: 21.5433,
    lng: 39.1728
  },
  {
    id: 'ST-005',
    client: 'CL-002',
    nameEn: 'Dammam North FM',
    nameAr: 'الدمام الشمالية — إدارة المرافق',
    city: 'Dammam',
    lat: 26.4207,
    lng: 50.0888
  },
  {
    id: 'ST-006',
    client: 'CL-001',
    nameEn: 'Riyadh South Depot',
    nameAr: 'مستودع جنوب الرياض',
    city: 'Riyadh',
    lat: 24.6,
    lng: 46.75
  }
];

// Secondment registry: rate = monthly SAR charged to the client per head.
// ajeer: null = MISSING (violation demo). Feeds invoicing + ajeerCheck.
export const SECONDMENTS = [
  { emp: 'EMP-0006', client: 'CL-002', site: 'ST-003', rate: 4200, consent: true, ajeer: 'AJ-24-0610', ajeerExp: '2027-01-15', start: '2021-06-15' },
  { emp: 'EMP-0007', client: 'CL-002', site: 'ST-003', rate: 4200, consent: true, ajeer: 'AJ-24-0611', ajeerExp: '2027-03-10', start: '2021-08-01' },
  { emp: 'EMP-0008', client: 'CL-001', site: 'ST-004', rate: 4300, consent: true, ajeer: null, ajeerExp: null, start: '2022-03-01' },
  { emp: 'EMP-0009', client: 'CL-002', site: 'ST-003', rate: 3200, consent: true, ajeer: 'AJ-23-0902', ajeerExp: '2026-10-10', start: '2022-05-10' },
  { emp: 'EMP-0010', client: 'CL-002', site: 'ST-003', rate: 3200, consent: true, ajeer: 'AJ-23-0903', ajeerExp: '2027-06-01', start: '2022-05-10' },
  { emp: 'EMP-0011', client: 'CL-002', site: 'ST-003', rate: 3200, consent: true, ajeer: 'AJ-23-0904', ajeerExp: '2026-08-01', start: '2022-05-10' },
  { emp: 'EMP-0013', client: 'CL-001', site: 'ST-001', rate: 3800, consent: true, ajeer: 'AJ-22-1301', ajeerExp: '2027-04-02', start: '2023-02-01' },
  { emp: 'EMP-0014', client: 'CL-001', site: 'ST-001', rate: 3800, consent: true, ajeer: 'AJ-22-1401', ajeerExp: '2027-06-19', start: '2023-02-01' },
  { emp: 'EMP-0015', client: 'CL-001', site: 'ST-002', rate: 3800, consent: true, ajeer: 'AJ-22-1501', ajeerExp: '2027-02-27', start: '2023-03-15' },
  { emp: 'EMP-0016', client: 'CL-001', site: 'ST-002', rate: 3800, consent: true, ajeer: 'AJ-22-1601', ajeerExp: '2027-11-20', start: '2023-03-15' },
  { emp: 'EMP-0017', client: 'CL-002', site: 'ST-005', rate: 3800, consent: true, ajeer: 'AJ-22-1701', ajeerExp: '2027-08-08', start: '2023-06-01' },
  { emp: 'EMP-0018', client: 'CL-001', site: 'ST-001', rate: 4200, consent: true, ajeer: 'AJ-22-1801', ajeerExp: '2027-01-09', start: '2023-07-01' },
  { emp: 'EMP-0019', client: 'CL-001', site: 'ST-002', rate: 4200, consent: true, ajeer: 'AJ-22-1901', ajeerExp: '2027-03-25', start: '2023-09-01' },
  { emp: 'EMP-0020', client: 'CL-001', site: 'ST-001', rate: 5200, consent: true, ajeer: 'AJ-22-2001', ajeerExp: '2027-07-12', start: '2024-01-15' },
  { emp: 'EMP-0021', client: 'CL-001', site: 'ST-004', rate: 5200, consent: true, ajeer: 'AJ-25-2101', ajeerExp: '2027-09-01', start: '2026-03-01' },
  { emp: 'EMP-0022', client: 'CL-002', site: 'ST-003', rate: 4800, consent: true, ajeer: 'AJ-22-2201', ajeerExp: '2027-05-17', start: '2024-02-01' },
  { emp: 'EMP-0023', client: 'CL-001', site: 'ST-001', rate: 6800, consent: true, ajeer: 'AJ-21-2301', ajeerExp: '2027-02-03', start: '2021-10-01' },
  { emp: 'EMP-0024', client: 'CL-001', site: 'ST-006', rate: 4500, consent: true, ajeer: 'AJ-23-2401', ajeerExp: '2027-06-06', start: '2023-01-10' }
];

// Seeded invoices: paid history (May–Jul), Jul sent (31–60d late), Aug sent
// (overdue), Sep drafts. Totals precomputed with invoiceLine/invoiceTotals.
export const INVOICES = [
  {
    id: 'INV-2026-05-CL-001', no: 1, month: '2026-05', client: 'CL-001', status: 'paid', notes: '',
    sub: 44400, vat: 6660, total: 51060, due: '2026-06-05', updated: '2026-05-05',
    lines: [
      { emp: 'EMP-0008', rate: 4300, days: 30, otH: 0 },
      { emp: 'EMP-0013', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0014', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0015', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0016', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0018', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0019', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0020', rate: 5200, days: 30, otH: 0 },
      { emp: 'EMP-0023', rate: 6800, days: 30, otH: 0 },
      { emp: 'EMP-0024', rate: 4500, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-05-CL-002', no: 2, month: '2026-05', client: 'CL-002', status: 'paid', notes: '',
    sub: 26600, vat: 3990, total: 30590, due: '2026-06-10', updated: '2026-05-10',
    lines: [
      { emp: 'EMP-0006', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0007', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0009', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0010', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0011', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0017', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0022', rate: 4800, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-06-CL-001', no: 3, month: '2026-06', client: 'CL-001', status: 'paid', notes: '',
    sub: 44400, vat: 6660, total: 51060, due: '2026-07-05', updated: '2026-06-05',
    lines: [
      { emp: 'EMP-0008', rate: 4300, days: 30, otH: 0 },
      { emp: 'EMP-0013', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0014', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0015', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0016', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0018', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0019', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0020', rate: 5200, days: 30, otH: 0 },
      { emp: 'EMP-0023', rate: 6800, days: 30, otH: 0 },
      { emp: 'EMP-0024', rate: 4500, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-06-CL-002', no: 4, month: '2026-06', client: 'CL-002', status: 'paid', notes: '',
    sub: 26600, vat: 3990, total: 30590, due: '2026-07-10', updated: '2026-06-10',
    lines: [
      { emp: 'EMP-0006', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0007', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0009', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0010', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0011', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0017', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0022', rate: 4800, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-07-CL-001', no: 5, month: '2026-07', client: 'CL-001', status: 'paid', notes: '',
    sub: 44400, vat: 6660, total: 51060, due: '2026-08-05', updated: '2026-07-05',
    lines: [
      { emp: 'EMP-0008', rate: 4300, days: 30, otH: 0 },
      { emp: 'EMP-0013', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0014', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0015', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0016', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0018', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0019', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0020', rate: 5200, days: 30, otH: 0 },
      { emp: 'EMP-0023', rate: 6800, days: 30, otH: 0 },
      { emp: 'EMP-0024', rate: 4500, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-07-CL-002', no: 6, month: '2026-07', client: 'CL-002', status: 'sent', notes: '',
    sub: 26600, vat: 3990, total: 30590, due: '2026-08-10', updated: '2026-07-10',
    lines: [
      { emp: 'EMP-0006', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0007', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0009', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0010', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0011', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0017', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0022', rate: 4800, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-08-CL-002', no: 7, month: '2026-08', client: 'CL-002', status: 'sent', notes: '',
    sub: 26600, vat: 3990, total: 30590, due: '2026-09-10', updated: '2026-08-05',
    lines: [
      { emp: 'EMP-0006', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0007', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0009', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0010', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0011', rate: 3200, days: 30, otH: 0 },
      { emp: 'EMP-0017', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0022', rate: 4800, days: 30, otH: 0 }
    ]
  },
  {
    id: 'INV-2026-09-CL-001', no: 8, month: '2026-09', client: 'CL-001', status: 'draft', notes: 'PO 4417',
    sub: 49600, vat: 7440, total: 57040, due: '2026-10-05', updated: '2026-09-19',
    lines: [
      { emp: 'EMP-0008', rate: 4300, days: 30, otH: 0 },
      { emp: 'EMP-0013', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0014', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0015', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0016', rate: 3800, days: 30, otH: 0 },
      { emp: 'EMP-0018', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0019', rate: 4200, days: 30, otH: 0 },
      { emp: 'EMP-0020', rate: 5200, days: 30, otH: 0 },
      { emp: 'EMP-0021', rate: 5200, days: 30, otH: 0 },
      { emp: 'EMP-0023', rate: 6800, days: 30, otH: 0 },
      { emp: 'EMP-0024', rate: 4500, days: 30, otH: 0 }
    ]
  }
];

// ── Document generator: built-in bilingual templates ─────────────────────
// Placeholders {{path}} resolve against a context (doc/emp/client/co); users
// can duplicate, edit or author templates — custom ones ride the overlay.
export const DOC_TEMPLATES = [
  {
    id: 'tpl-offer', cat: 'hr', builtIn: true,
    nameEn: 'Job offer letter', nameAr: 'خطاب عرض عمل',
    bodyEn: `Date: {{doc.todayLong}}

Dear {{doc.text1}},

Subject: Employment offer

We are pleased to offer you the position of {{doc.text2}} at {{co.nameEn}}, starting {{doc.date1Long}}, subject to completing the pre-employment requirements and the applicable government approvals.

Your monthly gross salary will be {{doc.amountMoney}}, in addition to the benefits prescribed by the labor law and company policy.

This offer remains open until {{doc.date2Long}}. To accept, please sign and return a copy of this letter.

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

المكرم/{{doc.text1}}،

الموضوع: عرض عمل

يتشرف {{co.nameAr}} بأن يعرض عليك وظيفة {{doc.text2}} اعتبارًا من {{doc.date1LongAr}}، وذلك بعد استكمال متطلبات التعيين والموافقات الحكومية النظامية.

سيكون راتبك الشهري الإجمالي {{doc.amountMoneyAr}}، إضافة إلى المزايا المقررة بنظام العمل وسياسة الشركة.

يظل هذا العرض ساريًا حتى {{doc.date2LongAr}}، ولقبوله يرجى التوقيع وإعادة نسخة من هذا الخطاب.

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-contract', cat: 'contract', builtIn: true,
    nameEn: 'Employment contract', nameAr: 'عقد عمل',
    bodyEn: `Employment contract No. {{doc.no}} concluded on {{doc.todayLong}} between:

First party: {{co.nameEn}} — CR {{co.cr}} (the Employer).
Second party: {{emp.nameEn}} — {{emp.nat}}, Iqama {{emp.iqama}} (the Employee).

1. The Employer employs the Employee as {{emp.titleEn}} in the {{emp.deptEn}} department, and the Employee accepts, effective {{doc.date1Long}}{{doc.termLine}}.
2. The monthly wage is {{emp.wageMoney}} (basic {{emp.basicMoney}}, housing {{emp.housingMoney}}, transport {{emp.transportMoney}}), payable monthly through WPS.
3. Working hours: 8 hours per day, 48 per week, as organized by company policy; the Employee is registered with GOSI from the start date.
4. The Employee is entitled to annual leave, sick leave and the public holidays prescribed by the Saudi Labor Law.
5. Both parties observe the Saudi Labor Law and its implementing regulations for matters not stated herein.

First party — Authorized signatory          Second party — Employee
{{co.nameEn}}                                {{emp.nameEn}}`,
    bodyAr: `عقد عمل رقم {{doc.no}} تم إبرامه بتاريخ {{doc.todayLongAr}} بين كل من:

الطرف الأول: {{co.nameAr}} — س.ت {{co.cr}} (صاحب العمل).
الطرف الثاني: {{emp.nameAr}} — {{emp.nat}}، إقامة رقم {{emp.iqama}} (العامل).

1. يُوظّف الطرف الأول الطرف الثاني في وظيفة {{emp.titleAr}} بقسم {{emp.deptAr}} اعتبارًا من {{doc.date1LongAr}}{{doc.termLineAr}}.
2. الأجر الشهري {{emp.wageMoneyAr}} (أساسي {{emp.basicMoneyAr}}، بدل سكن {{emp.housingMoneyAr}}، بدل نقل {{emp.transportMoneyAr}})، يُدفع شهريًا عبر حماية الأجور.
3. ساعات العمل ٨ ساعات يوميًا و٤٨ أسبوعيًا وفق ما تنظمه سياسة الشركة، ويُسجَّل العامل في التأمينات الاجتماعية من تاريخ المباشرة.
4. للعامل حقوق الإجازات السنوية والمرضية والعطلات الرسمية المقررة بنظام العمل السعودي.
5. يسري نظام العمل السعودي ولوائحه التنفيذية على ما لم يرد به نص في هذا العقد.

الطرف الأول — المخوّل بالتوقيع               الطرف الثاني — العامل
{{co.nameAr}}                                 {{emp.nameAr}}`
  },
  {
    id: 'tpl-salary-cert', cat: 'hr', builtIn: true,
    nameEn: 'Salary certificate', nameAr: 'شهادة راتب',
    bodyEn: `Date: {{doc.todayLong}}

To whom it may concern

Subject: Salary certificate — {{emp.nameEn}}

This is to certify that {{emp.nameEn}} ({{emp.nat}}), Iqama No. {{emp.iqama}}, is employed by {{co.nameEn}} as {{emp.titleEn}} in the {{emp.deptEn}} department since {{emp.joinLong}}.

The employee's current monthly wage is {{emp.wageMoney}}, itemized as: basic salary {{emp.basicMoney}}, housing allowance {{emp.housingMoney}}, and transport allowance {{emp.transportMoney}}.

This certificate is issued at the employee's request for {{doc.subject}}, without bearing any liability on the company.

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

إلى من يهمه الأمر

الموضوع: شهادة راتب — {{emp.nameAr}}

تشهد {{co.nameAr}} بأن {{emp.nameAr}} ({{emp.nat}})، إقامة رقم {{emp.iqama}}، يعمل لديها في وظيفة {{emp.titleAr}} بقسم {{emp.deptAr}} منذ {{emp.joinLongAr}}.

يبلغ الأجر الشهري الحالي {{emp.wageMoneyAr}} بتفصيله: الراتب الأساسي {{emp.basicMoneyAr}}، وبدل السكن {{emp.housingMoneyAr}}، وبدل النقل {{emp.transportMoneyAr}}.

صدرت هذه الشهادة بطلب الموظف لغرض {{doc.subject}} دون أن يترتب على الشركة أي التزام تجاه الجهة الأخرى.

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-exp-cert', cat: 'hr', builtIn: true,
    nameEn: 'Experience certificate', nameAr: 'شهادة خبرة',
    bodyEn: `Date: {{doc.todayLong}}

To whom it may concern

Subject: Experience certificate — {{emp.nameEn}}

This is to certify that {{emp.nameEn}} ({{emp.nat}}), Iqama No. {{emp.iqama}}, worked at {{co.nameEn}} as {{emp.titleEn}} from {{emp.joinLong}} until {{doc.date2Long}}.

During this period the employee demonstrated good conduct and competence, and gained practical experience in the duties of the position.

This certificate is issued at the employee's request upon end of service, without bearing any liability on the company.

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

إلى من يهمه الأمر

الموضوع: شهادة خبرة — {{emp.nameAr}}

تشهد {{co.nameAr}} بأن {{emp.nameAr}} ({{emp.nat}})، إقامة رقم {{emp.iqama}}، عمل لديها في وظيفة {{emp.titleAr}} خلال الفترة من {{emp.joinLongAr}} وحتى {{doc.date2LongAr}}.

خلال هذه المدة أبدى العامل حسن السلوك والكفاءة، واكتسب خبرة عملية في مهام الوظيفة.

صدرت هذه الشهادة بطلب العامل عند انتهاء خدمته دون أن يترتب على الشركة أي التزام تجاه الجهة الأخرى.

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-noc', cat: 'hr', builtIn: true,
    nameEn: 'No-objection certificate', nameAr: 'خطاب عدم ممانعة',
    bodyEn: `Date: {{doc.todayLong}}

To whom it may concern

Subject: No objection — {{emp.nameEn}}

We, {{co.nameEn}}, confirm that {{emp.nameEn}} ({{emp.nat}}), Iqama No. {{emp.iqama}}, works with us as {{emp.titleEn}}.

We have no objection to {{doc.subject}}.

This letter is issued at the employee's request, without bearing any financial or legal liability on the company.

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

إلى من يهمه الأمر

الموضوع: عدم ممانعة — {{emp.nameAr}}

نحن {{co.nameAr}} نشهد بأن {{emp.nameAr}} ({{emp.nat}})، إقامة رقم {{emp.iqama}}، يعمل لدينا في وظيفة {{emp.titleAr}}.

ولا مانع لدينا من {{doc.subject}}.

صدر هذا الخطاب بطلب الموظف، دون أن يترتب على الشركة أي التزام مالي أو قانوني تجاه الجهة الأخرى.

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-warning', cat: 'notice', builtIn: true,
    nameEn: 'Warning notice', nameAr: 'إنذار',
    bodyEn: `Date: {{doc.todayLong}}

Employee: {{emp.nameEn}} — {{emp.code}} — {{emp.titleEn}}

Subject: Warning

Reference to the incident of {{doc.date1Long}}, the following violation was established: {{doc.subject}}.

Accordingly, the employee is hereby formally warned, with attention drawn to Article 80 of the Saudi Labor Law. Any repetition will lead to further action per company policy and the law.

{{doc.note}}

Employee acknowledgment (signature — no objection to content):
{{emp.nameEn}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

الموظف: {{emp.nameAr}} — {{emp.code}} — {{emp.titleAr}}

الموضوع: إنذار

بالإشارة إلى واقعة بتاريخ {{doc.date1LongAr}}، ثبت وقوع المخالفة التالية: {{doc.subject}}.

وعليه يُحرَم هذا الإنذار للموظف المذكور، مع التنبيه على أحكام المادة الثمانين من نظام العمل السعودي، وأن تكرار المخالفة سيؤدي إلى ما يقتضيه النظام وسياسة الشركة من إجراءات.

{{doc.note}}

إقرار الموظف (التوقيع — دون اعتراض على المحتوى):
{{emp.nameAr}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-termination', cat: 'notice', builtIn: true,
    nameEn: 'Contract termination notice', nameAr: 'إشعار إنهاء عقد',
    bodyEn: `Date: {{doc.todayLong}}

Employee: {{emp.nameEn}} — {{emp.code}} — {{emp.titleEn}}

Subject: Notice of contract termination

Further to {{doc.subject}}, we hereby notify you that the employment contract will end on {{doc.date2Long}}, with {{doc.date1Long}} as the date of this notice, in accordance with the Saudi Labor Law.

Final dues will be settled per the law, including the end-of-service award, pending leave balance and any entitlements, after completing the exit procedures and handover.

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

الموظف: {{emp.nameAr}} — {{emp.code}} — {{emp.titleAr}}

الموضوع: إشعار بإنهاء عقد العمل

بالإشارة إلى {{doc.subject}}، نُعلمكم بأنه سيتم إنهاء عقد العمل اعتبارًا من {{doc.date2LongAr}}، وكان بتاريخ {{doc.date1LongAr}} تاريخ إصدار هذا الإشعار، وفقًا لنظام العمل السعودي.

وستُصفّي المستحقات النظامية كاملة، بما فيها مكافأة نهاية الخدمة ورصيد الإجازات المؤجلة وغيرها، بعد استكمال إجراءات الإقفال وتسليم العمل.

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-secondment', cat: 'agreement', builtIn: true,
    nameEn: 'Secondment agreement', nameAr: 'اتفاقية إسناد عمالة',
    bodyEn: `Secondment agreement No. {{doc.no}} made on {{doc.todayLong}} between:

First party: {{co.nameEn}} — CR {{co.cr}} (the Provider).
Second party: {{client.nameEn}} — CR {{client.cr}} (the Beneficiary).

1. The Provider seconds {{emp.nameEn}} — {{emp.titleEn}} — to the Beneficiary at {{client.addrEn}}, effective {{doc.date1Long}}, for a monthly fee of {{doc.amountMoney}} per head.
2. The worker remains an employee of the Provider; the Beneficiary shall direct the work within the agreed scope and return the worker upon request within one working day.
3. The Beneficiary provides accommodation, transport and occupational safety at the workplace, and the secondment is activated via Ajeer in accordance with the applicable regulations.
4. Invoicing is monthly with 15% VAT; payment within 30 days of the invoice date.

First party                                 Second party
{{co.nameEn}}                                {{client.nameEn}}`,
    bodyAr: `اتفاقية إسناد عمالة رقم {{doc.no}} تم إبرامها بتاريخ {{doc.todayLongAr}} بين كل من:

الطرف الأول: {{co.nameAr}} — س.ت {{co.cr}} (المُؤمِّن).
الطرف الثاني: {{client.nameAr}} — س.ت {{client.cr}} (المستفيد).

1. يُؤمّن الطرف الأول عاملًا لدى الطرف الثاني وهو {{emp.nameAr}} — {{emp.titleAr}} — في مقر {{client.addrAr}} اعتبارًا من {{doc.date1LongAr}}، مقابل قيمة شهرية قدرها {{doc.amountMoneyAr}} للعامل الواحد.
2. يظل العامل تابعًا للطرف الأول، ويحق للطرف الثاني الإشراف على العمل ضمن النطاق المتفق عليه، وإعادة العامل عند الطلب خلال يوم عمل واحد.
3. يتولى الطرف الثاني توفير السكن والنقل والسلامة المهنية بمكان العمل، ويتم تنشيط الإسناد عبر منصة أجير وفق الضوابط النظامية.
4. تُصدر الفواتير شهريًا مع ضريبة القيمة المضافة ١٥٪، وتُسدد خلال ٣٠ يومًا من تاريخ الفاتورة.

الطرف الأول                                  الطرف الثاني
{{co.nameAr}}                                 {{client.nameAr}}`
  },
  {
    id: 'tpl-nda', cat: 'agreement', builtIn: true,
    nameEn: 'Confidentiality agreement (NDA)', nameAr: 'اتفاقية سرية',
    bodyEn: `Confidentiality agreement No. {{doc.no}} made on {{doc.todayLong}} between {{co.nameEn}} (the Discloser) and {{emp.nameEn}} — {{emp.code}} (the Recipient).

1. The Recipient shall keep all business, technical, client and workforce information obtained during employment strictly confidential during and after employment.
2. Confidential information may be used solely for performing the job duties and may not be disclosed to any third party without prior written consent.
3. All documents, data and records remain the property of the Discloser and must be returned upon request or upon end of service.
4. This agreement applies from {{doc.date1Long}}{{doc.termLine}} and in accordance with the Saudi Labor Law; violations entitle the Discloser to legal remedies.

Discloser — Authorized signatory             Recipient
{{co.nameEn}}                                {{emp.nameEn}}`,
    bodyAr: `اتفاقية سرية رقم {{doc.no}} تم إبرامها بتاريخ {{doc.todayLongAr}} بين {{co.nameAr}} (المُفصح) و{{emp.nameAr}} — {{emp.code}} (المتلقي).

1. يلتزم المتلقي بالحفاظ التام على جميع المعلومات التجارية والفنية والعملاء والعمالة التي اطلع عليها أثناء العمل، أثناء الخدمة وبعدها.
2. لا تُستخدم المعلومات السرية إلا لأداء مهام العمل، ولا يجوز إفشاءها لأي طرف ثالث دون موافقة خطية مسبقة.
3. تظل جميع المستندات والبيانات والسجلات ملكًا للمُفصح ويجب إعادتها عند الطلب أو عند انتهاء الخدمة.
4. تسري هذه الاتفاقية اعتبارًا من {{doc.date1LongAr}}{{doc.termLineAr}} وفقًا لنظام العمل السعودي، ويحق للمُفصح في حال الإخلال اتخاذ كل ما يقتضيه النظام.

المُفصح — المخوّل بالتوقيع                    المتلقي
{{co.nameAr}}                                 {{emp.nameAr}}`
  },
  {
    id: 'tpl-memo', cat: 'notice', builtIn: true,
    nameEn: 'Internal memorandum', nameAr: 'مذكرة داخلية',
    bodyEn: `Date: {{doc.todayLong}}
To: All employees
From: {{co.nameEn}} — Human Resources

Subject: {{doc.subject}}

{{doc.note}}

{{doc.text1}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}
إلى: جميع الموظفين
من: {{co.nameAr}} — الموارد البشرية

الموضوع: {{doc.subject}}

{{doc.note}}

{{doc.text1}}

المخوّل بالتوقيع
{{co.nameAr}}`
  },
  {
    id: 'tpl-blank', cat: 'custom', builtIn: true,
    nameEn: 'Blank document', nameAr: 'مستند فارغ',
    bodyEn: `Date: {{doc.todayLong}}

{{doc.text1}}

{{doc.note}}

Authorized signatory
{{co.nameEn}}`,
    bodyAr: `التاريخ: {{doc.todayLongAr}}

{{doc.text1}}

{{doc.note}}

المخوّل بالتوقيع
{{co.nameAr}}`
  }
];

// ── Document generator: issued archive (rendered snapshots, reprint-only) ──
export const DOCUMENTS = [
  {
    id: 'DOC-0001', no: 1, tplId: 'tpl-salary-cert', out: 'both', emp: 'EMP-0002', client: '',
    titleEn: 'Salary certificate — bank procedures', titleAr: 'شهادة راتب — إجراءات بنكية',
    createdAt: '2026-06-14',
    renderedEn: `Date: 14 June 2026

To whom it may concern

Subject: Salary certificate — Khalid Al-Dossari

This is to certify that Khalid Al-Dossari (Saudi), Iqama No. —, is employed by goHR as Operations Coordinator in the Operations department since 15 January 2023.

The employee's current monthly wage is SAR 10,175.00, itemized as: basic salary SAR 7,500.00, housing allowance SAR 1,875.00, and transport allowance SAR 800.00.

This certificate is issued at the employee's request for bank procedures, without bearing any liability on the company.

Authorized signatory
goHR`,
    renderedAr: `التاريخ: ١٤ يونيو ٢٠٢٦

إلى من يهمه الأمر

الموضوع: شهادة راتب — خالد الدوسري

تشهد goHR بأن خالد الدوسري (سعودي)، إقامة رقم —، يعمل لديها في وظيفة منسق التشغيل بقسم التشغيل منذ ١٥ يناير ٢٠٢٣.

يبلغ الأجر الشهري الحالي ١٠٬١٧٥٫٠٠ ر.س بتفصيله: الراتب الأساسي ٧٬٥٠٠٫٠٠ ر.س، وبدل السكن ١٬٨٧٥٫٠٠ ر.س، وبدل النقل ٨٠٠٫٠٠ ر.س.

صدرت هذه الشهادة بطلب الموظف لغرض إجراءات بنكية دون أن يترتب على الشركة أي التزام تجاه الجهة الأخرى.

المخوّل بالتوقيع
goHR`
  },
  {
    id: 'DOC-0002', no: 2, tplId: 'tpl-warning', out: 'both', emp: 'EMP-0011', client: '',
    titleEn: 'Warning notice — absence', titleAr: 'إنذار — التغيب عن العمل',
    createdAt: '2026-07-20',
    renderedEn: `Date: 20 July 2026

Employee: Abdul Malek — EMP-0011 — Cleaner

Subject: Warning

Reference to the incident of 12 July 2026, the following violation was established: absence from the duty site without prior permission.

Accordingly, the employee is hereby formally warned, with attention drawn to Article 80 of the Saudi Labor Law. Any repetition will lead to further action per company policy and the law.

Employee acknowledgment (signature — no objection to content):
Abdul Malek

Authorized signatory
goHR`,
    renderedAr: `التاريخ: ٢٠ يوليو ٢٠٢٦

الموظف: عبد المالك — EMP-0011 — عامل نظافة

الموضوع: إنذار

بالإشارة إلى واقعة بتاريخ ١٢ يوليو ٢٠٢٦، ثبت وقوع المخالفة التالية: التغيب عن موقع العمل دون إذن مسبق.

وعليه يُحرَم هذا الإنذار للموظف المذكور، مع التنبيه على أحكام المادة الثمانين من نظام العمل السعودي، وأن تكرار المخالفة سيؤدي إلى ما يقتضيه النظام وسياسة الشركة من إجراءات.

إقرار الموظف (التوقيع — دون اعتراض على المحتوى):
عبد المالك

المخوّل بالتوقيع
goHR`
  },
  {
    id: 'DOC-0003', no: 3, tplId: 'tpl-contract', out: 'both', emp: 'EMP-0021', client: '',
    titleEn: 'Employment contract — Imran Khan', titleAr: 'عقد عمل — عمران خان',
    createdAt: '2026-08-01',
    renderedEn: `Employment contract No. #3 concluded on 1 August 2026 between:

First party: goHR — CR 1010XXXXXX (the Employer).
Second party: Imran Khan — Pakistan, Iqama 2000000021 (the Employee).

1. The Employer employs the Employee as Electrician in the Operations department, and the Employee accepts, effective 1 August 2026, on a fixed term ending 31 July 2027.
2. The monthly wage is SAR 3,350.00 (basic SAR 2,400.00, housing SAR 600.00, transport SAR 350.00), payable monthly through WPS.
3. Working hours: 8 hours per day, 48 per week, as organized by company policy; the Employee is registered with GOSI from the start date.
4. The Employee is entitled to annual leave, sick leave and the public holidays prescribed by the Saudi Labor Law.
5. Both parties observe the Saudi Labor Law and its implementing regulations for matters not stated herein.

First party — Authorized signatory          Second party — Employee
goHR                                Imran Khan`,
    renderedAr: `عقد عمل رقم #3 تم إبرامه بتاريخ ١ أغسطس ٢٠٢٦ بين كل من:

الطرف الأول: goHR — س.ت 1010XXXXXX (صاحب العمل).
الطرف الثاني: عمران خان — باكستاني، إقامة رقم 2000000021 (العامل).

1. يُوظّف الطرف الأول الطرف الثاني في وظيفة كهربائي بقسم التشغيل اعتبارًا من ١ أغسطس ٢٠٢٦، ولمدة محددة تنتهي في ٣١ يوليو ٢٠٢٧.
2. الأجر الشهري ٣٬٣٥٠٫٠٠ ر.س (أساسي ٢٬٤٠٠٫٠٠ ر.س، بدل سكن ٦٠٠٫٠٠ ر.س، بدل نقل ٣٥٠٫٠٠ ر.س)، يُدفع شهريًا عبر حماية الأجور.
3. ساعات العمل ٨ ساعات يوميًا و٤٨ أسبوعيًا وفق ما تنظمه سياسة الشركة، ويُسجَّل العامل في التأمينات الاجتماعية من تاريخ المباشرة.
4. للعامل حقوق الإجازات السنوية والمرضية والعطلات الرسمية المقررة بنظام العمل السعودي.
5. يسري نظام العمل السعودي ولوائحه التنفيذية على ما لم يرد به نص في هذا العقد.

الطرف الأول — المخوّل بالتوقيع               الطرف الثاني — العامل
goHR                                 عمران خان`
  },
  {
    id: 'DOC-0004', no: 4, tplId: 'tpl-noc', out: 'both', emp: 'EMP-0009', client: '',
    titleEn: 'No-objection — family visit visa', titleAr: 'عدم ممانعة — تأشيرة زيارة عائلية',
    createdAt: '2026-08-05',
    renderedEn: `Date: 5 August 2026

To whom it may concern

Subject: No objection — Jose Ramos

We, goHR, confirm that Jose Ramos (Philippines), Iqama No. 2000000009, works with us as Cleaner.

We have no objection to issuing a family visit visa for his wife.

This letter is issued at the employee's request, without bearing any financial or legal liability on the company.

Authorized signatory
goHR`,
    renderedAr: `التاريخ: ٥ أغسطس ٢٠٢٦

إلى من يهمه الأمر

الموضوع: عدم ممانعة — خوسيه راموس

نحن goHR نشهد بأن خوسيه راموس (فلبيني)، إقامة رقم 2000000009، يعمل لدينا في وظيفة عامل نظافة.

ولا مانع لدينا من إصدار تأشيرة زيارة عائلية لزوجته.

صدر هذا الخطاب بطلب الموظف، دون أن يترتب على الشركة أي التزام مالي أو قانوني تجاه الجهة الأخرى.

المخوّل بالتوقيع
goHR`
  },
  {
    id: 'DOC-0005', no: 5, tplId: 'tpl-exp-cert', out: 'both', emp: 'EMP-0025', client: '',
    titleEn: 'Experience certificate — end of service', titleAr: 'شهادة خبرة — نهاية الخدمة',
    createdAt: '2026-08-30',
    renderedEn: `Date: 30 August 2026

To whom it may concern

Subject: Experience certificate — Amit Sharma

This is to certify that Amit Sharma (India), Iqama No. 2000000025, worked at goHR as Construction worker from 1 May 2023 until 30 August 2026.

During this period the employee demonstrated good conduct and competence, and gained practical experience in the duties of the position.

This certificate is issued at the employee's request upon end of service, without bearing any liability on the company.

Authorized signatory
goHR`,
    renderedAr: `التاريخ: ٣٠ أغسطس ٢٠٢٦

إلى من يهمه الأمر

الموضوع: شهادة خبرة — أميت شارما

تشهد goHR بأن أميت شارما (هندي)، إقامة رقم 2000000025، عمل لديها في وظيفة عامل إنشاءات خلال الفترة من ١ مايو ٢٠٢٣ وحتى ٣٠ أغسطس ٢٠٢٦.

خلال هذه المدة أبدى العامل حسن السلوك والكفاءة، واكتسب خبرة عملية في مهام الوظيفة.

صدرت هذه الشهادة بطلب العامل عند انتهاء خدمته دون أن يترتب على الشركة أي التزام تجاه الجهة الأخرى.

المخوّل بالتوقيع
goHR`
  }
];

// ── File manager: vault entries (metadata; letter rows carry text
// snapshots, uploaded rows carry dataUrl through the overlay) ──────────────
export const FILE_ENTRIES = [
  { id: 'F-0001', kind: 'letter', name: 'Salary certificate — Khalid (bank)', nameAr: 'شهادة راتب — خالد (بنك)', emp: 'EMP-0002', cat: 'letters', letterRef: 'DOC-0001', createdAt: '2026-06-14' },
  { id: 'F-0002', kind: 'letter', name: 'Warning notice — Abdul Malek', nameAr: 'إنذار — عبد المالك', emp: 'EMP-0011', cat: 'letters', letterRef: 'DOC-0002', createdAt: '2026-07-20' },
  { id: 'F-0003', kind: 'letter', name: 'Employment contract — Imran Khan', nameAr: 'عقد عمل — عمران خان', emp: 'EMP-0021', cat: 'contracts', letterRef: 'DOC-0003', createdAt: '2026-08-01' },
  { id: 'F-0004', kind: 'record', name: 'Iqama copy — Jose Ramos', nameAr: 'نسخة الإقامة — خوسيه راموس', emp: 'EMP-0009', cat: 'government', mime: 'application/pdf', size: 245760, expiry: '2027-05-30', createdAt: '2026-05-30' },
  { id: 'F-0005', kind: 'record', name: 'Passport copy — Rajesh Kumar', nameAr: 'نسخة جواز السفر — راجيش كومار', emp: 'EMP-0006', cat: 'government', mime: 'application/pdf', size: 189440, expiry: '2027-09-14', createdAt: '2026-05-30' },
  { id: 'F-0006', kind: 'record', name: 'Secondment agreement — CL-001 2026', nameAr: 'اتفاقية إسناد — CL-001 ٢٠٢٦', client: 'CL-001', cat: 'contracts', mime: 'application/pdf', size: 512000, createdAt: '2026-01-05' },
  { id: 'F-0007', kind: 'record', name: 'Medical insurance policy — batch 3', nameAr: 'وثيقة التأمين الطبي — الدفعة ٣', cat: 'insurance', mime: 'application/pdf', size: 860160, expiry: '2026-09-21', createdAt: '2025-09-21' },
  { id: 'F-0008', kind: 'record', name: 'Offer letter (signed) — Imran Khan', nameAr: 'خطاب عرض موقع — عمران خان', emp: 'EMP-0021', cat: 'contracts', mime: 'application/pdf', size: 158720, createdAt: '2026-07-12' },
  { id: 'F-0009', kind: 'record', name: 'Chamber of Commerce membership', nameAr: 'عضوية الغرفة التجارية', cat: 'government', mime: 'application/pdf', size: 327680, expiry: '2026-12-31', createdAt: '2026-01-02' },
  { id: 'F-0010', kind: 'record', name: 'Site safety certificate — North Ring', nameAr: 'شهادة السلامة الموقعية — الطريق الشمالي', client: 'CL-001', cat: 'certificates', mime: 'image/jpeg', size: 96256, expiry: '2027-02-15', createdAt: '2026-02-15' }
];

// ── Recruitment: vacancies + candidate pipeline ──────────────────────────
// Stages: applied -> screened -> interview -> offer -> hired (or rejected).
// A hired candidate carries hiredCode pointing at the created employee row.
export const VACANCIES = [
  { id: 'VAC-01', titleEn: 'Construction workers', titleAr: 'عمال إنشاءات', dept: 'PRO', client: 'CL-001', count: 4, status: 'open', opened: '2026-07-01' },
  { id: 'VAC-02', titleEn: 'Electrician', titleAr: 'كهربائي', dept: 'OPS', client: 'CL-001', count: 1, status: 'open', opened: '2026-06-15' },
  { id: 'VAC-03', titleEn: 'Cleaners', titleAr: 'عمال نظافة', dept: 'OPS', client: 'CL-002', count: 2, status: 'open', opened: '2026-08-10' },
  { id: 'VAC-04', titleEn: 'Accountant', titleAr: 'محاسب', dept: 'FIN', client: '', count: 1, status: 'open', opened: '2026-08-25' }
];

export const CANDIDATES = [
  { id: 'C-01', nameEn: 'Ram Niwas', nameAr: 'رام نيواس', nat: 'India', prof: 'construction', vacancy: 'VAC-01', stage: 'applied', phone: '+91 55001 101', expYears: 6, expected: 3600, skills: ['scaffolding', 'concrete-work', 'blockwork'], applied: '2026-08-18', av: 'primary' },
  { id: 'C-08', nameEn: 'Raju Sheikh', nameAr: 'راجو شيخ', nat: 'Bangladesh', prof: 'construction', vacancy: 'VAC-01', stage: 'applied', phone: '+880 1711 220 118', expYears: 3, expected: 3300, skills: ['concrete-work', 'tiling'], applied: '2026-09-02', av: 'azure' },
  { id: 'C-05', nameEn: 'Sofia Reyes', nameAr: 'صوفيا ريس', nat: 'Philippines', prof: 'specialist', vacancy: 'VAC-04', stage: 'applied', phone: '+63 917 555 0134', expYears: 5, expected: 6000, skills: ['accounting', 'data-entry', 'filing'], applied: '2026-09-05', av: 'purple' },
  { id: 'C-02', nameEn: 'Hassan Ali', nameAr: 'حسن علي', nat: 'Egypt', prof: 'mason', vacancy: 'VAC-01', stage: 'screened', phone: '+20 100 555 0192', expYears: 8, expected: 4100, skills: ['blockwork', 'plastering', 'site-safety'], applied: '2026-07-28', av: 'yellow' },
  { id: 'C-09', nameEn: 'Ahmad Salah', nameAr: 'أحمد صلاح', nat: 'Egypt', prof: 'plumber', vacancy: 'VAC-01', stage: 'screened', phone: '+20 111 555 0233', expYears: 5, expected: 4000, skills: ['pipefitting', 'fixture-install', 'drainage'], applied: '2026-08-05', av: 'green' },
  { id: 'C-03', nameEn: 'Bipin Kumar', nameAr: 'بيبين كومار', nat: 'India', prof: 'electrician', vacancy: 'VAC-02', stage: 'interview', phone: '+91 98111 405', expYears: 7, expected: 5200, skills: ['wiring', 'panel-maintenance', 'troubleshooting'], applied: '2026-06-25', av: 'red' },
  { id: 'C-10', nameEn: 'Vikram Singh', nameAr: 'فيكرام سينغ', nat: 'India', prof: 'foreman', vacancy: 'VAC-01', stage: 'interview', phone: '+91 99100 774', expYears: 12, expected: 6500, skills: ['supervision', 'scheduling', 'site-safety'], applied: '2026-07-10', av: 'blue' },
  { id: 'C-04', nameEn: 'Mohammad Yousaf', nameAr: 'محمد يوسف', nat: 'Pakistan', prof: 'cleaner', vacancy: 'VAC-03', stage: 'applied', phone: '+92 300 555 0871', expYears: 2, expected: 3000, skills: ['deep-cleaning', 'housekeeping', 'waste-handling'], applied: '2026-09-10', av: 'primary' },
  { id: 'C-06', nameEn: 'Nur Islam', nameAr: 'نور إسلام', nat: 'Bangladesh', prof: 'cleaner', vacancy: 'VAC-03', stage: 'offer', phone: '+880 1811 630 402', expYears: 4, expected: 3200, skills: ['deep-cleaning', 'housekeeping'], applied: '2026-08-14', av: 'azure' },
  { id: 'C-07', nameEn: 'Imran Khan', nameAr: 'عمران خان', nat: 'Pakistan', prof: 'electrician', vacancy: 'VAC-02', stage: 'hired', phone: '+92 345 555 0190', expYears: 6, expected: 3350, skills: ['wiring', 'panel-maintenance'], applied: '2026-06-20', av: 'purple', hiredCode: 'EMP-0021' },
  { id: 'C-11', nameEn: 'Saeed Al-Ghamdi', nameAr: 'سعيد الغامدي', nat: 'Saudi', prof: 'construction', vacancy: 'VAC-01', stage: 'rejected', phone: '+966 55 555 0147', expYears: 1, expected: 5500, skills: ['site-safety'], applied: '2026-08-01', av: 'green' }
];

// ── Workspace apps: meetings, internal mail, team chat ───────────────────
export const MEETINGS = [
  { id: 'MTG-01', title: 'Weekly ops sync', titleAr: 'الاجتماع الأسبوعي للعمليات', at: '2026-09-21', time: '09:00', durMin: 60, where: 'HQ — meeting room 1', attendees: ['EMP-0001', 'EMP-0002', 'EMP-0013', 'EMP-0023'], agenda: 'Deployment gaps for Sep · Ajeer flags · site safety', agendaAr: 'فجوات الإسناد لشهر سبتمبر · مخالفات أجير · السلامة الموقعية', status: 'scheduled', minutes: '', minutesAr: '' },
  { id: 'MTG-02', title: 'Payroll review — Sep', titleAr: 'مراجعة الرواتب — سبتمبر', at: '2026-09-24', time: '11:30', durMin: 45, where: 'Online', attendees: ['EMP-0001', 'EMP-0004', 'EMP-0024'], agenda: 'OT approvals · SIF for Sep', agendaAr: 'اعتماد الإضافات · ملف حماية الأجور لشهر سبتمبر', status: 'scheduled', minutes: '', minutesAr: '' },
  { id: 'MTG-03', title: 'Client QBR — Al-Bina', titleAr: 'مراجعة ربع سنوية — البناء', at: '2026-09-28', time: '13:00', durMin: 90, where: 'Client office — Olaya', attendees: ['EMP-0001', 'EMP-0002', 'EMP-0023'], agenda: 'SLA review · invoice aging · additional 4 workers', agendaAr: 'مراجعة مستوى الخدمة · أعمار الفواتير · ٤ عمال إضافيين', status: 'scheduled', minutes: '', minutesAr: '' },
  { id: 'MTG-04', title: 'Safety toolbox — North Ring', titleAr: 'جلسة السلامة — الطريق الشمالي', at: '2026-09-12', time: '07:00', durMin: 30, where: 'Site ST-001', attendees: ['EMP-0013', 'EMP-0014', 'EMP-0018', 'EMP-0020', 'EMP-0023'], agenda: 'Heat stress · scaffolding check', agendaAr: 'الإجهاد الحراري · فحص السقالات', status: 'done', minutes: 'Attended by 5. Scaffolding tags renewed; two helmets replaced.', minutesAr: 'حضرها ٥. تم تجديد بطاقات السقالات واستبدال خوذتين.' },
  { id: 'MTG-05', title: 'Interview — Bipin Kumar (electrician)', titleAr: 'مقابلة — بيبين كومار (كهربائي)', at: '2026-09-09', time: '10:30', durMin: 45, where: 'HQ', attendees: ['EMP-0002', 'EMP-0005'], agenda: 'Technical panel for VAC-02', agendaAr: 'لقطة فنية للوظيفة VAC-02', status: 'done', minutes: 'Recommended to proceed to offer at 5,200.', minutesAr: 'يُوصى بالانتقال إلى العرض براتب ٥٬٢٠٠.' }
];

export const MAILS = [
  { id: 'M-01', folder: 'inbox', from: 'EMP-0004', fromExt: '', to: 'me', subject: 'Sep payroll sign-off', subjectAr: 'اعتماد رواتب سبتمبر', body: 'Payroll draft is ready for review. OT totals look 4% above Aug — details in the run.', bodyAr: 'مسودة الرواتب جاهزة للمراجعة. الإضافات أعلى بنحو ٤٪ من أغسطس — التفاصيل في الدفعة.', at: '2026-09-18', read: false, starred: true },
  { id: 'M-02', folder: 'inbox', from: '', fromExt: 'sami@albina.example.sa', to: 'me', subject: 'Additional 10 workers for Q4', subjectAr: '١٠ عمال إضافيين للربع الرابع', body: 'We plan to add 10 construction workers in October. Can you share availability and rates?', bodyAr: 'نخطط لإضافة ١٠ عمال إنشاءات في أكتوبر. هل يمكن مشاركة التوفر والأسعار؟', at: '2026-09-17', read: false, starred: false },
  { id: 'M-03', folder: 'inbox', from: 'EMP-0002', fromExt: '', to: 'me', subject: 'Ajeer renewal — EMP-0008 blocked', subjectAr: 'تجديد أجير — EMP-0008', body: 'EMP-0008 has no Ajeer reference; flagged on the Sep invoice. Renewal checklist is in Renewals.', bodyAr: 'EMP-0008 بدون مرجع أجير؛ ظهر على فاتورة سبتمبر. قائمة التحقق في صفحة التجديدات.', at: '2026-09-16', read: true, starred: false },
  { id: 'M-04', folder: 'inbox', from: 'EMP-0005', fromExt: '', to: 'me', subject: '3 interview shortlists ready', subjectAr: '٣ قوائم مقابلات جاهزة', body: 'Shortlists for cleaners and accountant are on the recruitment board.', bodyAr: 'قوائم الفرز للنظافة والمحاسب على لوح الاستقطاب.', at: '2026-09-15', read: true, starred: false },
  { id: 'M-05', folder: 'inbox', from: '', fromExt: 'billing@facilitycare.example.sa', to: 'me', subject: 'Payment advice — Aug invoice', subjectAr: 'إشعار دفع — فاتورة أغسطس', body: 'Transfer initiated for invoice INV-2026-08-CL-002 (30,590 SAR). Reference FC-88123.', bodyAr: 'تم تحويل مبلغ الفاتورة INV-2026-08-CL-002 (٣٠٬٥٩٠ ريال). مرجع FC-88123.', at: '2026-09-14', read: true, starred: true },
  { id: 'M-06', folder: 'inbox', from: 'EMP-0024', fromExt: '', to: 'me', subject: 'Onboarding docs pending — 2 hires', subjectAr: 'مستندات تعيين ناقصة — موظفان', body: 'EMP-0021 and the new hire need GOSI registration and insurance activation.', bodyAr: 'EMP-0021 والموظف الجديد بحاجة لتسجيل التأمينات وتنشيط التأمين الطبي.', at: '2026-09-12', read: true, starred: false },
  { id: 'M-07', folder: 'sent', from: 'me', fromExt: '', to: 'EMP-0004', subject: 'Re: Sep payroll sign-off', subjectAr: 'رد: اعتماد رواتب سبتمبر', body: 'Reviewed — hold the EMP-0008 line until Ajeer is resolved, then close the run.', bodyAr: 'تمت المراجعة — أوقفوا بند EMP-0008 حتى تُحل مسألة أجير ثم أغلقوا الدفعة.', at: '2026-09-18', read: true, starred: false },
  { id: 'M-08', folder: 'sent', from: 'me', fromExt: '', to: 'EMP-0002', subject: 'Re: Ajeer renewal — EMP-0008', subjectAr: 'رد: تجديد أجير — EMP-0008', body: 'Start the renewal now and invoice without that line if it is not cleared by the 25th.', bodyAr: 'ابدأوا التجديد الآن، وإن لم تُحل المسألة قبل ٢٥ أصدرُا الفاتورة بدون هذا البند.', at: '2026-09-16', read: true, starred: false }
];

export const CHAT_CHANNELS = [
  { id: 'general', name: 'General', nameAr: 'عام', topic: 'Company-wide', topicAr: 'على مستوى الشركة' },
  { id: 'ops', name: 'Operations', nameAr: 'العمليات', topic: 'Sites and deployment', topicAr: 'المواقع والإسناد' },
  { id: 'payroll', name: 'Payroll', nameAr: 'الرواتب', topic: 'Runs and SIF', topicAr: 'الدفعات وملفات الحماية' }
];

export const CHAT_MESSAGES = [
  { id: 'CM-01', channel: 'general', from: 'EMP-0001', text: 'Reminder: QBR with Al-Bina on Sunday 1pm — bring the aging report.', textAr: 'تذكير: المراجعة مع البناء يوم الأحد ١ م — أحضروا تقرير الأعمار.', at: '2026-09-18T08:10' },
  { id: 'CM-02', channel: 'general', from: 'EMP-0005', text: 'Imran Khan signed the offer. Employee file is live (EMP-0021).', textAr: 'عمران خان وقّع العرض. ملفه أصبح جاهزًا (EMP-0021).', at: '2026-09-17T14:22' },
  { id: 'CM-03', channel: 'ops', from: 'EMP-0002', text: 'North Ring needs 2 more masons from next week.', textAr: 'الطريق الشمالي يحتاج ٢ بنائين إضافيين من الأسبوع القادم.', at: '2026-09-18T07:55' },
  { id: 'CM-04', channel: 'ops', from: 'EMP-0023', text: 'Scaffolding check done at ST-001 — all tags valid.', textAr: 'تم فحص السقالات في ST-001 — كل البطاقات سارية.', at: '2026-09-17T16:40' },
  { id: 'CM-05', channel: 'payroll', from: 'EMP-0004', text: 'Sep draft is open. OT entries close on the 24th.', textAr: 'مسودة سبتمبر مفتوحة. إغلاق قيود الإضافات يوم ٢٤.', at: '2026-09-18T09:05' },
  { id: 'CM-06', channel: 'payroll', from: 'EMP-0001', text: 'Keep EMP-0008 on hold until the Ajeer flag clears.', textAr: 'أوقفوا بند EMP-0008 حتى تنتهي ملاحظة أجير.', at: '2026-09-18T09:31' }
];

// §0.2b — seeded operating expenses (expense management demo set).
export const EXPENSES = [
  { id: 'EX-01', at: '2026-09-05', cat: 'gov', payee: 'Ajeer transfer fees — 8 workers', payeeAr: 'رسوم نقل أجير — 8 عمال', amount: 1760, vat: 0, method: 'transfer', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-02', at: '2026-09-01', cat: 'camp', payee: 'Camp 2 rent — September', payeeAr: 'إيجار المعسكر 2 — سبتمبر', amount: 24000, vat: 0, method: 'transfer', status: 'pending', note: 'Due before 09-25', noteAr: 'تُدفع قبل 2026-09-25' },
  { id: 'EX-03', at: '2026-09-10', cat: 'medical', payee: 'Bupa renewal — 12 workers', payeeAr: 'تجديد بوبا — 12 عامل', amount: 8400, vat: 1260, method: 'mada', status: 'approved', note: '', noteAr: '' },
  { id: 'EX-04', at: '2026-09-12', cat: 'fuel', payee: 'Diesel — site generators', payeeAr: 'ديزل — مولدات المواقع', amount: 1150, vat: 150, method: 'mada', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-05', at: '2026-09-15', cat: 'ppe', payee: 'Helmets & vests — new intake', payeeAr: 'خوذ وسديريات — الدفعة الجديدة', amount: 2300, vat: 345, method: 'transfer', status: 'pending', note: '18 workers', noteAr: '18 عامل' },
  { id: 'EX-06', at: '2026-09-17', cat: 'gov', payee: 'Qiwa contract upload fees', payeeAr: 'رسوم رفع عقود قوى', amount: 540, vat: 0, method: 'mada', status: 'pending', note: '', noteAr: '' },
  { id: 'EX-07', at: '2026-08-28', cat: 'office', payee: 'Office rent — August', payeeAr: 'إيجار المكتب — أغسطس', amount: 12000, vat: 0, method: 'cheque', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-08', at: '2026-08-20', cat: 'utilities', payee: 'Electricity — Camps 1 & 2', payeeAr: 'كهرباء — المعسكران 1 و2', amount: 3850, vat: 578, method: 'transfer', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-09', at: '2026-08-14', cat: 'gov', payee: 'Muqeem & permit renewals', payeeAr: 'تجديدات مقيم والتصاريح', amount: 4070, vat: 0, method: 'transfer', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-10', at: '2026-07-30', cat: 'maintenance', payee: 'Bus 4 — AC repair', payeeAr: 'الباص 4 — إصلاح المكيف', amount: 1600, vat: 240, method: 'cash', status: 'paid', note: '', noteAr: '' },
  { id: 'EX-11', at: '2026-07-11', cat: 'medical', payee: 'Bupa additions — 3 hires', payeeAr: 'إضافات بوبا — 3 توظيفات', amount: 1850, vat: 278, method: 'mada', status: 'approved', note: '', noteAr: '' },
  { id: 'EX-12', at: '2026-06-25', cat: 'utilities', payee: 'Water supply — camps', payeeAr: 'تزويد مياه — المعسكرات', amount: 940, vat: 141, method: 'transfer', status: 'paid', note: '', noteAr: '' }
];

// §0.3 — seeded leave types (admin-tunable in Settings from P2; engine reads this shape).
export const LEAVE_TYPES = [
  { code: 'annual', en: 'Annual', ar: 'سنوية', base: 21, after5: 30, pay: 1 },
  {
    code: 'sick',
    en: 'Sick',
    ar: 'مرضية',
    tiers: [
      { days: 30, pay: 1 },
      { days: 60, pay: 0.75 },
      { days: 30, pay: 0 }
    ]
  },
  { code: 'maternity', en: 'Maternity', ar: 'أمومة', weeks: 10 },
  { code: 'paternity', en: 'Newborn', ar: 'مولود جديد', days: 3, pay: 1 },
  { code: 'marriage', en: 'Marriage', ar: 'زواج', days: 5, pay: 1 },
  { code: 'bereavement', en: 'Bereavement', ar: 'وفاة قريب', days: 5, siblingDays: 3, pay: 1 },
  { code: 'iddah', en: 'Iddah (widow)', ar: 'عدة', months: 4, extraDays: 10, pay: 1 },
  { code: 'hajj', en: 'Hajj', ar: 'حج', days: 15, once: true, afterYears: 2 },
  { code: 'unpaid', en: 'Unpaid', ar: 'بدون أجر', days: 10, pay: 0 }
];

// Demo holiday calendar (Gregorian + Hijri). Eid dates are approximate demo values.
// GOSI pension rate versions (each side), effective dates. SANED 0.75%/side, hazards 2% employer.
export const GOSI_VERSIONS = [
  { from: '2024-07-03', pension: 0.09 },
  { from: '2025-07-03', pension: 0.095 },
  { from: '2026-07-03', pension: 0.1 },
  { from: '2027-07-03', pension: 0.105 },
  { from: '2028-07-03', pension: 0.11 }
];
export const GOSI_SANED = 0.0075;
export const GOSI_HAZARDS = 0.02;
export const GOSI_CAP = 45000; // SAR/month on basic+housing
export const GOSI_CUTOFF = '2024-07-03'; // enrolled before → old system (fixed 9%)

// Work-permit levy bands (SAR/month) — versioned demo values, editable in Settings.// Deduction categories payroll must REJECT when employer-borne (Art. 40).
export const BLOCKED_DEDUCTIONS = ['iqama', 'levy', 'insurance', 'recruitment'];

// ── P1: expat lifecycle + tracker ─────────────────────────────────────────
// Visa blocks & agents (overseas recruitment channel).
// Per-worker visas. status: used | awaiting | expired | cancelled.
// Onboarding pipeline (§4.7). type: overseas | transfer. stages: {n: dateISO}.
// Qiwa transfer cases (local-hire expats skip onboarding stages 2–5).
// Residency documents per expat (passport + medical insurance + traffic fines).
// Document vault. expires: '' = no expiry. Seeded rows are metadata records.
// Reporting lines (org chart). mgr: null = root.
export const ORG_LINKS = [
  { emp: 'EMP-0001', mgr: null },
  { emp: 'EMP-0002', mgr: 'EMP-0001' },
  { emp: 'EMP-0003', mgr: 'EMP-0001' },
  { emp: 'EMP-0004', mgr: 'EMP-0001' },
  { emp: 'EMP-0005', mgr: 'EMP-0001' },
  { emp: 'EMP-0024', mgr: 'EMP-0001' },
  { emp: 'EMP-0006', mgr: 'EMP-0002' },
  { emp: 'EMP-0007', mgr: 'EMP-0002' },
  { emp: 'EMP-0008', mgr: 'EMP-0002' },
  { emp: 'EMP-0009', mgr: 'EMP-0002' },
  { emp: 'EMP-0010', mgr: 'EMP-0002' },
  { emp: 'EMP-0011', mgr: 'EMP-0002' },
  { emp: 'EMP-0012', mgr: 'EMP-0002' },
  { emp: 'EMP-0013', mgr: 'EMP-0002' },
  { emp: 'EMP-0014', mgr: 'EMP-0002' },
  { emp: 'EMP-0015', mgr: 'EMP-0002' },
  { emp: 'EMP-0016', mgr: 'EMP-0002' },
  { emp: 'EMP-0017', mgr: 'EMP-0002' },
  { emp: 'EMP-0018', mgr: 'EMP-0002' },
  { emp: 'EMP-0019', mgr: 'EMP-0002' },
  { emp: 'EMP-0020', mgr: 'EMP-0002' },
  { emp: 'EMP-0021', mgr: 'EMP-0002' },
  { emp: 'EMP-0022', mgr: 'EMP-0002' },
  { emp: 'EMP-0023', mgr: 'EMP-0002' }
];

// ── P2: time & leave ─────────────────────────────────────────────────────
// Weekend in KSA: Friday + Saturday (JS day numbers).
// Deterministic demo attendance: past 14 days for assigned workers.
// Weekly site timesheets (supervisor view; approved = locked billing feed).
// Leave requests. status: pending | approved | rejected | cancelled. Historical
// approved annual requests are already counted in employee.annualUsed.
// Approval chains v1 (flows → ordered roles). Admin may act at any step.
// — P3: Ajeer permits (one e-contract per deployment; Decision 60339) —
// — P3: invoices (inputs only; amounts computed by the engine) —
// ── P4: payroll, expenses, advances ────────────────────────────────────────
// Pay-run lines are computed live from employees + adjustments via calcPayLine
// (hr-statutory.js) so seed math can never drift; the UI locks approved/paid
// runs. The backend replaces this with snapshotted lines (see httpAdapter).

export const SEED_EOSB = {
  basis: 'basic', // 'basic' | 'basic+housing' — wage basis for Art. 84 (counsel sets)
  capMonths: 0, // 0 = no cap; sources cite 12 vs 18 — verify, then set here
  payDaysEmployer: 7, // pay within 1 week on employer termination
  payDaysResign: 14 // …within 2 weeks on resignation
};

// ── P5: contract templates + registers + hiring ────────────────────────────
// Template bodies are bilingual with {{placeholders}} (see KNOWN_PLACEHOLDERS).
// Fields with `source` auto-fill from the picked party; the rest are manual.

// ── P6: performance, training, org, audit, broadcasts ──────────────────────

// RBAC roles (seed-mode UX only — the server enforces). Rank: lower = stronger.
export const ROLES = [
  { code: 'admin', en: 'Administrator', ar: 'مدير النظام', rank: 1 },
  { code: 'hr', en: 'HR Officer', ar: 'موظف موارد بشرية', rank: 2 },
  { code: 'ops', en: 'Operations Coordinator', ar: 'منسق التشغيل', rank: 3 },
  { code: 'payroll', en: 'Payroll Officer', ar: 'موظف الرواتب', rank: 4 },
  { code: 'pro', en: 'PRO', ar: 'المعقب', rank: 5 },
  { code: 'finance', en: 'Finance (read)', ar: 'المالية (قراءة)', rank: 6 },
  { code: 'manager', en: 'Manager', ar: 'مدير', rank: 7 },
  { code: 'site-supervisor', en: 'Site Supervisor', ar: 'مشرف موقع', rank: 8 },
  { code: 'employee', en: 'Employee', ar: 'موظف', rank: 9 }
];

// Module scopes per role ('*' = all). Keys match sidebar data-page keys.
export const ROLE_SCOPES = {
  admin: ['*'],
  hr: [
    'dashboard',
    'analytics',
    'employees',
    'employee-file',
    'my-space',
    'my-team',
    'org',
    'departments',
    'roles',
    'settings'
  ],
  ops: ['dashboard', 'analytics', 'employees', 'my-space', 'my-team'],
  payroll: ['dashboard', 'employees'],
  pro: ['dashboard', 'employees', 'my-space'],
  finance: ['dashboard', 'employees'],
  manager: ['dashboard', 'employees', 'my-team', 'my-space'],
  'site-supervisor': ['dashboard', 'employees', 'my-team', 'my-space'],
  employee: ['my-space']
};

export const AUDIT_LOG = [
  {
    id: 'AU-2026-091',
    at: '2026-09-09T11:20:00',
    actor: 'EMP-0001',
    action: 'offer.accept',
    entity: 'OF-2026-003',
    detail: 'Candidate CD-2026-008 hired'
  },
  {
    id: 'AU-2026-092',
    at: '2026-09-08T15:02:00',
    actor: 'EMP-0002',
    action: 'invoice.pay',
    entity: 'INV-2026-08-CL-002',
    detail: 'Marked paid'
  },
  {
    id: 'AU-2026-093',
    at: '2026-09-08T09:41:00',
    actor: 'EMP-0001',
    action: 'expense.approve',
    entity: 'EXP-2026-012',
    detail: 'SAR 2,070 approved'
  },
  {
    id: 'AU-2026-094',
    at: '2026-09-04T13:15:00',
    actor: 'EMP-0002',
    action: 'expense.pay',
    entity: 'EXP-2026-013',
    detail: 'SAR 1,092.50 paid'
  },
  {
    id: 'AU-2026-095',
    at: '2026-09-03T10:05:00',
    actor: 'EMP-0001',
    action: 'expense.reject',
    entity: 'EXP-2026-017',
    detail: 'Personal fine — not reimbursable'
  },
  {
    id: 'AU-2026-096',
    at: '2026-09-02T12:30:00',
    actor: 'EMP-0002',
    action: 'payrun.pay',
    entity: 'PR-2026-08',
    detail: 'August run paid'
  },
  {
    id: 'AU-2026-097',
    at: '2026-09-01T10:00:00',
    actor: 'EMP-0002',
    action: 'wps.submit',
    entity: 'PR-2026-08',
    detail: 'SIF accepted by Mudad'
  },
  {
    id: 'AU-2026-098',
    at: '2026-08-30T14:22:00',
    actor: 'EMP-0001',
    action: 'contract.issue',
    entity: 'CT-2026-006',
    detail: 'Salary certificate issued'
  },
  {
    id: 'AU-2026-099',
    at: '2026-08-28T09:12:00',
    actor: 'EMP-0001',
    action: 'candidate.reject',
    entity: 'CD-2026-006',
    detail: 'No driving experience'
  },
  {
    id: 'AU-2026-100',
    at: '2026-08-25T16:44:00',
    actor: 'EMP-0001',
    action: 'settings.save',
    entity: 'hr:settings:v1',
    detail: 'Nitaqat target updated'
  }
];

// ── Attendance (attendance.html) ──
// Deterministic demo seed for the last 14 calendar days, working days only
// (Fri/Sat weekend). mulberry32 keeps the numbers stable across reloads so
// stats and charts don't jump. Exited employees are not scheduled; huroob is
// absent; on-leave employees carry leave days. `late` is minutes after the
// 08:00 shift start; `hours` exclude a 1-hour break.
export const SHIFT_START_MIN = 8 * 60; // 08:00
const SHIFT_END_MIN = 17 * 60; // 17:00

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localIso(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function hhmm(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

export const ATTENDANCE = (() => {
  const rnd = mulberry32(20260918);
  const days = [];
  const today = new Date();
  for (let back = 13; back >= 0; back -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const wd = d.getDay();
    if (wd === 5 || wd === 6) {
      continue; // Fri/Sat weekend — no expected attendance
    }
    days.push(localIso(d));
  }
  const rows = [];
  for (const day of days) {
    for (const e of EMPLOYEES) {
      if (e.st === 'exited') {
        continue; // off roster — not scheduled
      }
      // `emp` (not `code`) keeps getSeed's overlay key on the composite `id`,
      // so locally logged/imported days merge per employee+date.
      const base = { id: `${e.code}@${day}`, emp: e.code, dept: e.dept, date: day };
      if (e.st === 'huroob') {
        rows.push({ ...base, st: 'absent', cin: '', cout: '', hours: 0, late: 0 });
        continue;
      }
      if (e.st === 'on-leave') {
        rows.push({ ...base, st: 'leave', cin: '', cout: '', hours: 0, late: 0 });
        continue;
      }
      const r = rnd();
      if (r < 0.04) {
        rows.push({ ...base, st: 'leave', cin: '', cout: '', hours: 0, late: 0 });
      } else if (r < 0.07) {
        rows.push({ ...base, st: 'absent', cin: '', cout: '', hours: 0, late: 0 });
      } else if (r < 0.15) {
        const cinMin = SHIFT_START_MIN + 5 + Math.floor(rnd() * 80); // 08:05–09:25
        const coutMin = SHIFT_END_MIN + Math.floor(rnd() * 20);
        rows.push({
          ...base,
          st: 'late',
          cin: hhmm(cinMin),
          cout: hhmm(coutMin),
          hours: Math.round(((coutMin - cinMin - 60) / 60) * 10) / 10,
          late: cinMin - SHIFT_START_MIN
        });
      } else {
        const cinMin = SHIFT_START_MIN - Math.floor(rnd() * 20); // 07:40–08:00
        const coutMin = SHIFT_END_MIN + Math.floor(rnd() * 30);
        rows.push({
          ...base,
          st: 'present',
          cin: hhmm(cinMin),
          cout: hhmm(coutMin),
          hours: Math.round(((coutMin - cinMin - 60) / 60) * 10) / 10,
          late: 0
        });
      }
    }
  }
  return rows;
})();

// ── Leave requests (leave.html) ──
// Deterministic demo log over the trailing 12 months plus a forward-looking
// pending queue. Employees whose attendance seed is "on leave" on the latest
// seeded day get an approved request spanning today, so the attendance board
// and the leave board tell the same story. `emp` (not `code`) keeps getSeed's
// overlay key on the composite `id` (employee@from) — approvals, rejections
// and new requests patch/append per employee+start date.
export const LEAVES = (() => {
  const rnd = mulberry32(20260918);
  const active = EMPLOYEES.filter(e => e.st !== 'exited');
  const out = [];
  const today = new Date();
  const iso = localIso(today);
  const isoShift = (isoDate, n) => {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + n);
    return localIso(d);
  };
  const inclusive = (a, b) =>
    Math.max(1, Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const push = (e, type, from, to, st) => {
    out.push({
      id: `${e.code}@${from}`,
      emp: e.code,
      dept: e.dept,
      type,
      from,
      to,
      days: inclusive(from, to),
      st,
      note: ''
    });
  };

  // Today-spanners — mirror the attendance board's leave rows.
  const lastAttDay = (() => {
    const ds = [...new Set(ATTENDANCE.map(r => r.date))].sort();
    return ds[ds.length - 1] || iso;
  })();
  const outToday = [...new Set(
    ATTENDANCE.filter(r => r.date === lastAttDay && r.st === 'leave').map(r => r.emp)
  )];
  for (const code of outToday.slice(0, 4)) {
    const e = active.find(x => x.code === code);
    if (e) {
      push(e, 'annual', isoShift(iso, -3), isoShift(iso, 4), 'approved');
    }
  }

  // Trailing 12 months: a handful of requests per month across all types.
  const weighted = [
    'annual', 'annual', 'annual', 'annual', 'annual', 'annual',
    'sick', 'sick', 'sick',
    'marriage', 'paternity', 'bereavement', 'unpaid', 'hajj'
  ];
  const fixedDays = {};
  for (const t of LEAVE_TYPES) {
    fixedDays[t.code] = t.days || 7;
  }
  for (let back = 11; back >= 0; back -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const nReq = 3 + Math.floor(rnd() * 4); // 3–6
    for (let i = 0; i < nReq; i += 1) {
      const e = pick(active);
      let type = pick(weighted);
      if (type === 'hajj' && !e.saudi) {
        type = 'annual'; // Hajj leave is Saudi-only
      }
      if (type === 'paternity' && e.gender !== 'M') {
        type = 'annual';
      }
      const start = new Date(y, m, 1 + Math.floor(rnd() * 27));
      const from = localIso(start);
      if (from > iso) {
        continue; // keep the trailing log strictly in the past
      }
      let len = fixedDays[type] || 7;
      if (type === 'annual') {
        len = 7 + Math.floor(rnd() * 15); // 7–21
      } else if (type === 'sick') {
        len = 2 + Math.floor(rnd() * 9); // 2–10
      } else if (type === 'unpaid') {
        len = 5 + Math.floor(rnd() * 6);
      }
      const to = isoShift(from, len - 1);
      const r = rnd();
      const st = r < 0.82 ? 'approved' : r < 0.91 ? 'rejected' : 'cancelled';
      push(e, type, from, to, st);
    }
  }

  // Forward-looking queue: pending requests starting within ~6 weeks.
  const pendEmps = [...active].sort(() => rnd() - 0.5).slice(0, 6);
  pendEmps.forEach((e, i) => {
    const from = isoShift(iso, 3 + i * 6 + Math.floor(rnd() * 4));
    const len = 5 + Math.floor(rnd() * 12);
    push(e, i % 3 === 0 ? 'unpaid' : 'annual', from, isoShift(from, len - 1), 'pending');
  });

  return out;
})();
