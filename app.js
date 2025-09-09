// API Service for backend communication
class ApiService {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Subjects API
  async getSubjects() {
    return await this.request('/api/subjects');
  }

  async createSubject(subject) {
    return await this.request('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(subject)
    });
  }

  // Study Sessions API
  async getStudySessions(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.request(`/api/study-sessions?${params}`);
  }

  async createStudySession(session) {
    return await this.request('/api/study-sessions', {
      method: 'POST',
      body: JSON.stringify(session)
    });
  }

  // Schedule API
  async getSchedule(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/api/schedule${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(endpoint);
  }

  async createScheduleItem(item) {
    return this.request('/api/schedule', {
      method: 'POST',
      body: JSON.stringify(item)
    });
  }

  async updateScheduleItem(id, item) {
    return this.request(`/api/schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item)
    });
  }

  // Notes API
  async getNotes(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/api/notes${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(endpoint);
  }

  async createNote(note) {
    return this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note)
    });
  }

  // Stats API
  async getWeeklyStats(weekStart) {
    return this.request(`/api/stats/weekly?week_start=${weekStart}`);
  }

  // Timer API
  async savePomodoroSession(session) {
    return this.request('/api/pomodoro-sessions', {
      method: 'POST',
      body: JSON.stringify(session)
    });
  }

  // Authentication API
  async login(credentials) {
    return this.request('/api/login', {
      method: 'POST',
      body: credentials
    });
  }

  async logout() {
    return this.request('/api/logout', {
      method: 'POST'
    });
  }

  async getCurrentUser() {
    return this.request('/api/current-user');
  }
}

// StudyFlow Application
class StudyFlow {
  constructor() {
    this.currentSection = "dashboard";
    this.isTimerRunning = false;
    this.timerInterval = null;
    this.currentTime = 25 * 60; // 25 minutes in seconds
    this.isBreakTime = false;
    this.focusTime = 25 * 60;
    this.breakTime = 5 * 60;
    this.currentWeek = new Date();
    this.weeklyChart = null;
    this.subjectChart = null;
    this.progressChart = null;

    // Initialize API service
    this.api = new ApiService();
    this.currentUser = null;

    // Initialize data arrays
    this.subjects = [];
    this.sessions = [];
    this.schedule = [];
    this.notes = [];
    this.settings = this.loadFromStorage("settings") || {
      focusTime: 25,
      breakTime: 5,
      theme: "light",
    };

    this.init();
  }

  async init() {
    try {
      // Check authentication first
      await this.checkAuthentication();
      
      if (!this.currentUser) {
        this.showLoginScreen();
        return;
      }
      
      this.setupEventListeners();
      this.initTheme();
      this.initTimer();

      // Load data from API
      await this.loadDataFromAPI();

      this.loadSubjectsIntoSelects();
      this.updateDashboard();
      this.renderAgenda();
      this.renderSessions();
      this.renderNotes();
      this.renderReports();
      this.renderSubjects();

      // Switch to dashboard
      this.switchSection("dashboard");
      
      // Show main app
      this.showMainApp();
      
      console.log('StudyFlow initialized successfully');
    } catch (error) {
      console.error('Failed to initialize StudyFlow:', error);
      this.showToast('Erro ao carregar dados. Usando dados locais.', 'error');
    }
  }

  async checkAuthentication() {
    try {
      const response = await this.api.getCurrentUser();
      this.currentUser = response.user;
      if (this.currentUser) {
        // Se for admin, redirecionar para admin.html
        if (this.currentUser.role === 'admin') {
          window.location.href = 'admin.html';
          return;
        }
        document.getElementById('userFullName').textContent = this.currentUser.full_name;
      }
    } catch (error) {
      console.log('User not authenticated');
      this.currentUser = null;
    }
  }

  showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    this.setupLoginEventListeners();
  }

  showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
  }

  setupLoginEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.handleLogout();
      });
    }
  }

  async handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    const loginBtn = document.querySelector('.login-btn');

    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
      loginError.style.display = 'none';

      const response = await this.api.login({ username, password });
      
      if (response.success) {
        this.currentUser = response.user;
        
        // Se for admin, redirecionar para admin.html
        if (this.currentUser.role === 'admin') {
          window.location.href = 'admin.html';
          return;
        }
        
        document.getElementById('userFullName').textContent = this.currentUser.full_name;
        
        // Setup event listeners for navigation
        this.setupEventListeners();
        this.initTheme();
        this.initTimer();
        
        // Load data and show main app
        await this.loadDataFromAPI();
        this.loadSubjectsIntoSelects();
        this.updateDashboard();
        this.renderAgenda();
        this.renderSessions();
        this.renderNotes();
        this.renderReports();
        this.renderSubjects();
        this.switchSection('dashboard');
        this.showMainApp();
        
        this.showToast('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'Credenciais inválidas. Tente novamente.';
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
  }

  async handleLogout() {
    try {
      await this.api.logout();
      this.currentUser = null;
      this.subjects = [];
      this.sessions = [];
      this.notes = [];
      this.schedule = [];
      
      // Clear form
      document.getElementById('loginForm').reset();
      
      this.showLoginScreen();
      this.showToast('Logout realizado com sucesso!', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      this.showToast('Erro ao fazer logout', 'error');
    }
  }

  async loadDataFromAPI() {
    try {
      // Load subjects
      this.subjects = await this.api.getSubjects();
      
      // Load sessions
      this.sessions = await this.api.getStudySessions();
      
      // Load schedule
      this.schedule = await this.api.getSchedule();
      
      // Load notes
      this.notes = await this.api.getNotes();
      
      console.log('Data loaded from API successfully');
    } catch (error) {
      console.error('Failed to load data from API:', error);
      this.showToast('Erro ao carregar dados do servidor', 'error');
      
      // Fallback to localStorage if API fails
      this.subjects = this.loadFromStorage("subjects") || [];
      this.sessions = this.loadFromStorage("sessions") || [];
      this.schedule = this.loadFromStorage("schedule") || [];
      this.notes = this.loadFromStorage("notes") || [];
    }
  }

  setupEventListeners() {
    // Navbar
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const sectionName = e.currentTarget.getAttribute("data-section");
        if (sectionName) {
          this.switchSection(sectionName);
        }
      });
    });

    // Temas
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        this.toggleTheme();
      });
    }

    // Pomodoro
    const pomodoroPlay = document.getElementById("pomodoroPlay");
    const pomodoroPause = document.getElementById("pomodoroPause");
    const pomodoroReset = document.getElementById("pomodoroReset");

    if (pomodoroPlay) {
      pomodoroPlay.addEventListener("click", () => {
        this.startTimer();
      });
    }

    if (pomodoroPause) {
      pomodoroPause.addEventListener("click", () => {
        this.pauseTimer();
      });
    }

    if (pomodoroReset) {
      pomodoroReset.addEventListener("click", () => {
        this.resetTimer();
      });
    }

    // Relógio Inicial
    const quickStart = document.getElementById("quickStart");
    if (quickStart) {
      quickStart.addEventListener("click", () => {
        const subject = document.getElementById("quickSubject").value;
        if (subject) {
          document.getElementById("pomodoroSubject").value = subject;
          this.switchSection("pomodoro");
          this.startTimer();
        } else {
          this.showToast("Selecione uma disciplina", "warning");
        }
      });
    }

    // Agenda
    const prevWeek = document.getElementById("prevWeek");
    const nextWeek = document.getElementById("nextWeek");

    if (prevWeek) {
      prevWeek.addEventListener("click", () => {
        this.currentWeek.setDate(this.currentWeek.getDate() - 7);
        this.renderAgenda();
      });
    }

    if (nextWeek) {
      nextWeek.addEventListener("click", () => {
        this.currentWeek.setDate(this.currentWeek.getDate() + 7);
        this.renderAgenda();
      });
    }

    // Modals
    const addEventBtn = document.getElementById("addEventBtn");
    const closeEventModal = document.getElementById("closeEventModal");
    const eventForm = document.getElementById("eventForm");

    if (addEventBtn) {
      addEventBtn.addEventListener("click", () => {
        this.showModal("eventModal");
      });
    }

    if (closeEventModal) {
      closeEventModal.addEventListener("click", () => {
        this.hideModal("eventModal");
      });
    }

    if (eventForm) {
      eventForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEvent();
      });
    }

    // Sessões
    const addSessionBtn = document.getElementById("addSessionBtn");
    const cancelSession = document.getElementById("cancelSession");
    const sessionFormEl = document.getElementById("sessionFormEl");

    if (addSessionBtn) {
      addSessionBtn.addEventListener("click", () => {
        this.showSessionForm();
      });
    }

    if (cancelSession) {
      cancelSession.addEventListener("click", () => {
        this.hideSessionForm();
      });
    }

    if (sessionFormEl) {
      sessionFormEl.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSession();
      });
    }

    // Controles
    const addNoteBtn = document.getElementById("addNoteBtn");
    const closeNoteModal = document.getElementById("closeNoteModal");
    const noteForm = document.getElementById("noteForm");

    if (addNoteBtn) {
      addNoteBtn.addEventListener("click", () => {
        this.showModal("noteModal");
        document.getElementById("noteModalTitle").textContent = "Nova Anotação";
        document.getElementById("noteForm").reset();
        document.getElementById("noteForm").removeAttribute("data-note-id");
      });
    }

    if (closeNoteModal) {
      closeNoteModal.addEventListener("click", () => {
        this.hideModal("noteModal");
      });
    }

    if (noteForm) {
      noteForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveNote();
      });
    }

    // Filtros
    const noteSubjectFilter = document.getElementById("noteSubjectFilter");
    const noteSearch = document.getElementById("noteSearch");

    if (noteSubjectFilter) {
      noteSubjectFilter.addEventListener("change", () => {
        this.renderNotes();
      });
    }

    if (noteSearch) {
      noteSearch.addEventListener("input", () => {
        this.renderNotes();
      });
    }

    // Assunto
    const addSubjectBtn = document.getElementById("addSubjectBtn");
    const closeSubjectModal = document.getElementById("closeSubjectModal");
    const subjectForm = document.getElementById("subjectForm");

    if (addSubjectBtn) {
      addSubjectBtn.addEventListener("click", () => {
        this.showModal("subjectModal");
        document.getElementById("subjectModalTitle").textContent =
          "Nova Disciplina";
        document.getElementById("subjectForm").reset();
        document
          .getElementById("subjectForm")
          .removeAttribute("data-subject-id");
      });
    }

    if (closeSubjectModal) {
      closeSubjectModal.addEventListener("click", () => {
        this.hideModal("subjectModal");
      });
    }

    if (subjectForm) {
      subjectForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSubject();
      });
    }

    // Settings
    const saveSettings = document.getElementById("saveSettings");
    if (saveSettings) {
      saveSettings.addEventListener("click", () => {
        this.saveSettings();
      });
    }

    // data default
    const today = new Date().toISOString().split("T")[0];
    const sessionDate = document.getElementById("sessionDate");
    const eventDate = document.getElementById("eventDate");

    if (sessionDate) sessionDate.value = today;
    if (eventDate) eventDate.value = today;
  }

  switchSection(sectionId) {
    console.log("Switching to section:", sectionId);

    // Hide all sections
    document.querySelectorAll(".section").forEach((section) => {
      section.classList.remove("active");
    });

    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");
    }

    // Update navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    this.currentSection = sectionId;

    // Refresh section-specific data
    if (sectionId === "dashboard") {
      this.updateDashboard();
    } else if (sectionId === "agenda") {
      this.renderAgenda();
    } else if (sectionId === "sessions") {
      this.renderSessions();
    } else if (sectionId === "notes") {
      this.renderNotes();
    } else if (sectionId === "reports") {
      this.renderReports();
    } else if (sectionId === "settings") {
      this.renderSubjects();
      const focusTimeInput = document.getElementById("focusTime");
      const breakTimeInput = document.getElementById("breakTime");
      if (focusTimeInput) focusTimeInput.value = this.settings.focusTime;
      if (breakTimeInput) breakTimeInput.value = this.settings.breakTime;
    }
  }

  initTheme() {
    const theme = this.settings.theme || "light";
    document.documentElement.setAttribute("data-color-scheme", theme);
    const icon = document.querySelector("#themeToggle i");
    if (icon) {
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  }

  toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-color-scheme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-color-scheme", newTheme);
    this.settings.theme = newTheme;
    this.saveToStorage("settings", this.settings);

    const icon = document.querySelector("#themeToggle i");
    if (icon) {
      icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }

    this.showToast(
      `Tema alterado para ${newTheme === "dark" ? "escuro" : "claro"}`,
      "info"
    );
  }

  initTimer() {
    this.updateTimerDisplay();
    this.updateTimerProgress();
  }

  startTimer() {
    const subjectSelect = document.getElementById("pomodoroSubject");
    if (!subjectSelect || !subjectSelect.value) {
      this.showToast("Selecione uma disciplina para começar", "warning");
      return;
    }

    this.isTimerRunning = true;
    const playBtn = document.getElementById("pomodoroPlay");
    const pauseBtn = document.getElementById("pomodoroPause");

    if (playBtn) playBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "inline-flex";

    this.timerInterval = setInterval(() => {
      this.currentTime--;
      this.updateTimerDisplay();
      this.updateTimerProgress();

      if (this.currentTime <= 0) {
        this.completeTimer();
      }
    }, 1000);

    this.showToast("Timer iniciado!", "success");
  }

  pauseTimer() {
    this.isTimerRunning = false;
    clearInterval(this.timerInterval);

    const playBtn = document.getElementById("pomodoroPlay");
    const pauseBtn = document.getElementById("pomodoroPause");

    if (playBtn) playBtn.style.display = "inline-flex";
    if (pauseBtn) pauseBtn.style.display = "none";

    this.showToast("Timer pausado", "info");
  }

  resetTimer() {
    this.pauseTimer();
    this.currentTime = this.isBreakTime ? this.breakTime : this.focusTime;
    this.updateTimerDisplay();
    this.updateTimerProgress();
    this.showToast("Timer reiniciado", "info");
  }

  completeTimer() {
    this.pauseTimer();

    if (!this.isBreakTime) {
      // Complete focus session
      const subjectId = parseInt(
        document.getElementById("pomodoroSubject").value
      );
      const subject = this.subjects.find((s) => s.id === subjectId);

      if (subject) {
        this.addSession(subjectId, this.settings.focusTime, "Sessão Pomodoro");
        this.showToast(`Sessão de ${subject.name} concluída!`, "success");
      }

      this.isBreakTime = true;
      this.currentTime = this.breakTime;
      const modeEl = document.getElementById("pomodoroMode");
      if (modeEl) modeEl.textContent = "Pausa";
    } else {
      // Complete break
      this.isBreakTime = false;
      this.currentTime = this.focusTime;
      const modeEl = document.getElementById("pomodoroMode");
      if (modeEl) modeEl.textContent = "Foco";
      this.showToast("Pausa concluída! Pronto para uma nova sessão?", "info");
    }

    this.updateTimerDisplay();
    this.updateTimerProgress();
    this.updateDashboard();
    this.renderSessions();
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = this.currentTime % 60;
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    const pomodoroTime = document.getElementById("pomodoroTime");
    const timerDisplay = document.querySelector(".timer-display");

    if (pomodoroTime) pomodoroTime.textContent = timeString;
    if (timerDisplay) timerDisplay.textContent = timeString;
  }

  updateTimerProgress() {
    const totalTime = this.isBreakTime ? this.breakTime : this.focusTime;
    const progress = (totalTime - this.currentTime) / totalTime;
    const circumference = 2 * Math.PI * 120;
    const strokeDasharray = circumference * progress;

    const progressElement = document.getElementById("timerProgress");
    if (progressElement) {
      progressElement.style.strokeDasharray = `${strokeDasharray} ${circumference}`;
    }
  }

  async addSession(subjectId, minutes, notes = "") {
    const now = new Date();
    const session = {
      subject_id: subjectId,
      duration_minutes: minutes,
      date: now.toISOString().split("T")[0],
      start_time: now.toTimeString().split(' ')[0].substring(0, 5),
      end_time: new Date(now.getTime() + minutes * 60000).toTimeString().split(' ')[0].substring(0, 5),
      notes: notes,
      technique: 'pomodoro'
    };

    try {
      const savedSession = await this.api.createStudySession(session);
      // Reload sessions from API to get updated data
      this.sessions = await this.api.getStudySessions();
    } catch (error) {
      console.error('Error saving session:', error);
      this.showToast('Erro ao salvar sessão', 'error');
    }
  }

  updateDashboard() {
    const today = new Date().toISOString().split("T")[0];
    const startOfWeek = this.getStartOfWeek(new Date());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    // Today's hours
    const todaySessions = this.sessions.filter((s) => s.date === today);
    const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const todayHoursEl = document.getElementById("todayHours");
    if (todayHoursEl) todayHoursEl.textContent = this.formatTime(todayMinutes);

    // Week's hours
    const weekSessions = this.sessions.filter((s) => {
      const sessionDate = new Date(s.date);
      return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
    });
    const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const weekHoursEl = document.getElementById("weekHours");
    if (weekHoursEl) weekHoursEl.textContent = this.formatTime(weekMinutes);

    // Active subjects
    const activeSubjects = new Set(
      this.sessions
        .filter((s) => {
          const sessionDate = new Date(s.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return sessionDate >= weekAgo;
        })
        .map((s) => s.subject_id)
    ).size;
    const activeSubjectsEl = document.getElementById("activeSubjects");
    if (activeSubjectsEl) activeSubjectsEl.textContent = activeSubjects;

    // Study streak
    const streak = this.calculateStudyStreak();
    const studyStreakEl = document.getElementById("studyStreak");
    if (studyStreakEl) studyStreakEl.textContent = streak;

    // Update weekly chart
    this.renderWeeklyChart();

    // Update today's sessions in pomodoro section
    this.renderTodaySessions();
  }

  calculateStudyStreak() {
    const sortedDates = [...new Set(this.sessions.map((s) => s.date))]
      .sort()
      .reverse();
    let streak = 0;
    let checkDate = new Date();

    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (sortedDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  renderWeeklyChart() {
    const canvas = document.getElementById("weeklyChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const startOfWeek = this.getStartOfWeek(new Date());

    const labels = [];
    const data = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      labels.push(date.toLocaleDateString("pt-BR", { weekday: "short" }));

      const dayMinutes = this.sessions
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      data.push(Math.round((dayMinutes / 60) * 10) / 10);
    }

    if (this.weeklyChart) {
      this.weeklyChart.destroy();
    }

    this.weeklyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Horas estudadas",
            data,
            borderColor: "#1FB8CD",
            backgroundColor: "rgba(31, 184, 205, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  renderTodaySessions() {
    const today = new Date().toISOString().split("T")[0];
    const todaySessions = this.sessions.filter((s) => s.date === today);
    const container = document.getElementById("todaySessions");

    if (!container) return;

    if (todaySessions.length === 0) {
      container.innerHTML = "<p>Nenhuma sessão registrada hoje</p>";
      return;
    }

    container.innerHTML = todaySessions
      .map((session) => {
        const subject = this.subjects.find((s) => s.id === session.subject_id);
        return `
                <div class="session-item">
                    <div class="session-subject">${
                      subject ? subject.name : "Disciplina removida"
                    }</div>
                    <div class="session-time">${this.formatTime(
                      session.duration_minutes || 0
                    )} - ${session.time}</div>
                </div>
            `;
      })
      .join("");
  }

  renderAgenda() {
    const container = document.getElementById("agendaGrid");
    if (!container) return;

    const startOfWeek = this.getStartOfWeek(this.currentWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    // Update week range
    const weekRangeEl = document.getElementById("weekRange");
    if (weekRangeEl) {
      weekRangeEl.textContent = `${startOfWeek.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })} - ${endOfWeek.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })}`;
    }

    // Generate calendar
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    let html = "";

    // Headers
    days.forEach((day) => {
      html += `<div class="day-header">${day}</div>`;
    });

    // Days
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      const events = this.schedule.filter((e) => e.date === dateStr);

      html += `
                <div class="day-cell">
                    <div class="day-number">${date.getDate()}</div>
                    ${events
                      .map((event) => {
                        const subject = this.subjects.find(
                          (s) => s.id === event.subjectId
                        );
                        return `
                            <div class="event-item" style="background-color: ${
                              subject ? subject.color : "#666"
                            }">
                                ${event.title}
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            `;
    }

    container.innerHTML = html;
  }

  showSessionForm() {
    const sessionForm = document.getElementById("sessionForm");
    if (sessionForm) {
      sessionForm.classList.add("active");
      sessionForm.style.display = "block";
    }
  }

  hideSessionForm() {
    const sessionForm = document.getElementById("sessionForm");
    if (sessionForm) {
      sessionForm.classList.remove("active");
      sessionForm.style.display = "none";
    }

    const sessionFormEl = document.getElementById("sessionFormEl");
    if (sessionFormEl) {
      sessionFormEl.reset();
    }

    const today = new Date().toISOString().split("T")[0];
    const sessionDate = document.getElementById("sessionDate");
    if (sessionDate) sessionDate.value = today;
  }

  async saveSession() {
    const subjectId = parseInt(document.getElementById("sessionSubject").value);
    const duration = parseInt(document.getElementById("sessionDuration").value);
    const date = document.getElementById("sessionDate").value;
    const notes = document.getElementById("sessionNotes").value;

    if (!subjectId || !duration || !date) {
      this.showToast("Preencha todos os campos obrigatórios", "error");
      return;
    }

    const now = new Date();
    const session = {
      subject_id: subjectId,
      duration_minutes: duration,
      date: date,
      start_time: now.toTimeString().split(' ')[0].substring(0, 5),
      end_time: new Date(now.getTime() + duration * 60000).toTimeString().split(' ')[0].substring(0, 5),
      notes: notes,
      technique: 'manual'
    };

    try {
      await this.api.createStudySession(session);
      // Reload sessions from API
      this.sessions = await this.api.getStudySessions();
      
      this.hideSessionForm();
      this.renderSessions();
      this.updateDashboard();
      this.showToast("Sessão registrada com sucesso!", "success");
    } catch (error) {
      console.error('Error saving session:', error);
      this.showToast("Erro ao salvar sessão", "error");
    }
  }

  renderSessions() {
    const container = document.getElementById("sessionsList");
    if (!container) return;

    if (this.sessions.length === 0) {
      container.innerHTML = "<p>Nenhuma sessão registrada</p>";
      return;
    }

    const recentSessions = this.sessions.slice(0, 20); // Show last 20 sessions

    container.innerHTML = recentSessions
      .map((session) => {
        const subject = this.subjects.find((s) => s.id === session.subject_id);
        const date = new Date(session.date).toLocaleDateString("pt-BR");

        return `
                <div class="session-item">
                    <div>
                        <div class="session-subject">${
                          subject ? subject.name : "Disciplina removida"
                        }</div>
                        <div class="session-time">${this.formatTime(
                          session.duration_minutes || 0
                        )} - ${date} ${session.time}</div>
                        ${
                          session.notes
                            ? `<div class="session-notes">${session.notes}</div>`
                            : ""
                        }
                    </div>
                    <button class="btn btn--outline btn--sm" onclick="app.deleteSession(${
                      session.id
                    })">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
      })
      .join("");
  }

  deleteSession(sessionId) {
    if (confirm("Tem certeza que deseja excluir esta sessão?")) {
      this.sessions = this.sessions.filter((s) => s.id !== sessionId);
      this.saveToStorage("sessions", this.sessions);
      this.renderSessions();
      this.updateDashboard();
      this.showToast("Sessão removida", "info");
    }
  }

  renderNotes() {
    const subjectFilter = document.getElementById("noteSubjectFilter");
    const searchInput = document.getElementById("noteSearch");

    const subjectFilterValue = subjectFilter ? subjectFilter.value : "";
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    let filteredNotes = this.notes;

    if (subjectFilterValue) {
      filteredNotes = filteredNotes.filter(
        (n) => n.subjectId == subjectFilterValue
      );
    }

    if (searchTerm) {
      filteredNotes = filteredNotes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchTerm) ||
          n.content.toLowerCase().includes(searchTerm)
      );
    }

    const container = document.getElementById("notesList");
    if (!container) return;

    if (filteredNotes.length === 0) {
      container.innerHTML = "<p>Nenhuma anotação encontrada</p>";
      return;
    }

    container.innerHTML = filteredNotes
      .map((note) => {
        const subject = this.subjects.find((s) => s.id === note.subjectId);
        const date = new Date(note.createdAt).toLocaleDateString("pt-BR");

        return `
                <div class="note-item" onclick="app.editNote(${note.id})">
                    <div class="note-header">
                        <div class="note-title">${note.title}</div>
                        <div class="note-subject" style="background-color: ${
                          subject ? subject.color : "#666"
                        }">
                            ${subject ? subject.name : "Sem disciplina"}
                        </div>
                    </div>
                    <div class="note-content">${note.content}</div>
                    <div class="note-date">${date}</div>
                </div>
            `;
      })
      .join("");
  }

  async saveNote() {
    const title = document.getElementById("noteTitle").value;
    const subjectId = parseInt(document.getElementById("noteSubject").value);
    const content = document.getElementById("noteContent").value;
    const noteForm = document.getElementById("noteForm");
    const noteId = noteForm ? noteForm.dataset.noteId : null;

    if (!title || !subjectId || !content) {
      this.showToast("Preencha todos os campos", "error");
      return;
    }

    try {
      if (noteId) {
        // TODO: Implement edit note API call
        this.showToast("Edição de anotações será implementada em breve", "info");
        return;
      } else {
        // Create new note
        const note = {
          subject_id: subjectId,
          title: title,
          content: content
        };

        await this.api.createNote(note);
        // Reload notes from API
        this.notes = await this.api.getNotes();
      }

      this.hideModal("noteModal");
      this.renderNotes();
      this.showToast(
        noteId ? "Anotação atualizada!" : "Anotação salva!",
        "success"
      );
    } catch (error) {
      console.error('Error saving note:', error);
      this.showToast("Erro ao salvar anotação", "error");
    }

    // Reset form
    if (noteForm) {
      noteForm.removeAttribute("data-note-id");
    }
  }

  editNote(noteId) {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return;

    const noteModalTitle = document.getElementById("noteModalTitle");
    const noteTitle = document.getElementById("noteTitle");
    const noteSubject = document.getElementById("noteSubject");
    const noteContent = document.getElementById("noteContent");
    const noteForm = document.getElementById("noteForm");

    if (noteModalTitle) noteModalTitle.textContent = "Editar Anotação";
    if (noteTitle) noteTitle.value = note.title;
    if (noteSubject) noteSubject.value = note.subjectId;
    if (noteContent) noteContent.value = note.content;
    if (noteForm) noteForm.dataset.noteId = noteId;

    this.showModal("noteModal");
  }

  renderReports() {
    this.renderSubjectChart();
    this.renderProgressChart();
  }

  renderSubjectChart() {
    const canvas = document.getElementById("subjectChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const subjectMinutes = {};
    this.sessions.forEach((session) => {
      if (!subjectMinutes[session.subject_id]) {
        subjectMinutes[session.subject_id] = 0;
      }
      subjectMinutes[session.subject_id] += (session.duration_minutes || 0);
    });

    const labels = [];
    const data = [];
    const colors = [];

    Object.entries(subjectMinutes).forEach(([subjectId, minutes]) => {
      const subject = this.subjects.find((s) => s.id == subjectId);
      if (subject) {
        labels.push(subject.name);
        data.push(Math.round((minutes / 60) * 10) / 10);
        colors.push(subject.color);
      }
    });

    if (this.subjectChart) {
      this.subjectChart.destroy();
    }

    this.subjectChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }

  renderProgressChart() {
    const canvas = document.getElementById("progressChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Get last 30 days
    const days = [];
    const data = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      days.push(
        date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      );

      const dayMinutes = this.sessions
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      data.push(Math.round((dayMinutes / 60) * 10) / 10);
    }

    if (this.progressChart) {
      this.progressChart.destroy();
    }

    this.progressChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: days,
        datasets: [
          {
            label: "Horas estudadas",
            data,
            borderColor: "#2ECC71",
            backgroundColor: "rgba(46, 204, 113, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  renderSubjects() {
    const container = document.getElementById("subjectsList");
    if (!container) return;

    container.innerHTML = this.subjects
      .map(
        (subject) => `
            <div class="subject-item">
                <div class="subject-info">
                    <div class="subject-color" style="background-color: ${subject.color}"></div>
                    <div class="subject-name">${subject.name}</div>
                </div>
                <div class="subject-actions">
                    <button class="btn btn--outline btn--sm" onclick="app.editSubject(${subject.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn--outline btn--sm" onclick="app.deleteSubject(${subject.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `
      )
      .join("");
  }

  async saveSubject() {
    const name = document.getElementById("subjectName").value;
    const color = document.getElementById("subjectColor").value;
    const subjectForm = document.getElementById("subjectForm");
    const subjectId = subjectForm ? subjectForm.dataset.subjectId : null;

    if (!name || !color) {
      this.showToast("Preencha todos os campos", "error");
      return;
    }

    try {
      if (subjectId) {
        // Edit existing subject - TODO: implement update API endpoint
        const subject = this.subjects.find((s) => s.id == subjectId);
        if (subject) {
          subject.name = name;
          subject.color = color;
        }
        this.showToast("Disciplina atualizada com sucesso!", "success");
      } else {
        // Create new subject
        const newSubject = await this.api.createSubject({ name, color });
        this.subjects.push(newSubject);
        this.showToast("Disciplina criada com sucesso!", "success");
      }
    } catch (error) {
      console.error('Error saving subject:', error);
      this.showToast("Erro ao salvar disciplina", "error");
      return;
    }

    this.saveToStorage("subjects", this.subjects);
    this.hideModal("subjectModal");
    this.renderSubjects();
    this.loadSubjectsIntoSelects();
    this.showToast(
      subjectId ? "Disciplina atualizada!" : "Disciplina criada!",
      "success"
    );

    // Reset form
    if (subjectForm) {
      subjectForm.removeAttribute("data-subject-id");
    }
  }

  editSubject(subjectId) {
    const subject = this.subjects.find((s) => s.id === subjectId);
    if (!subject) return;

    const subjectModalTitle = document.getElementById("subjectModalTitle");
    const subjectName = document.getElementById("subjectName");
    const subjectColor = document.getElementById("subjectColor");
    const subjectForm = document.getElementById("subjectForm");

    if (subjectModalTitle) subjectModalTitle.textContent = "Editar Disciplina";
    if (subjectName) subjectName.value = subject.name;
    if (subjectColor) subjectColor.value = subject.color;
    if (subjectForm) subjectForm.dataset.subjectId = subjectId;

    this.showModal("subjectModal");
  }

  deleteSubject(subjectId) {
    if (
      confirm(
        "Tem certeza que deseja excluir esta disciplina? Todas as sessões e anotações relacionadas serão mantidas mas ficarão sem disciplina."
      )
    ) {
      this.subjects = this.subjects.filter((s) => s.id !== subjectId);
      this.saveToStorage("subjects", this.subjects);
      this.renderSubjects();
      this.loadSubjectsIntoSelects();
      this.showToast("Disciplina removida", "info");
    }
  }

  async saveEvent() {
    const title = document.getElementById("eventTitle").value;
    const subjectId = parseInt(document.getElementById("eventSubject").value);
    const date = document.getElementById("eventDate").value;
    const time = document.getElementById("eventTime").value;
    const duration = parseInt(document.getElementById("eventDuration").value);

    if (!title || !subjectId || !date || !time || !duration) {
      this.showToast("Preencha todos os campos", "error");
      return;
    }

    const event = {
      subject_id: subjectId,
      title: title,
      date: date,
      time: time,
      duration_minutes: duration,
      completed: false
    };

    try {
      await this.api.createScheduleItem(event);
      // Reload schedule from API
      this.schedule = await this.api.getSchedule();
      
      this.hideModal("eventModal");
      this.renderAgenda();
      this.showToast("Evento adicionado!", "success");

      const eventForm = document.getElementById("eventForm");
      if (eventForm) eventForm.reset();
    } catch (error) {
      console.error('Error saving event:', error);
      this.showToast("Erro ao salvar evento", "error");
    }
  }

  saveSettings() {
    const focusTime = parseInt(document.getElementById("focusTime").value);
    const breakTime = parseInt(document.getElementById("breakTime").value);

    if (!focusTime || !breakTime || focusTime < 1 || breakTime < 1) {
      this.showToast("Valores inválidos para os tempos", "error");
      return;
    }

    this.settings.focusTime = focusTime;
    this.settings.breakTime = breakTime;

    this.focusTime = focusTime * 60;
    this.breakTime = breakTime * 60;

    if (!this.isTimerRunning) {
      this.currentTime = this.isBreakTime ? this.breakTime : this.focusTime;
      this.updateTimerDisplay();
      this.updateTimerProgress();
    }

    this.saveToStorage("settings", this.settings);
    this.showToast("Configurações salvas!", "success");
  }

  loadSubjectsIntoSelects() {
    const selects = [
      "quickSubject",
      "pomodoroSubject",
      "sessionSubject",
      "eventSubject",
      "noteSubject",
      "noteSubjectFilter",
    ];

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (!select) return;

      const currentValue = select.value;

      // Clear existing options except first
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      // Add subject options
      this.subjects.forEach((subject) => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        select.appendChild(option);
      });

      // Restore previous value if it still exists
      if (
        currentValue &&
        [...select.options].some((opt) => opt.value === currentValue)
      ) {
        select.value = currentValue;
      }
    });
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;

    const container = document.getElementById("toastContainer");
    if (container) {
      container.appendChild(toast);

      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 3000);
    }
  }

  getToastIcon(type) {
    const icons = {
      success: "check-circle",
      error: "exclamation-circle",
      warning: "exclamation-triangle",
      info: "info-circle",
    };
    return icons[type] || icons.info;
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, "0")}m`;
  }

  saveToStorage(key, data) {
    try {
      localStorage.setItem(`studyflow_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  loadFromStorage(key) {
    try {
      const data = localStorage.getItem(`studyflow_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return null;
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new StudyFlow();

  // Close modals when clicking outside
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.classList.add("hidden");
    }
  });
});
