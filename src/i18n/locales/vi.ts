// Vietnamese — the app's original language and the structural source of
// truth for every other locale. `en.ts`/`de.ts` are typed against
// `typeof vi` (see ../translate.ts), so `tsc` fails the build if a key
// exists here but is missing there — this is the safety net that keeps a
// ~500-string, 3-language dictionary from silently drifting out of sync.
//
// Namespacing: `screens.<screenName>.*` and `components.<componentName>.*`
// mirror the file each string lives in, so a translation is easy to find.
// `common.*` holds strings reused across many files (button labels etc).
export const vi = {
  common: {
    cancel: 'Huỷ',
    save: 'Lưu',
    delete: 'Xoá',
    deletePermanently: 'Xoá vĩnh viễn',
    edit: 'Sửa',
    add: 'Thêm',
    close: 'Đóng',
    confirm: 'Xác nhận',
    ok: 'OK',
    error: 'Lỗi',
    loading: 'Đang tải...',
    seeMore: 'Xem thêm',
    seeLess: 'Ẩn bớt',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    threeDaysAgo: 'Hôm kìa',
    disclaimerShort: 'Chỉ để tham khảo — không phải tư vấn y tế.',
    justNow: 'vừa xong',
    minutesAgo: '{{n}} phút trước',
    hoursAgo: '{{n}} giờ trước',
    daysAgo: '{{n}} ngày trước',
  },

  nav: {
    home: 'Pin hôm nay',
    history: 'Lịch sử',
    training: 'Tập luyện',
    diary: 'Nhật ký',
    settings: 'Cài đặt',
  },

  // Battery-type display names — keyed by BatteryType['id'] (stable,
  // persisted in SQLite `battery_types.id`). Display always overrides the
  // DB-seeded `name` column with this lookup so the label follows the
  // current app language instead of whatever was written at first install.
  batteries: {
    protein: { name: 'Protein' },
    carbs: { name: 'Carbs' },
    water: { name: 'Nước' },
    minerals: { name: 'Khoáng chất' },
    sleep: { name: 'Giấc ngủ' },
    movement: { name: 'Vận động' },
    energy: { name: 'Năng lượng' },
  },

  meals: {
    breakfast: 'Bữa sáng',
    lunch: 'Bữa trưa',
    dinner: 'Bữa tối',
    snack: 'Bữa phụ',
  },

  // Portion & measure units for foods. `portion.*` names ONE portion of a
  // counted food; `measure.*` labels the g/ml the amounts are expressed in.
  units: {
    portion: {
      pack: 'gói',
      capsule: 'viên',
      serving: 'khẩu phần',
      countFormat: '{{count}} {{unit}}',
      countWithMeasure: '{{portion}} ({{measure}})',
      servingDefinition: '1 {{unit}} = {{measure}}',
    },
    measure: {
      gram: 'gram (g)',
      milliliter: 'mililít (ml)',
      gramShort: 'g',
      milliliterShort: 'ml',
    },
  },

  foodCategories: {
    grain: 'Tinh bột',
    meat: 'Thịt',
    fish: 'Cá & hải sản',
    egg_dairy: 'Trứng & sữa',
    legume_nut: 'Đậu & hạt',
    vegetable: 'Rau củ',
    fruit: 'Trái cây',
    fat_sugar: 'Dầu mỡ & đường',
    dish: 'Món chế biến',
    drink: 'Đồ uống',
    supplement: 'Thực phẩm chức năng',
    snack: 'Bánh & ăn vặt',
  },

  // "Món của tôi" — danh sách món người dùng tự thêm/tự sửa, lưu trên máy.
  myFoods: {
    title: '🍽️ Món của tôi',
    subtitle:
      'Danh sách này nằm trên máy bạn, không đồng bộ đi đâu. App chỉ cung cấp engine tính toán — khung ăn uống là của bạn.',
    openButton: 'Món của tôi',
    customSectionTitle: 'Món tôi tự thêm ({{count}})',
    overrideSectionTitle: 'Món catalog tôi đã sửa ({{count}})',
    emptyCustom: 'Chưa có món nào. Thêm món mới ngay trong màn hình “Ghi món ăn”.',
    emptyOverride: 'Chưa sửa thành phần món nào của catalog.',
    rowBasis: 'Dinh dưỡng ghi cho {{basis}}',
    deleteTitle: 'Xoá món này?',
    deleteCustomMessage:
      'Xoá “{{name}}” khỏi danh sách của bạn. Các bữa đã ghi trước đây KHÔNG bị đổi — chúng giữ nguyên số liệu đã lưu.',
    deleteOverrideMessage:
      'Bỏ phần bạn đã sửa cho “{{name}}”. Món này sẽ quay về đúng số liệu gốc của catalog.',
    deleteConfirm: 'Xoá',
    revertConfirm: 'Bỏ sửa',
    export: {
      button: '📤 Xuất danh sách món',
      shareDialogTitle: 'Lưu danh sách món của tôi',
      doneTitle: 'Đã xuất',
      doneMessage: 'Đã xuất {{custom}} món tự thêm và {{override}} món đã sửa.',
      errorMessage: 'Không xuất được danh sách món.',
    },
    import: {
      button: '📥 Nhập từ file',
      pickTitle: 'Chọn file để nhập',
      pickHint:
        'App tìm file .json trong thư mục tài liệu của app (mở app Files → On My iPhone → BodyBatteries để chép file vào).',
      noFiles: 'Không tìm thấy file .json nào trong thư mục tài liệu của app.',
      doneTitle: 'Đã nhập',
      doneMessage: 'Đã nhập {{custom}} món tự thêm và {{override}} món đã sửa. Món trùng ID được ghi đè.',
      errorTitle: 'Không nhập được',
      notJson: 'File này không phải JSON hợp lệ.',
      wrongVersion: 'File này thuộc phiên bản khác, app chưa đọc được.',
      empty: 'File hợp lệ nhưng không chứa món nào.',
      unreadable: 'Không đọc được file.',
    },
  },

  modes: {
    training: { name: 'Tập luyện', description: 'Nhu cầu dinh dưỡng cao hơn, pin xả nhanh hơn' },
    maintain: { name: 'Duy trì', description: 'Mức năng lượng bình thường mỗi ngày' },
    rest: { name: 'Nghỉ ngơi', description: 'Phục hồi — nhu cầu thấp hơn, pin bền hơn' },
  },

  activities: {
    walking: 'Đi bộ',
    brisk_walking: 'Đi nhanh',
    running: 'Chạy bộ',
    cycling: 'Đạp xe',
    elliptical: 'Elliptical',
    swimming: 'Bơi lội',
    football: 'Đá bóng',
    basketball: 'Bóng rổ',
    badminton: 'Cầu lông',
    tennis: 'Tennis',
    gym_strength: 'Tập tạ (theo phút)',
    hiit: 'HIIT',
    yoga: 'Yoga',
    squat: 'Squat',
    bench_press: 'Bench press',
    deadlift: 'Deadlift',
    bodybuilding: 'Bodybuilding',
    custom: 'Môn tự thêm',
  },

  activityCategories: {
    cardio: 'Cardio',
    sports: 'Thể thao',
    gym: 'Gym/Tạ',
    other: 'Khác',
  },

  // S-BB muscle-group tab labels — keyed by MuscleGroup (types/energy.ts),
  // shown in BodybuildingSheet's muscle-group browser and the custom-exercise
  // form's group picker.
  muscleGroups: {
    chest: 'Ngực',
    back: 'Lưng',
    legs: 'Chân',
    shoulders: 'Vai',
    biceps: 'Tay trước',
    triceps: 'Tay sau',
    core: 'Bụng',
    glutes: 'Mông',
  },

  // S-BB exercise MET tier labels — keyed by BbMetTier, shown in the
  // custom-exercise form's "độ nặng" picker (see docs/06 §1C for the
  // Compendium anchors each tier maps to).
  bbTiers: {
    isolation: 'Cô lập',
    compound: 'Phối hợp',
    big_compound: 'Phối hợp lớn',
  },

  // S-BB rest-style/intensity labels — keyed by BbIntensity, shown per
  // exercise in BodybuildingSheet.
  bbIntensity: {
    light: 'Nhẹ',
    moderate: 'Vừa',
    superset: 'Superset (nghỉ ngắn)',
  },

  // S-BB built-in exercise library display names — keyed by
  // BodybuildingExercise['id'] (src/lib/bodybuildingExercises.ts, stable,
  // NOT stored in WorkoutSession for built-ins — always looked up live).
  bbExercises: {
    // Ngực
    dumbbell_bench_press: 'Đẩy ngực tạ đơn',
    incline_dumbbell_press: 'Đẩy ngực tạ đơn trên ghế dốc',
    chest_press_machine: 'Đẩy ngực máy',
    dumbbell_fly: 'Bay ngực tạ đơn',
    cable_crossover: 'Cáp chéo ngực (Cable Crossover)',
    // Lưng
    lat_pulldown: 'Kéo xô (Lat Pulldown)',
    seated_cable_row: 'Kéo cáp ngồi (Seated Row)',
    barbell_row: 'Kéo lưng đòn tạ (Barbell Row)',
    pull_up: 'Hít xà (Pull-up)',
    one_arm_dumbbell_row: 'Kéo lưng tạ đơn 1 tay',
    straight_arm_pulldown: 'Kéo cáp tay thẳng (Straight-arm Pulldown)',
    face_pull: 'Kéo mặt (Face Pull)',
    // Chân
    leg_press: 'Đẩy đùi (Leg Press)',
    walking_lunge: 'Lunge bước đi',
    leg_extension: 'Duỗi đùi (Leg Extension)',
    leg_curl: 'Gập gối (Leg Curl)',
    bulgarian_split_squat: 'Squat chân trước Bulgaria',
    calf_raise: 'Nhón bắp chân (Calf Raise)',
    goblet_squat: 'Squat ôm tạ (Goblet Squat)',
    // Vai
    overhead_press: 'Đẩy vai (Overhead Press)',
    lateral_raise: 'Nâng vai ngang tạ đơn',
    cable_lateral_raise: 'Nâng vai ngang cáp',
    front_raise: 'Nâng vai trước',
    rear_delt_fly: 'Bay vai sau',
    arnold_press: 'Đẩy vai Arnold (Arnold Press)',
    // Tay trước
    barbell_curl: 'Cuốn tay đòn tạ',
    dumbbell_curl: 'Cuốn tay tạ đơn',
    hammer_curl: 'Cuốn tay búa (Hammer Curl)',
    cable_curl: 'Cuốn tay cáp',
    // Tay sau
    triceps_pushdown: 'Ép cáp tay sau (Pushdown)',
    skull_crusher: 'Ép tay sau nằm (Skull Crusher)',
    overhead_triceps_extension: 'Duỗi tay sau qua đầu',
    close_grip_bench_press: 'Đẩy ngực tay hẹp',
    dips: 'Xà kép (Dips)',
    dumbbell_kickback: 'Đá tay sau tạ đơn (Kickback)',
    // Bụng
    crunch: 'Gập bụng (Crunch)',
    plank: 'Plank',
    hanging_leg_raise: 'Nâng chân treo xà',
    russian_twist: 'Xoay eo kiểu Nga (Russian Twist)',
    cable_woodchop: 'Chặt cáp chéo bụng (Woodchop)',
    ab_wheel_rollout: 'Lăn bánh xe bụng (Ab Wheel)',
    // Mông
    hip_thrust: 'Đẩy hông (Hip Thrust)',
    glute_bridge: 'Cầu mông (Glute Bridge)',
    cable_kickback: 'Đá mông cáp (Cable Kickback)',
    romanian_deadlift_dumbbell: 'Deadlift Romania tạ đơn',
  },

  // Micronutrient names + gentle assessment advice (see
  // src/domain/nutrition/nutritionAssessment.ts). under/overAdvice is only
  // ever surfaced for a nutrient id when ASSESSMENT_RULES defines that
  // threshold — every id still gets both strings here so the 3 locale files
  // keep one uniform shape (see the file-level comment above).
  nutrients: {
    fiber: {
      name: 'Chất xơ',
      underAdvice: 'Hơi ít chất xơ — thử thêm rau xanh, trái cây, yến mạch hoặc các loại đậu.',
      overAdvice: 'Chất xơ đã vượt mức khuyến nghị — vậy là tốt, cứ tiếp tục ăn nhiều rau củ.',
    },
    iron: {
      name: 'Sắt',
      underAdvice: 'Hơi ít sắt — thử thêm thịt đỏ, gan, đậu lăng hoặc rau bina.',
      overAdvice: 'Sắt đã vượt mức khuyến nghị — nếu không dùng thêm viên uống bổ sung thì không đáng lo.',
    },
    calcium: {
      name: 'Canxi',
      underAdvice: 'Hơi ít canxi — thử thêm sữa, sữa chua, đậu phụ hoặc cá nhỏ ăn cả xương.',
      overAdvice:
        'Canxi đã vượt mức khuyến nghị — thường ổn từ thực phẩm, chỉ cần lưu ý nếu có dùng thêm viên canxi.',
    },
    fat: {
      name: 'Chất béo',
      underAdvice:
        'Hơi ít chất béo — thử thêm dầu ô liu, cá béo hoặc các loại hạt (miễn đủ năng lượng cả ngày).',
      overAdvice: 'Chất béo đã vượt mức khuyến nghị — thử giảm bớt đồ chiên rán, mỡ động vật.',
    },
    potassium: {
      name: 'Kali',
      underAdvice: 'Hơi ít kali — thử thêm chuối, khoai lang, rau bina hoặc cam.',
      overAdvice: 'Kali đã vượt mức khuyến nghị — thường ổn khi đến từ thực phẩm tự nhiên.',
    },
    magnesium: {
      name: 'Magie',
      underAdvice: 'Hơi ít magie — thử thêm hạt bí, hạnh nhân, rau bina hoặc đậu đen.',
      overAdvice:
        'Magie đã vượt mức khuyến nghị — từ thực phẩm thì không đáng ngại, chỉ cần chú ý nếu dùng thêm viên uống bổ sung.',
    },
    zinc: {
      name: 'Kẽm',
      underAdvice: 'Hơi ít kẽm — thử thêm hàu, thịt bò, hạt bí hoặc đậu gà.',
      overAdvice: 'Kẽm đã vượt mức khuyến nghị — nếu không dùng thêm viên uống bổ sung thì không đáng lo.',
    },
    omega3: {
      name: 'Omega-3 (EPA+DHA)',
      underAdvice: 'Hơi ít omega-3 — thử thêm cá hồi, cá thu, hạt chia hoặc dầu cá.',
      overAdvice:
        'Omega-3 đã vượt mức khuyến nghị — mức này thường an toàn, chỉ cần chú ý nếu dùng viên dầu cá liều cao.',
    },
    sodium: {
      name: 'Natri (muối)',
      underAdvice: '',
      overAdvice: 'Natri đã vượt ngưỡng gợi ý — thử giảm nước mắm, muối chấm, đồ hộp hoặc mì gói.',
    },
    sugar: {
      name: 'Đường',
      underAdvice: '',
      overAdvice: 'Đường đã vượt ngưỡng gợi ý — thử giảm nước ngọt, bánh kẹo hoặc trà sữa.',
    },
    salt: {
      name: 'Muối (NaCl)',
      underAdvice: '',
      overAdvice: 'Muối đã vượt ngưỡng gợi ý — thử giảm nước mắm, muối chấm, đồ hộp hoặc mì gói.',
    },
  },

  assessment: {
    disclaimer: 'Chỉ để tham khảo — không phải tư vấn y tế.',
    allGood: 'Ổn 👍',
  },

  overdose: {
    title: 'Vượt mức dung nạp tối đa tham khảo',
    // {{name}}/{{current}}/{{unit}}/{{limit}} interpolated — see
    // src/domain/nutrition/overdoseWarning.ts.
    message:
      '{{name}}: đã nạp {{current}}{{unit}}, vượt mức dung nạp tối đa tham khảo ({{limit}}{{unit}}). Nếu bạn đang dùng nhiều thực phẩm chức năng cùng loại, cân nhắc giảm bớt. Chỉ để tham khảo, không thay lời khuyên y tế.',
  },

  // Excel export — sheet tab names + column headers (see
  // src/services/export/excelExportService.ts and domain/nutrition/excelSheets.ts).
  // Excel sheet tab names are capped at 31 chars by the file format; every
  // value below fits comfortably in all 3 languages.
  export: {
    shareDialogTitle: 'Xuất dữ liệu Body Batteries',
    trainingBlock: {
      sheetPlan: 'Kế hoạch Block',
      sheetWeekly: 'Tổng theo tuần',
      week: 'Tuần',
      dateRange: 'Khoảng ngày',
      kcal: 'Kcal',
      deficitTarget: 'Mục tiêu thâm hụt (kcal)',
      printTitle: 'Block {{focus}} ({{start}} - {{end}})',
      cellLine: '{{sets}}x{{reps}} @ {{weight}}kg (~{{pct}}%)',
      plannedRowLabel: 'Kế hoạch: {{label}}',
      actualRowLabel: 'Thực tế: {{label}}',
    },
    sheets: {
      dailyTotals: 'Tổng hợp ngày',
      foodEntries: 'Chi tiết món ăn',
      batteryReadings: 'Chỉ số pin',
      intakeEvents: 'Sự kiện nạp',
      foodLog: 'Nhật ký ăn uống',
      nutritionByDay: 'Dinh dưỡng ngày',
      weeklySummary: 'Tổng kết tuần',
      referenceThresholds: 'Bảng ngưỡng tham chiếu',
    },
    columns: {
      date: 'Ngày',
      time: 'Giờ',
      meal: 'Bữa',
      foodName: 'Món ăn',
      grams: 'Gram',
      qty: 'Số lượng',
      kcal: 'Kcal',
      calories: 'Calo (kcal)',
      protein: 'Đạm (g)',
      fat: 'Béo (g)',
      carbs: 'Carbs (g)',
      water: 'Nước (ml)',
      minerals: 'Khoáng (mg)',
      weight: 'Cân nặng (kg)',
      burnedKcal: 'Kcal đã đốt',
      estimatedEnergyNeed: 'Nhu cầu năng lượng ước tính (kcal)',
      energyBalance: 'Cân bằng calo (+/-)',
      sugar: 'Đường (g)',
      fiber: 'Chất xơ (g)',
      iron: 'Sắt (mg)',
      salt: 'Muối (g)',
      brand: 'Thương hiệu',
      food: 'Món ăn',
      battery: 'Loại pin',
      level: 'Mức hiện tại',
      capacity: 'Sức chứa',
      percentage: 'Phần trăm (%)',
      amount: 'Lượng',
      note: 'Ghi chú',
      assessment: 'Đánh giá',
      nutrient: 'Chất',
      avgPerDay: 'TB/ngày',
      recommendedPerDay: 'Khuyến nghị/ngày',
      pctReached: '% đạt',
      threshold: 'Ngưỡng',
      advice: 'Lời góp ý',
      source: 'Nguồn (URL)',
    },
    thresholdUnder: 'Dưới {{pct}}% mục tiêu ({{value}} {{unit}})',
    thresholdOver: 'Trên {{pct}}% mục tiêu ({{value}} {{unit}})',
    autoBackup: {
      title: 'Đã lưu dữ liệu tháng trước',
      message:
        'Đã lưu file "{{filename}}" vào bộ nhớ của app (mở bằng ứng dụng Files).\n\nBạn có muốn xoá dữ liệu cũ hơn 35 ngày để gọn nhẹ không? Bản Excel vừa lưu vẫn được giữ.',
      keep: 'Giữ lại',
      deleteOld: 'Xoá dữ liệu cũ',
    },
  },

  // src/screens/SettingsScreen.tsx
  settings: {
    title: 'Cài đặt',
    subtitle: 'Tuỳ chỉnh theo thói quen của bạn',
    language: {
      sectionTitle: 'NGÔN NGỮ',
      sectionDesc: 'Chọn ngôn ngữ hiển thị cho toàn bộ app, kể cả file Excel xuất ra.',
      autoTranslateLabel: 'Tự dịch tên món tự chế',
      autoTranslateDesc:
        'Khi bật, món ăn bạn tự nhập sẽ được dịch nền sang 2 ngôn ngữ còn lại qua dịch vụ miễn phí MyMemory (cần mạng). Tên món đã ghi lại lịch sử không đổi. Tắt mặc định.',
    },
    bodyProfile: {
      sectionTitle: 'HỒ SƠ CƠ THỂ',
      sectionDesc: 'Dùng để tính nhu cầu năng lượng (pin Năng lượng). Chỉ tham khảo — không phải tư vấn y tế.',
    },
    health: {
      sectionTitle: 'SỨC KHOẺ',
      sectionDesc: 'Apple Health tự động theo dõi kcal đã đốt mỗi ngày — chỉ cần ghi vận động thủ công khi muốn bổ sung thêm.',
      refreshButton: '🔄 Làm mới dữ liệu Apple Health',
      syncing: 'Đang đồng bộ…',
      lastSync: 'Lần đồng bộ gần nhất: {{time}}',
      neverSynced: 'Chưa đồng bộ',
      statusSynced: '✓ Đã kết nối',
      statusEstimated: '⚠️ Ước tính — kiểm tra quyền Health trong Cài đặt máy',
      statusSyncing: 'Đang đồng bộ…',
      statusIdle: '— Chưa đồng bộ',
    },
    notifications: {
      sectionTitle: 'THÔNG BÁO',
      enableLabel: 'Bật thông báo',
      reminderDesc: 'Giờ nhắc nhở cập nhật năng lượng mỗi ngày',
      thresholdDesc: 'Nhận thông báo khi pin xuống dưới mức này',
      permissionMissingTitle: 'Thiếu quyền thông báo',
      permissionMissingMessage:
        'Hãy vào Cài đặt của điện thoại → cấp quyền thông báo cho app này, rồi bật lại.',
    },
    mealWindows: {
      sectionTitle: 'KHUNG GIỜ BỮA ĂN',
      sectionDesc: 'App tự xếp món ăn vào bữa sáng/trưa/tối theo giờ bạn ghi. Ngoài khung giờ = Bữa phụ.',
      overlapWarning: '⚠ Giờ bắt đầu phải nhỏ hơn giờ kết thúc',
    },
    data: {
      sectionTitle: 'DỮ LIỆU',
      exportWeekly: '📊 Xuất Excel 7 ngày gần nhất',
      exportMonthly: '📊 Xuất Excel 30 ngày gần nhất',
      exporting: 'Đang xuất...',
      exportError: 'Không thể xuất file. Thử lại sau.',
      cleanupButton: '🗑️ Xoá dữ liệu cũ hơn 35 ngày',
      cleanupTitle: 'Xoá dữ liệu cũ',
      cleanupMessage:
        'Dữ liệu hơn 35 ngày sẽ bị xoá VĨNH VIỄN và không thể khôi phục.\n\nHãy bấm "Xuất Excel" trước để giữ lại bản lưu. Bạn có chắc muốn xoá?',
    },
    interface: {
      sectionTitle: 'GIAO DIỆN',
      particleEffectsLabel: 'Hiệu ứng nạp pin ✨',
      particleEffectsDesc:
        'Vài đốm sáng bay vào pin mỗi khi bạn ghi món ăn thành công. Tắt nếu muốn giao diện đơn giản hơn.',
      themeSectionLabel: 'Chủ đề',
      themeDark: 'Tối',
      themeLight: 'Sáng',
    },
    disclaimer:
      '⚠️ App này chỉ để tham khảo cá nhân — không phải thiết bị y tế. Hãy gặp chuyên gia y tế trước khi thay đổi chế độ dinh dưỡng.',
  },

  // src/domain/food/nutritionDetail.ts — the read-only per-food breakdown
  // table (NutritionDetailSheet). Macro row labels that don't map 1:1 onto
  // a MicronutrientId (energy/protein/fat/carbs/water/EPA-DHA/total
  // minerals) live here; the finer micros reuse `nutrients.<id>.name`.
  domain: {
    nutritionDetail: {
      energy: 'Năng lượng',
      protein: 'Đạm',
      fat: 'Béo',
      carbs: 'Carbs',
      water: 'Nước',
      epaDha: 'EPA/DHA',
      mineralsTotal: 'Khoáng chất (tổng)',
    },
  },

  // src/screens/HomeScreen.tsx, HistoryScreen.tsx, DiaryScreen.tsx,
  // OnboardingScreen.tsx — the last migration wave.
  screens: {
    home: {
      loading: 'Đang khởi động pin...',
      subBatteriesLabel: 'Các pin nhỏ — bấm để nạp / xem nguồn ⚡',
      hint: 'Kéo xuống để làm mới • Nước/Giấc ngủ: bấm để nạp — pin khác: bấm để xem nguồn',
      recommendNoteMale: 'KN = mức khuyến nghị chung cho nam {{age}} tuổi — không phải chỉ định y tế.',
      recommendNoteFemale: 'KN = mức khuyến nghị chung cho nữ {{age}} tuổi — không phải chỉ định y tế.',
      waterRecommendation:
        'Khuyến nghị chung: ~{{minL}}–{{maxL}} L/ngày cho {{weight}} kg{{workoutExtra}}. Chỉ để tham khảo.',
      waterWorkoutExtra: ' · hôm nay có vận động: +0.5–1 L',
      sleepRecommendation:
        'Khuyến nghị chung: {{minH}}–{{maxH}} giờ/đêm cho {{age}} tuổi{{recoveryExtra}}. Chỉ để tham khảo.',
      sleepRecoveryExtra: ' · có tập hôm nay: nên ngủ gần mức cao để phục hồi',
      deleteFoodTitle: 'Xoá món đã ghi?',
      deleteFoodMessage: '“{{name}}” sẽ bị xoá và pin được hoàn lại.',
      deleteActivityTitle: 'Xoá vận động đã ghi?',
      deleteActivityMessage: 'Mục này sẽ bị xoá và pin được hoàn lại.',
      deleteIntakeTitle: 'Hoàn tác lần nạp này?',
      deleteIntakeMessage: 'Sẽ hoàn tác lần nạp {{amount}} và trừ lại pin tương ứng.',
      undoButton: 'Hoàn tác',
      // Collapsible wrapper grouping the secondary "dig deeper" blocks below
      // the at-a-glance batteries (energy balance, vi chất, supplements, and
      // the three today-log lists) — expanded by default, purely a scan-
      // ability aid, never hides data from existing users.
      detailsSectionTitle: 'Chi tiết hôm nay',
    },
    history: {
      title: 'Lịch sử 7 ngày',
      empty: 'Chưa có dữ liệu nào. Hãy nạp pin đầu tiên!',
      nutritionBadge: 'DD {{pct}}%',
      energyBadge: 'NL {{pct}}%',
      batteryShortLabels: {
        protein: 'Đạm',
        carbs: 'Carb',
        water: 'Nước',
        minerals: 'Khoáng',
        sleep: 'Ngủ',
        movement: 'Bước',
      },
    },
    diary: {
      loadingText: 'Đang tải dữ liệu...',
      title: 'Nhật ký',
      badgeSaved: '🔒 Đã bảo mật hôm nay',
      badgeNew: '📝 Nhật ký mới',
      lockLine1: 'Nhật ký được mã hoá ngay khi lưu.\nApp không thể đọc lại nội dung.',
      lockLine2Bold: 'Bảo vệ riêng tư tuyệt đối cho bạn.',
      savedTitle: 'Đã lưu & mã hoá!',
      savedSubtitle: 'Nhật ký hôm nay đã được khóa an toàn bằng mật mã riêng tư trên điện thoại.',
      writeMoreButton: '✍️ Viết thêm nội dung',
      viewHistoryButton: '📊 Xem Lịch sử pin',
      placeholder: 'Hôm nay bạn cảm thấy thế nào?',
      charCount: '{{n}} ký tự',
      saveButtonNew: '🔒 Lưu & mã hoá',
      saveButtonAppend: '🔒 Lưu nối tiếp nhật ký',
      disclaimer:
        '⚠️ Nội dung nhật ký chỉ để tự theo dõi cảm xúc cá nhân. Đây không phải tư vấn tâm lý hoặc chẩn đoán y tế.',
      saveTitle: 'Lưu nhật ký',
      saveMessageNew: 'Nhật ký sẽ được mã hoá và không thể đọc lại trong app. Bạn có chắc không?',
      saveMessageAppend:
        'Hôm nay bạn đã lưu nhật ký. Ghi thêm này sẽ tự động được nối tiếp (thêm mới) vào nhật ký của hôm nay. Bạn có chắc không?',
      saveConfirmButton: 'Lưu & mã hoá',
      appendEntry: '\n\n[Ghi thêm lúc {{time}}]:\n{{text}}',
      saveError: 'Không thể lưu nhật ký. Vui lòng thử lại.',
    },
    onboarding: {
      title: 'Chào mừng đến với\nMy Body Batteries ⚡',
      intro:
        'Theo dõi mức năng lượng nạp vào và tiêu hao mỗi ngày, giúp bạn hiểu rõ cơ thể mình hơn.',
      cardHeader: 'Hãy cho app biết một chút về bạn nhé!',
      disclaimer: 'Chỉ để tính toán năng lượng tham khảo — không phải thiết bị y tế.',
      startButton: 'Bắt đầu dùng app',
    },
  },
  components: {
    appleHealthStatusBadge: {
      labelSynced: 'Đã kết nối Apple Health',
      labelEstimated: 'Ước tính (BMR) — Apple Health không khả dụng',
      labelSyncing: 'Đang cập nhật…',
      labelIdle: 'Chưa đồng bộ',
      detailWithSync: 'Apple Health, đồng bộ {{time}}',
      detailNoSync: 'Apple Health',
    },
    batteryCell: {
      // VoiceOver/TalkBack summary for the SVG battery graphic — the drawing
      // itself carries no semantics, so this is the only thing a screen
      // reader user hears for each battery.
      a11yLabel: 'Pin {{name}}: {{percentage}} phần trăm, còn {{amount}}',
      a11yToggleUnitHint: 'Chạm để đổi đơn vị hiển thị',
    },
    microBatteryStack: {
      cellA11y: 'Xem nguồn nạp và cách tính {{name}} — hiện {{percentage}}%',
      title: 'Vi chất đã nạp',
      disclaimer: 'Chỉ để tham khảo.',
      collapsedLine: '▸ Đang thu gọn — bấm để xem {{count}} vi chất',
      collapsedWarnSuffix: ' · ⚠️ {{count}} vượt ngưỡng',
      seeMoreList: '▸ Xem thêm: {{list}}',
      hideMore: '▾ Ẩn bớt',
      limitSectionLabel: 'Nên giữ dưới mốc',
      electrolyteSectionLabel: 'Muối & điện giải',
      overThreshold: 'vượt ngưỡng gợi ý',
      withinThreshold: 'trong ngưỡng',
      overRecommended: 'vượt khuyến nghị',
      recommendedPerDay: 'KN {{target}}{{unit}}/ngày',
    },
    energyActionsBar: {
      logFoodButton: '⚡ Nạp',
      activityButton: '🔥 Xả',
      activitySheetTitle: 'Ghi vận động',
      activitySheetSubtitle: 'Chọn nhóm → môn + số phút (và/hoặc số bước chân)',
      customNameLabel: 'Tên môn',
      customNamePlaceholder: 'Ví dụ: Pickleball',
      groupLabel: 'Nhóm',
      intensityLabel: 'Cường độ',
      metPresets: {
        light: 'Nhẹ ~3 MET',
        moderate: 'Vừa ~5 MET',
        high: 'Cao ~8 MET',
        veryHigh: 'Rất cao ~10 MET',
      },
      metManualPlaceholder: 'Hoặc nhập MET trực tiếp (ví dụ: 6.5)',
      metExplainer:
        'MET = mức tiêu hao năng lượng so với lúc ngồi yên. Chọn theo cảm nhận độ nặng của môn (tối đa {{max}} — môn nặng nhất trong nghiên cứu cũng chỉ quanh mức này).',
      saveActivityButton: 'Lưu môn',
      powerliftingChip: '🏋️ Powerlifting (set × rep × tạ)',
      bodybuildingChip: '💪 Bodybuilding (theo nhóm cơ)',      addActivityChip: '＋ Thêm môn',
      minutesPlaceholder: 'Số phút tập (ví dụ: 45)',
      stepsPlaceholder: 'Số bước chân (tuỳ chọn)',
      timeRangeSubtitle: 'Khoảng thời gian diễn ra (tuỳ chọn, để trống = bây giờ)',
      fromTimePlaceholder: 'Từ HH:mm',
      toTimePlaceholder: 'Đến HH:mm',
      logActivityButton: 'Ghi 🔥',
      deleteCustomTitle: 'Xoá môn tự thêm?',
      deleteCustomMessage: 'Xoá "{{name}}" khỏi danh sách môn tự thêm?',
      logDateFieldLabel: 'Ngày ghi',
      backfillNotice: '🕓 Ghi cho ngày {{date}}',
    },
    microBatterySourceSheet: {
      title: 'Nguồn nạp {{name}}',
      dateCaption: 'Ngày: {{date}}',
      emptyText: 'Chưa có món nào đóng góp {{name}} trong ngày này — hãy ghi món ăn ở trên.',
      totalText: 'Tổng: {{value}}{{unit}} / KN {{target}}{{unit}}',
      footerNote: 'Vi chất này được tính tự động từ các món ăn đã ghi — không cần nạp tay.',
      rowEntryCountSuffix: ' · ghi {{count}} lần',
      explainToggleShow: '🧮 Xem cách tính con số này',
      explainToggleHide: '🧮 Ẩn cách tính',
      formulaIntro:
        'Không có con số nào nhập tay. Mỗi món đóng góp = (giá trị ghi trên nhãn cho 100 đơn vị) × (lượng bạn đã ăn) ÷ 100:',
      formulaRow: '{{per100}}{{unit}}/100{{measure}} × {{amount}}{{measure}} ÷ 100 = {{result}}{{unit}}',
      formulaSum: 'Cộng dồn cả ngày: {{parts}} = {{total}}{{unit}}',
      formulaSingle: 'Cả ngày chỉ có 1 món đóng góp → tổng = {{total}}{{unit}}',
      formulaTargetGoal: 'So với khuyến nghị {{target}}{{unit}}/ngày → {{percentage}}%',
      formulaTargetLimit: 'So với ngưỡng nên ở dưới {{target}}{{unit}}/ngày → {{percentage}}%',
      derivationSalt:
        'Muối không phải một ô nhập riêng — app suy ra từ natri: natri (mg) × 2.5 ÷ 1000 = muối (g). Nên chỉ cần nhập natri là pin Muối tự chạy.',
      derivationOmega3: 'Omega-3 = EPA + DHA cộng lại. Món nào không khai báo EPA/DHA thì không đóng góp.',
      derivationSugar:
        'Đường nằm TRONG tổng Carbs, không cộng thêm vào Carbs. Nhập đường chỉ để theo dõi riêng phần đường.',
      dayScopeNote:
        'Pin vi chất tính theo NGÀY LỊCH (0h–24h). Khác pin Năng lượng: pin đó reset lúc 6h sáng, nên bữa ăn lúc 2h đêm vẫn tính cho ngày hôm trước.',
      liveNote:
        'Số này được tính lại từ nhật ký món ăn mỗi lần mở app — sửa hoặc xoá một món là tổng đổi theo ngay, không có bản lưu riêng nào để lệch.',
      sumNote: 'Cộng các dòng trên ra đúng tổng bên dưới.',
    },
    batterySourceSheet: {
      explainToggleShow: '🧮 Xem cách tính con số này',
      explainToggleHide: '🧮 Ẩn cách tính',
      explainFood:
        'Mỗi món lúc ghi đã được tính sẵn: (giá trị trên 100 đơn vị của món) × (lượng bạn đã ăn) ÷ 100. Pin này = cộng tất cả các dòng ở trên.',
      explainSnapshot:
        'Số của từng dòng được CHỐT tại thời điểm ghi món. Nếu sau này bạn sửa thành phần của món đó, các bữa đã ghi vẫn giữ số cũ — lịch sử không bị viết lại. Khác với pin vi chất: pin vi chất tính lại từ nhật ký mỗi lần mở app, nên sửa món là đổi ngay.',
      explainMinerals:
        'Pin Khoáng chất là tổng gộp THÔ của 6 khoáng: canxi + sắt + natri + kali + magiê + kẽm. Muốn xem từng khoáng riêng thì dùng các pin vi chất bên dưới.',
      explainMovement:
        'Pin Vận động = số bước đi + phần bước quy đổi từ buổi tập (mỗi buổi tập được quy ra “tương đương bao nhiêu bước” dựa trên cường độ).',
      explainDecayNote:
        '“Tổng hôm nay” ở trên là toàn bộ những gì bạn đã ghi trong ngày. Mức pin ngoài màn hình chính có thể thấp hơn vì pin xả dần theo giờ.',
      title: 'Nguồn nạp {{name}} hôm nay',
      mineralsCaption:
        'Tổng khoáng ước tính (canxi + sắt + natri + kali + magiê + kẽm) từ món đã ghi.',
      emptyText: 'Chưa có nguồn nào hôm nay — hãy ghi món ăn hoặc vận động.',
      quickChargeLabel: 'Nạp nhanh',
      quickChargeLabelWithNote: 'Nạp nhanh ({{note}})',
      walkingFallback: 'Đi bộ/bước chân',
      stepsKcalValue: '{{steps}} bước · {{kcal}} kcal',
      totalText: 'Tổng hôm nay: {{value}}{{unit}}',
      footerNote: 'Pin này tự nạp khi bạn ghi món ăn / vận động ở trên — không cần nạp tay.',
    },
    todayActivities: {
      sectionLabel: 'Hôm nay đã vận động',
      emptyText: 'Chưa có vận động nào được ghi hôm nay. Bấm "🔥 Xả" để bắt đầu.',
      fromTimePrefix: 'từ {{time}}',
      minutesSuffix: '{{minutes}}p',
      stepsSuffix: '{{steps}} bước',
      fallbackLabel: 'Vận động',
      editTitle: 'Sửa vận động',
      minutesPlaceholder: 'Số phút tập (ví dụ: 45)',
      stepsPlaceholder: 'Số bước chân (tuỳ chọn)',
      fromTimePlaceholder: 'Từ HH:mm',
      toTimePlaceholder: 'Đến HH:mm',
    },
    foodLogModal: {
      backToSearch: '‹ Quay lại',
      addCustomTitle: 'Thêm món mới',
      addCustomSubtitle: 'Nhập dinh dưỡng tính cho mỗi {{basis}}',
      saveCustomFoodButton: 'Lưu món',
      title: 'Ghi món ăn',
      searchSubtitle: 'Tìm món trong danh sách rồi chọn',
      searchPlaceholder: 'Tìm món (ví dụ: cơm, gà, cá...)',
      suggestLabel: 'Gợi ý cho bữa này',
      emptyResults: 'Không tìm thấy món nào.',
      addNewFoodButton: "➕ Thêm món mới: '{{query}}'",
      backToOtherFood: '‹ Chọn món khác',
      editNutritionLink: '✎ Sửa thành phần',
      sourceBadgeMine: 'Của tôi',
      sourceBadgeCatalog: 'Catalog VN',
      sourceBadgeUsda: 'USDA',
      sourceBadgeEdited: 'đã sửa',
      resultEnergyMeta: '{{kcal}} kcal/100{{measure}}',
      portionCountLabel: 'Số {{unit}}',
      portionDefinitionNote: '{{definition}} — dinh dưỡng bên dưới tính cho lượng bạn chọn.',
      portionCountPlaceholder: 'Ví dụ: 1',
      gramsFieldLabel: 'Lượng nạp ({{measure}})',
      gramsPlaceholder: 'Ví dụ: 150',
      defaultChipLabel: 'mặc định={{amount}}',
      mealTimeFieldLabel: 'Giờ ăn → {{meal}}',
      logDateFieldLabel: 'Ngày ghi',
      previewKcalLabel: '⚡ {{kcal}} kcal',
      previewMacroLabel: 'P {{p}}g · C {{c}}g · F {{f}}g',
      backfillNotice: '🕓 Ghi cho ngày {{date}}',
      confirmButton: 'Ghi món 🍽️',
    },
    customFoodFields: {
      nameLabel: 'Tên món',
      namePlaceholder: 'Ví dụ: Canh chua cá lóc',
      categoryLabel: 'Nhóm',
      categoryPlaceholder: 'dish, snack, supplement...',
      measureUnitLabel: 'Đơn vị đo',
      measureNoteMl:
        'Chọn ml cho món dạng lỏng. App vẫn tính theo gram bên trong, quy đổi 1 ml ≈ 1 g.',
      portionUnitLabel: 'Ghi món này theo',
      unitOptionGram: 'Theo {{measure}}',
      unitOptionPack: 'Gói',
      unitOptionCapsule: 'Viên',
      unitOptionServing: 'Khẩu phần…',
      servingLabelLabel: 'Gọi 1 khẩu phần là gì?',
      servingLabelPlaceholder: 'hộp, chai, lon, ly, khẩu phần...',
      servingLabelHint:
        'Ví dụ hộp Yakult 65ml: gõ “hộp”, chọn đơn vị đo ml, rồi nhập kích cỡ 65 và nhập dinh dưỡng cho đúng 1 hộp.',
      servingSizeLabel: 'Kích cỡ 1 {{unit}} ({{measure}})',
      servingWeightPlaceholder: 'Ví dụ: 65',
      defaultServingLabel: 'Khẩu phần mặc định ({{measure}})',
      defaultServingPlaceholder: '100',
      macroKcal: 'Kcal',
      macroProtein: 'Đạm (g)',
      macroFat: 'Béo (g)',
      carbsLabel: 'Carbs (Carbohydrate) {{suffix}}',
      nutritionSuffix: '/ {{basis}}',
      carbBreakdownNote:
        'Đường và chất xơ đã nằm TRONG Carbs — nhập để theo dõi chi tiết, không cộng thêm.',
      sugarLabel: 'Đường (g) {{suffix}}',
      fiberLabel: 'Chất xơ (g) {{suffix}}',
      waterLabel: 'Nước (ml) {{suffix}}',
      showMicrosToggle: '▸ Thêm vi chất',
      hideMicrosToggle: '▾ Ẩn vi chất',
      microsHint: 'Bỏ trống vi chất → món này không đóng góp vào các pin vi chất.',
      microCalcium: 'Canxi (mg)',
      microIron: 'Sắt (mg)',
      microZinc: 'Kẽm (mg)',
      microEpa: 'EPA (mg)',
      microDha: 'DHA (mg)',
      electrolyteSectionLabel: 'Muối & điện giải',
      electrolyteSodium: 'Natri (mg)',
      electrolytePotassium: 'Kali (mg)',
      electrolyteMagnesium: 'Magie (mg)',
      saltDerivedLabel: '≈ {{grams}} g muối (NaCl) — quy đổi từ natri',
    },
    pastDateField: {
      errorFutureDate: 'Không thể chọn ngày tương lai',
      errorTooOld: 'Chỉ có thể ghi lùi tối đa {{max}} ngày',
    },
    nutritionDetailSheet: {
    },
    foodNutritionEditModal: {
      titleEdit: 'Sửa thành phần',
      titleAdd: 'Thêm món mới',
      subtitleEdit: 'Chỉ để tham khảo — giá trị bạn sửa sẽ được ưu tiên hiển thị.',
      subtitleAdd: 'Nhập dinh dưỡng tính cho mỗi {{basis}}.',
      saveEditButton: 'Lưu sửa',
      saveAddButton: 'Lưu món',
    },
    dayDetailSheet: {
      deleteConfirmTitle: 'Xoá món ăn',
      deleteConfirmMessage: 'Bạn chắc chắn muốn xoá "{{name}}"?',
      summaryLabel: 'Tổng: {{kcal}} kcal · Đạm {{protein}}g',
      burnedLabel: 'Đã đốt: {{kcal}} kcal',
      sleepLabel: 'Ngủ: {{hours}} giờ',
      waterLabel: 'Nước: {{amount}}',
      weightLabel: 'Cân nặng: {{weight}} kg',
      emptyText: 'Chưa ghi món nào cho ngày này',
      addButtonLabel: '＋ Thêm món cho ngày này',
    },
    shareDayFoodCard: {
      tagline: 'Theo dõi năng lượng & dinh dưỡng mỗi ngày',
    },
    todayMeals: {
      countFieldLabel: 'Số {{unit}}',
      sectionLabel: 'Hôm nay đã ăn',
      emptyText: 'Chưa có món nào được ghi hôm nay. Bấm “⚡ Nạp” để bắt đầu.',
      macroLine: 'Đạm {{protein}}g · Carbs {{carb}}g · Béo {{fat}}g',
      editModalTitle: 'Sửa món ăn',
      gramsFieldLabel: 'Lượng nạp ({{measure}})',
      shareButtonA11y: 'Chia sẻ nhật ký ăn uống hôm nay dưới dạng ảnh',
      shareDialogTitle: 'Chia sẻ nhật ký ăn uống',
      shareErrorMessage: 'Không tạo được ảnh chia sẻ. Thử lại nhé.',
    },
    todayIntakes: {
      sectionLabel: 'Nạp nhanh hôm nay',
      emptyText: 'Chưa có nạp nhanh nào hôm nay.',
    },
    intakeModal: {
      titleLabel: 'Nạp {{name}}',
      subtitleLabel: 'Nhập lượng bạn đã nạp ({{unit}})',
      amountPlaceholder: 'Ví dụ: 30',
      notePlaceholder: 'Ghi chú (tuỳ chọn)',
      confirmButton: 'Nạp ⚡',
    },
    supplementQuickLog: {
      title: '💊 Thực phẩm chức năng — bấm để nạp 1 liều',
      loggedCountLabel: 'hôm nay ×{{count}}',
      notLoggedLabel: 'chưa nạp hôm nay',
      addSupplementLabel: '➕ Thêm\nTPCN',
      hintText:
        'Mỗi lần bấm = 1 liều mặc định (VD: 1 viên dầu cá 1220mg = 600mg EPA + 400mg DHA). Liều nạp cộng thẳng vào pin vi chất ở trên — pin vượt 100% nghĩa là đã quá mức khuyến nghị. Bấm nhầm thì xoá trong danh sách bữa ăn bên dưới.',
    },
    bodyProfileCard: {
      explainer:
        'Đây là lượng năng lượng tối thiểu cơ thể bạn cần mỗi ngày để duy trì sự sống (thở, tim đập, tiêu hoá...) — chưa tính vận động. Công thức tính dựa trên đúng 4 số liệu dưới đây của BẠN, nên áp dụng đúng cho bất kỳ ai nhập đúng số của mình.',
      weightLabel: 'Cân nặng (kg, {{min}}-{{max}})',
      heightLabel: 'Chiều cao (cm, {{min}}-{{max}})',
      ageLabel: 'Tuổi ({{min}}-{{max}})',
      stepsLabel:
        'Số bước trung bình/ngày (0-{{max}} — tạm thời ước tính, sẽ cập nhật từ dữ liệu thật sau)',
      sexSectionLabel: 'Giới tính',
      sexMale: 'Nam',
      sexFemale: 'Nữ',
      occupationSectionLabel: 'Mức vận động công việc/lối sống',
      occupationSedentary: 'Ít vận động',
      occupationLight: 'Vừa',
      occupationActive: 'Nhiều',
      tdeeLabel: 'Nhu cầu năng lượng ước tính:',
      kcalPerDayValue: '{{value}} kcal/ngày ⓘ',
      tdeeInfoA11y: 'Xem cách tính nhu cầu năng lượng',
      goalSectionLabel: 'Mục tiêu cân nặng (không bắt buộc)',
      goalWeightLabel: 'Cân nặng mong muốn (kg, {{min}}-{{max}})',
      goalWeeksLabel:
        'Trong bao lâu (tuần, {{min}}-{{max}} — để trống = tốc độ an toàn nhất)',
      goalCalorieLabel: 'Mục tiêu calo/ngày:',
      kcalValue: '{{value}} kcal ⓘ',
      goalInfoA11y: 'Xem cách tính mục tiêu calo mỗi ngày',
      clampedNote: 'Để an toàn, app đề xuất mức vừa phải hơn thay vì tốc độ bạn nhập.',
      medicalDisclaimer: 'Chỉ để tham khảo, không thay thế tư vấn y tế.',
      savedText: '✅ Đã lưu hồ sơ.',
      saveButton: 'Lưu hồ sơ',
      tdeeBreakdown: {
        title: '🧮 Cách tính nhu cầu năng lượng',
        intro: 'Tính từ đúng số liệu bạn đang nhập ở form (chưa cần bấm Lưu):',
        bmrLabel: '1. Trao đổi chất cơ bản (BMR) — công thức Mifflin-St Jeor',
        bmrFormulaMale: '10 × {{weight}} kg + 6.25 × {{height}} cm − 5 × {{age}} tuổi + 5 (nam)',
        bmrFormulaFemale: '10 × {{weight}} kg + 6.25 × {{height}} cm − 5 × {{age}} tuổi − 161 (nữ)',
        occupationLabel: '2. Nhân hệ số vận động công việc/lối sống',
        occupationFormula: '{{bmr}} kcal × {{factor}} ({{occupation}})',
        stepsLabel: '3. Cộng năng lượng của bước chân trung bình mỗi ngày',
        stepsFormula: '{{steps}} bước × {{rate}} kcal/bước/kg × {{weight}} kg',
        stepsResult: '≈ +{{value}} kcal/ngày',
        resultPerDay: '≈ {{value}} kcal/ngày',
        totalLabel: 'Nhu cầu năng lượng ước tính',
        totalValue: '{{value}} kcal/ngày',
        closeButton: 'Đóng',
      },
      goalBreakdown: {
        title: '🎯 Cách tính mục tiêu calo/ngày',
        maintenanceLabel: '1. Mức duy trì cân nặng hiện tại',
        maintenanceValue: '{{value}} kcal/ngày — chính là nhu cầu năng lượng ước tính ở trên',
        deltaLoseLabel: '2. Muốn giảm {{delta}} kg mỡ',
        deltaGainLabel: '2. Muốn tăng {{delta}} kg',
        deltaFormula: '{{delta}} kg × {{kcalPerKg}} kcal/kg ≈ {{total}} kcal',
        paceWeeksLabel: '3. Chia đều cho {{weeks}} tuần ({{days}} ngày)',
        paceWeeksFormula: '{{total}} kcal ÷ {{days}} ngày ≈ {{perDay}} kcal/ngày',
        paceNoWeeksLabel: '3. Không nhập thời gian',
        paceNoWeeksValue: '→ app dùng tốc độ an toàn tối đa',
        safetyLabel: '4. Chặn an toàn: tối đa {{pct}}% mức duy trì và không quá {{maxAbs}} kcal/ngày',
        safetyValue: '→ áp dụng {{applied}} kcal/ngày (trần an toàn: {{cap}})',
        totalLoseFormula: '{{maintenance}} − {{applied}}',
        totalGainFormula: '{{maintenance}} + {{applied}}',
        totalLabel: 'Mục tiêu calo mỗi ngày',
        totalValue: '≈ {{value}} kcal/ngày',
        noDeltaNote: 'Chênh lệch mỗi ngày ≈ 0 kcal → mục tiêu bằng đúng mức duy trì.',
        bmrFloorNote:
          'Mục tiêu không bao giờ đặt thấp hơn BMR ({{bmr}} kcal/ngày) — mức tối thiểu để cơ thể hoạt động an toàn.',
        closeButton: 'Đóng',
      },
    },
    powerliftingSheet: {
      titleNew: '🏋️ Powerlifting',
      titleEditSuffix: ' — sửa buổi tập',
      subtitle:
        'Ghi theo set × rep × tạ — kcal tính từ khối lượng nâng thật, không cần bấm giờ.',
      prevSessionLine: 'Buổi trước ({{date}}): {{summary}}',
      prevSessionE1rmSuffix: ' · e1RM ~{{value}}kg',
      noPrevSession: 'Chưa có buổi {{exercise}} nào trong {{days}} ngày qua.',
      warmupSectionTitle: 'Khởi động (tạ lên dần)',
      workingSectionTitle: 'Bài chính',
      useTemplateButton: '📋 Dùng làm mẫu',
      suggestWarmupButton: '⚡ Gợi ý từ mức tạ chính',
      emptyWarmup: 'Chưa có set khởi động.',
      emptyWorking: 'Chưa có set chính.',
      weightPlaceholder: 'kg',
      weightUnitLabel: 'kg ×',
      repsPlaceholder: 'rep',
      repsUnitLabel: 'rep',
      addSetButton: '＋ Thêm set',
      e1rmToday: 'e1RM hôm nay ({{exercise}}): ~{{value}}kg',
      previewSummary: 'Ước tính cả buổi: 🔥 ~{{kcal}} kcal · ~{{minutes}} phút',
      previewEmpty: 'Nhập ít nhất một set (kg × rep) để tính kcal.',
      confirmNewButton: 'Ghi buổi tập 🏋️',
      warmupSetsOnly: '{{count}} set khởi động',
      setsTonnage: '{{count}} set · {{tonnage}}kg',
      plusWarmups: '{{main}} (+{{count}} khởi động)',
    },
    bodybuildingSheet: {
      titleNew: '💪 Bodybuilding',
      titleEditSuffix: ' — sửa buổi tập',
      subtitle:
        'Chọn nhóm cơ → bài tập → nhập set/rep/tạ. kcal ước tính theo cường độ & số rep, không theo mức tạ.',
      muscleSectionTitle: 'Chọn nhóm cơ',
      addExerciseHint: 'Bấm một bài để thêm vào buổi tập',
      noExercisesInMuscle: 'Nhóm này chưa có bài nào — bấm "＋ Tự thêm bài" bên dưới.',
      selectedSectionTitle: 'Bài đã thêm',
      noExercisesYet: 'Chưa thêm bài nào. Chọn nhóm cơ ở trên rồi bấm một bài.',
      intensityLabel: 'Cường độ',
      weightPlaceholder: 'kg',
      weightUnitLabel: 'kg ×',
      repsPlaceholder: 'rep',
      repsUnitLabel: 'rep',
      addSetButton: '＋ Thêm set',
      addCustomExerciseButton: '＋ Tự thêm bài',
      customExerciseNameLabel: 'Tên bài',
      customExerciseNamePlaceholder: 'Ví dụ: Cuốn tay dây kháng lực',
      customExerciseMuscleLabel: 'Nhóm cơ',
      customExerciseTierLabel: 'Độ nặng bài tập',
      saveExerciseButton: 'Lưu bài',
      deleteCustomExerciseTitle: 'Xoá bài tự thêm?',
      deleteCustomExerciseMessage: 'Xoá "{{name}}" khỏi danh sách bài tự thêm?',
      previewSummary: 'Ước tính cả buổi: 🔥 ~{{kcal}} kcal · ~{{minutes}} phút',
      previewEmpty: 'Thêm ít nhất một bài có set (kg × rep) để tính kcal.',
      confirmNewButton: 'Ghi buổi tập 💪',
    },
    masterBattery: {
      label: 'Năng lượng cơ thể',
      ledgerLine: 'Sổ calo hôm nay: {{eaten}} / {{goal}} kcal',
      overAmount: 'Ăn dư {{amount}} kcal',
      activityBonusLine: '🏃 Vận động hôm nay: +{{amount}} kcal vào mục tiêu ăn',
      disclaimer: '* Chỉ để tham khảo.',
      goalLine: 'Mục tiêu: {{direction}} {{weight}} kg (an toàn)',
      directionDown: 'giảm về',
      directionUp: 'tăng lên',
      targetLineWithGoal: 'Cần ~{{target}} kcal/ngày để đạt {{weight}} kg · BMR ~{{bmr}}',
      targetLineMaintain: 'Duy trì cân nặng: ~{{maintenance}} kcal/ngày · BMR ~{{bmr}}',
      // VoiceOver/TalkBack summary for the SVG graphic only — the Text
      // elements below it (ledger/goal/disclaimer) are already read normally.
      a11yLabel: 'Biểu đồ pin năng lượng: {{percentage}} phần trăm',
    },
    bodyRecommendations: {
      title: 'Khuyến nghị hàng ngày',
      sectionCalorieWeight: '🎯 Calo & cân nặng khuyến nghị',
      sectionProteinCarbs: '🥩🍚 Đạm & tinh bột',
      sectionLimits: '⚠️ Giới hạn',
      sectionWater: '💧 Nước',
      sectionActivity: '🏃 Vận động',
      sectionSleep: '😴 Giấc ngủ',
      calorieLabel: 'Calo mục tiêu hôm nay',
      calorieValue: '{{value}} kcal',
      healthyWeightLabel: 'Cân nặng khoẻ mạnh (theo chiều cao)',
      healthyWeightValue: '{{min}} – {{max}} kg',
      healthyWeightBelow: 'Cân nặng hiện tại của bạn đang dưới mức này.',
      healthyWeightWithin: 'Cân nặng hiện tại của bạn đang trong mức này.',
      healthyWeightAbove: 'Cân nặng hiện tại của bạn đang trên mức này.',
      goalWeightNote: 'Mục tiêu hiện tại của bạn: {{weight}} kg',
      proteinLabel: 'Đạm (protein)',
      proteinValue: '{{min}} – {{max}} g/ngày',
      carbsLabel: 'Tinh bột (carbs)',
      carbsValue: '{{min}} – {{max}} g/ngày',
      sugarLabel: 'Đường tự do',
      sugarValue: 'Dưới {{limit}} g/ngày (tốt hơn: dưới {{stricter}} g)',
      saltLabel: 'Muối',
      saltValue: 'Dưới {{limit}} g/ngày',
      waterLabel: 'Nước uống',
      waterValue: '{{minMl}}–{{maxMl}} ml/ngày (~{{minLiters}}–{{maxLiters}} lít)',
      activityLabel: 'Vận động',
      activityValue: '{{minWeek}} – {{maxWeek}} phút/tuần (~{{minDay}} – {{maxDay}} phút/ngày)',
      activityNote: 'Kèm ít nhất 2 buổi tập kháng lực (tạ) mỗi tuần.',
      sleepLabel: 'Giấc ngủ',
      sleepValue: '{{min}} – {{max}} giờ/đêm',
      sourceMifflin: 'Công thức Mifflin-St Jeor (BMR)',
      sourceWhoBmi: 'Theo phân loại BMI của WHO',
      sourceIomProtein: 'Theo IOM/NASEM DRI; WHO',
      sourceIomCarbs: 'Theo IOM (AMDR)',
      sourceWhoSugar: 'Theo WHO 2015',
      sourceWhoSalt: 'Theo WHO',
      sourceEfsaWater: 'Theo EFSA 2010',
      sourceWhoActivity: 'Theo WHO 2020',
      sourceSleep: 'Theo National Sleep Foundation / AASM',
    },
    energyBalanceCard: {
      sectionLabel: 'Cân bằng năng lượng',
      burnedTodayLabel: 'Đã đốt hôm nay',
      eatenTodayLabel: 'Đã ăn hôm nay',
      balanceLabel: 'Chênh lệch',
      balanceSurplusLine: '+{{amount}} kcal (dư)',
      balanceDeficitLine: '{{amount}} kcal (thiếu)',
    },
    weightLogCard: {
      title: 'Cân nặng theo thời gian',
      subtitle:
        'Ghi nhận tự nguyện, không bắt buộc — chỉ để xem xu hướng theo thời gian, không đánh giá.',
      weightPlaceholder: 'Ví dụ: 65',
      logButton: 'Ghi nhận hôm nay',
      emptyText: 'Chưa ghi cân nặng nào.',
      editModalTitle: 'Sửa cân nặng',
    },
    trendChart: {
      emptyText: 'Chưa đủ dữ liệu để vẽ biểu đồ',
      nutrientLegend: 'Dinh dưỡng',
    },
  },

  // S-PL Block Builder wizard (BlockBuilderWizard.tsx) — see
  // docs/08-powerlifting-engine.md for the science behind every step.
  blockBuilder: {
    title: 'Xây dựng Block Powerlifting',
    stepLength: 'Độ dài Block',
    stepProfile: 'Cân nặng & 1RM',
    stepFocus: 'Phong cách tính toán',
    stepSchedule: 'Lịch tuần',
    stepDeficit: 'Mục tiêu giảm cân',
    stepSummary: 'Xác nhận',
    usePrevBlockButton: '📋 Dùng cấu hình block trước (cân nặng, 1RM, lịch tuần)',
    weekStartDateLabel: 'Tuần bắt đầu (Thứ 2)',
    weekStartThisWeek: 'Tuần này ({{date}})',
    useSuggestedTemplateButton: '💡 Dùng mẫu gợi ý (T2/T4/T6/CN)',
    summaryStartDateLine: 'Bắt đầu: Thứ 2, {{date}}',
    progressiveWeeksLabel: 'Số tuần tịnh tiến',
    hasDeloadLabel: 'Có tuần deload sau cùng',
    bodyWeightLabel: 'Cân nặng hiện tại (kg)',
    oneRmSectionTitle: '1RM gần nhất (bỏ trống nếu chưa rõ)',
    oneRmSquatLabel: 'Squat (kg)',
    oneRmBenchLabel: 'Bench Press (kg)',
    oneRmDeadliftLabel: 'Deadlift (kg)',
    beginnerEstimateNote: 'Chưa có số — dùng tạm ước lượng an toàn: {{value}}kg',
    focusVolumeLabel: 'Volume',
    focusVolumeDescription: 'Tích luỹ khối lượng, tạ vừa, nhiều rep',
    focusIntensityLabel: 'Intensity',
    focusIntensityDescription: 'Sức mạnh, tạ nặng dần, ít rep',
    focusNormalLabel: 'Normal',
    focusNormalDescription: 'Cân bằng, luân phiên nặng/vừa/nhẹ trong tuần',
    focusPeakingLabel: 'Peaking',
    focusPeakingDescription: 'Chuẩn bị thi đấu, tạ rất nặng, volume rất thấp',
    scheduleEmptyText: 'Chưa có buổi tập nào — bấm "+ Thêm buổi tập" để bắt đầu.',
    scheduleAddDayButton: '+ Thêm buổi tập',
    scheduleDayLabel: 'Ngày trong tuần',
    scheduleRemoveDayButton: 'Xoá buổi',
    scheduleVariationSectionTitle: 'Bài chính/phụ (tự tính tải theo %1RM)',
    scheduleAddVariationButton: '+ Thêm bài',
    scheduleExerciseLabel: 'Bài tập',
    scheduleVariationLabel: 'Kiểu kỹ thuật',
    scheduleRoleLabel: 'Vai trò',
    scheduleRoleMain: 'Bài chính',
    scheduleRoleSecondary: 'Bài phụ',
    scheduleRemoveVariationButton: 'Xoá bài',
    scheduleAccessorySectionTitle: 'Bài phụ trợ (không tự tính tải)',
    scheduleAddAccessoryButton: '+ Thêm accessory',
    accessoryNamePlaceholder: 'Tên bài (VD: Kéo xô)',
    accessorySetsPlaceholder: 'Số set',
    accessoryRepsPlaceholder: 'Số rep',
    scheduleRemoveAccessoryButton: 'Xoá',
    deficitAutoOnNote: 'Bạn đang đặt mục tiêu giảm cân trong hồ sơ — Deficit Mode sẽ tự bật.',
    deficitToggleLabel: 'Bật Deficit Mode',
    deficitExplanation:
      'Giữ nguyên %1RM bài chính, giảm 15-20% set accessories, khuyến nghị đạm 1.6-2.4g/kg thể trọng.',
    deficitNoGoalNote:
      'Chưa đặt mục tiêu giảm cân trong hồ sơ — vào Cài đặt để đặt cân nặng mục tiêu nếu muốn dùng Deficit Mode.',
    summaryWeeksLine: '{{weeks}} tuần tịnh tiến{{deload}}',
    summaryDeloadSuffix: ' + 1 tuần deload',
    summaryFocusLine: 'Phong cách: {{focus}}',
    summaryDayCountLine: '{{count}} buổi tập/tuần',
    summaryDeficitOnLine: 'Deficit Mode: BẬT',
    summaryDeficitOffLine: 'Deficit Mode: TẮT',
    createButton: 'Tạo Block',
    nextButton: 'Tiếp theo',
    backButton: 'Quay lại',
    validationNeedDay: 'Cần ít nhất 1 buổi tập trong lịch tuần.',
    validationNeedVariation: 'Mỗi buổi tập cần ít nhất 1 bài chính/phụ.',
  },

  // S-PL Block technique-variation library display copy — keyed by
  // PowerliftingVariation['id'] (src/lib/powerliftingVariations.ts). Each
  // entry's `rationale` is what the Plan Appendix's "ⓘ" info affordance
  // shows — see docs/08-powerlifting-engine.md §7.
  blockVariations: {
    squat_standard: {
      label: 'Squat tiêu chuẩn',
      rationale:
        'Kỹ thuật squat thi đấu bình thường — dùng làm mốc 1RM gốc cho các biến thể khác.',
    },
    squat_paused: {
      label: 'Squat có dừng (Paused Squat)',
      rationale:
        'Dừng 1-2s ở đáy trước khi đứng lên, loại bỏ phản xạ giãn-co (stretch reflex) để luyện phát lực từ điểm chết — thường nhẹ hơn squat thường khoảng 10%.',
    },
    bench_touch_and_go: {
      label: 'Bench chạm ngực-đẩy liên tục (Touch-and-go)',
      rationale:
        'Chạm ngực rồi đẩy lên ngay, tận dụng hiệu ứng giãn-co cơ (stretch-shortening cycle) — đây là kỹ thuật thi đấu chuẩn, dùng làm mốc 1RM gốc cho bench.',
    },
    bench_paused: {
      label: 'Bench có dừng 1s trên ngực (Paused Bench)',
      rationale:
        'Dừng tạ hẳn trên ngực khoảng 1s trước khi đẩy, loại bỏ hoàn toàn hiệu ứng giãn-co — luyện phát lực từ điểm chết đúng luật thi đấu, thường nhẹ hơn touch-and-go khoảng 10%.',
    },
    bench_low_grip: {
      label: 'Bench tay hẹp (Low/Close Grip)',
      rationale:
        'Grip hẹp hơn vai chuyển tải sang tay sau (triceps) nhiều hơn ngực/lưng, làm giảm mức tạ nâng được so với grip thi đấu.',
    },
    bench_incline: {
      label: 'Bench trên ghế dốc (Incline Bench)',
      rationale:
        'Góc ghế dốc giảm sự tham gia của cơ ngực lớn so với bench phẳng, làm giảm mức tạ nâng được.',
    },
    deadlift_standard: {
      label: 'Deadlift tiêu chuẩn',
      rationale:
        'Kỹ thuật deadlift thi đấu bình thường — dùng làm mốc 1RM gốc cho các biến thể khác.',
    },
    deadlift_paused: {
      label: 'Deadlift có dừng (Paused Deadlift)',
      rationale:
        'Dừng 1-2s ngang gối trước khi kéo tiếp, loại bỏ phản xạ giãn-co khi rời sàn — thường nhẹ hơn deadlift thường khoảng 10%.',
    },
    deadlift_deficit: {
      label: 'Deadlift đứng bục (Deficit Deadlift)',
      rationale:
        'Đứng trên bục thấp làm tăng quãng đường kéo tạ từ sàn, khiến mức tạ nâng được giảm so với deadlift thường.',
    },
  },

  // Plan Appendix output screen (PlanAppendixSheet.tsx) — week/day/set
  // breakdown + transparent kcal math, see docs/08-powerlifting-engine.md §7.
  planAppendix: {
    title: 'Phụ lục Kế hoạch',
    weekLabel: 'Tuần {{number}}',
    deloadBadge: 'Deload',
    variationSetsLine: '{{sets}} set × {{reps}} rep @ {{weight}}kg (~{{pct}}% 1RM)',
    kcalLine: '~{{kcal}} kcal',
    epocNote:
      'Kcal hiển thị là trong-buổi (mô hình vật lý set×rep×tạ). Cơ thể tiếp tục đốt thêm ước tính 6-15% trong 24-48h sau đó (EPOC).',
    dayTotalLabel: 'Tổng buổi: ~{{kcal}} kcal',
    weekTotalLabel: 'Tổng tuần: ~{{kcal}} kcal',
    weeklyDeficitTargetLabel: 'Mục tiêu thâm hụt tuần: ~{{kcal}} kcal',
    beginnerEstimateBadge: '1RM ước lượng',
    accessoriesSectionTitle: 'Bài phụ trợ',
    accessoryLine: '{{name}}: {{sets}} set × {{reps}}',
    noAccessories: 'Không có bài phụ trợ hôm nay.',
    proteinRecommendationNote: 'Khuyến nghị đạm khi Deficit Mode bật: 1.6-2.4g/kg thể trọng/ngày.',
    infoToggleShow: 'Xem giải thích khoa học',
    infoToggleHide: 'Ẩn giải thích',
    emptyState: 'Chưa có block nào — hãy tạo một block mới.',
    createBlockButton: 'Tạo Block mới',
    exportExcelButton: '📄 Xuất Excel (để in)',
    exportError: 'Không thể xuất file. Thử lại sau.',
    dateRangeSuffix: '{{start}} - {{end}}',
    deleteBlockButton: 'Xoá block này',
    deleteConfirmTitle: 'Xoá block này?',
    deleteConfirmMessage: 'Kế hoạch sẽ bị xoá vĩnh viễn, không ảnh hưởng tới nhật ký đã ghi.',
  },
};
